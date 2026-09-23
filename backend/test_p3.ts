import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key'; // Assumed default if missing in env

function generateToken(user: any, roles: string[]) {
  return jwt.sign({ userId: user.id, email: user.email, roles }, JWT_SECRET, { expiresIn: '1h' });
}

async function apiReq(endpoint: string, token: string, method = 'GET', body: any = null) {
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${endpoint}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING P3 VERIFICATION ---');
  
  // 1. Get Users for RBAC
  const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' }});
  const principalRole = await prisma.role.findFirst({ where: { name: 'Principal' }});
  const teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' }});
  const studentRole = await prisma.role.findFirst({ where: { name: 'Student' }});

  // Assign necessary permissions to Principal if they don't have them
  const permsToAssign = ['inventory:read', 'inventory:write', 'leave:read', 'leave:approve', 'academic:read', 'academic:write'];
  for (const pName of permsToAssign) {
    let perm = await prisma.permission.findUnique({ where: { key: pName } });
    if (!perm) {
      perm = await prisma.permission.create({ data: { id: `perm_${pName}`, key: pName } });
    }
    const existing = await prisma.rolePermission.findUnique({ where: { role_id_permission_id: { role_id: principalRole!.id, permission_id: perm.id } } });
    if (!existing) {
      await prisma.rolePermission.create({ data: { role_id: principalRole!.id, permission_id: perm.id } });
    }
  }
  
  const adminUser = await prisma.user.findFirst({ where: { user_roles: { some: { role_id: adminRole!.id } } } });
  const principalUser = await prisma.user.findFirst({ where: { user_roles: { some: { role_id: principalRole!.id } } } });
  const teacherUser = await prisma.user.findFirst({ where: { user_roles: { some: { role_id: teacherRole!.id } } } });
  const studentUser = await prisma.user.findFirst({ where: { user_roles: { some: { role_id: studentRole!.id } } } });
  
  const adminToken = generateToken(adminUser, ['Admin']);
  const principalToken = generateToken(principalUser, ['Principal']);
  const teacherToken = generateToken(teacherUser, ['Teacher']);
  const studentToken = generateToken(studentUser, ['Student']);

  console.log('✅ Generated JWTs for roles');

  // RBAC Tests
  console.log('\n--- RBAC TESTS ---');
  let res = await apiReq('/admin/inventory', studentToken);
  console.log('Student GET /inventory:', res.status, res.status === 403 ? '✅' : '❌');
  
  res = await apiReq('/admin/leaves', teacherToken);
  console.log('Teacher GET /leaves:', res.status, res.status === 403 ? '✅' : '❌');
  
  res = await apiReq('/admin/rankings', principalToken);
  console.log('Principal GET /rankings:', res.status, res.status === 200 ? '✅' : '❌');

  // INVENTORY TEST
  console.log('\n--- INVENTORY TEST ---');
  const invPayload = {
    name: 'TEST_PROJECTOR_' + Date.now(),
    category: 'ICT',
    description: 'Test Verification Item',
    quantity: 5,
    unit: 'pcs',
    condition: 'Good',
    status: 'Good'
  };
  
  let invPost = await apiReq('/admin/inventory', principalToken, 'POST', invPayload);
  console.log('POST /admin/inventory status:', invPost.status);
  const createdInvId = invPost.data?.data?.id;
  
  // Verify DB Persistence
  let dbInv = await prisma.inventoryItem.findUnique({ where: { id: createdInvId }, include: { updates: true }});
  console.log('DB Persistence (Inventory):', dbInv ? '✅' : '❌');
  console.log('InventoryUpdate History Created:', dbInv?.updates?.length === 1 ? '✅' : '❌');

  // Update Inventory
  let invPatch = await apiReq(`/admin/inventory/${createdInvId}`, principalToken, 'PATCH', { quantity: 10, update_details: 'Added 5 more' });
  console.log('PATCH /admin/inventory status:', invPatch.status);
  
  dbInv = await prisma.inventoryItem.findUnique({ where: { id: createdInvId }, include: { updates: true }});
  console.log('InventoryUpdate History Appended:', dbInv?.updates?.length === 2 ? '✅' : '❌');
  console.log('History NOT Destroyed:', dbInv?.updates?.some(u => u.action === 'Added') ? '✅' : '❌');

  // LEAVE TEST
  console.log('\n--- LEAVE TEST ---');
  // Find a pending leave or create one
  let pendingLeave = await prisma.leaveRequest.findFirst({ where: { status: 'Pending' }});
  let createdLeaveId = null;
  if (!pendingLeave) {
    const teacher = await prisma.teacher.findFirst();
    pendingLeave = await prisma.leaveRequest.create({
      data: {
        id: 'test_leave_' + Date.now(),
        user_id: teacher!.user_id,
        type: 'Sick Leave',
        start_date: new Date(),
        end_date: new Date(),
        reason: 'Test verification',
        status: 'Pending',
        days: 1
      }
    });
    createdLeaveId = pendingLeave.id;
  }
  
  let leavePatch = await apiReq(`/admin/leaves/${pendingLeave.id}/status`, principalToken, 'PATCH', { status: 'Approved', approver_note: 'Approved for test' });
  console.log('PATCH /admin/leaves/:id/status:', leavePatch.status);
  
  let dbLeave = await prisma.leaveRequest.findUnique({ where: { id: pendingLeave.id }});
  console.log('Leave status updated in DB:', dbLeave?.status === 'Approved' ? '✅' : '❌');
  console.log('Leave approver identity stored:', dbLeave?.approver_id === principalUser!.id ? '✅' : '❌');

  // RANKING TEST
  console.log('\n--- RANKING TEST ---');
  const teacherRecord = await prisma.teacher.findFirst();
  const acadYear = await prisma.academicYear.findFirst({ where: { is_current: true }});
  
  const rankPayload = {
    teacher_id: teacherRecord!.id,
    academic_year_id: acadYear!.id,
    current_position: 'Teacher I',
    target_position: 'Teacher II',
    assessment_info: 'Test assessment'
  };
  
  let rankPost = await apiReq('/admin/rankings', principalToken, 'POST', rankPayload);
  console.log('POST /admin/rankings status:', rankPost.status);
  if (rankPost.status !== 201) console.log(rankPost.data);
  const createdRankId = rankPost.data?.data?.id;
  if (!createdRankId) return;

  let dbRank = await prisma.teacherRanking.findUnique({ where: { id: createdRankId }});
  console.log('Ranking teacher_id relation:', dbRank?.teacher_id === teacherRecord!.id ? '✅' : '❌');
  console.log('Ranking academic_year_id relation:', dbRank?.academic_year_id === acadYear!.id ? '✅' : '❌');

  // Update Ranking
  const criteriaScores = [
    { criteriaName: 'Education', score: 20 },
    { criteriaName: 'Experience', score: 10 }
  ];
  let rankPatch = await apiReq(`/admin/rankings/${createdRankId}`, principalToken, 'PATCH', { criteria_scores: criteriaScores, status: 'Under Review' });
  console.log('PATCH /admin/rankings status:', rankPatch.status);

  dbRank = await prisma.teacherRanking.findUnique({ where: { id: createdRankId }});
  console.log('Ranking server-side total_score calculation:', dbRank?.total_score === 30 ? '✅' : '❌');

  // CLEANUP
  console.log('\n--- CLEANUP ---');
  if (createdRankId) {
    await prisma.teacherRanking.delete({ where: { id: createdRankId }});
    console.log('Deleted test ranking.');
  }
  if (createdLeaveId) {
    await prisma.leaveRequest.delete({ where: { id: createdLeaveId }});
    console.log('Deleted test leave request.');
  } else if (pendingLeave) {
    // Revert status of existing leave
    await prisma.leaveRequest.update({
      where: { id: pendingLeave.id },
      data: { status: 'Pending', approver_id: null, approver_note: null }
    });
    console.log('Reverted existing leave request status.');
  }
  if (createdInvId) {
    await prisma.inventoryUpdate.deleteMany({ where: { item_id: createdInvId }});
    await prisma.inventoryItem.delete({ where: { id: createdInvId }});
    console.log('Deleted test inventory item and updates.');
  }

  console.log('\nAll tests executed.');
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
