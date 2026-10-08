import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import bcrypt from 'bcrypt';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';

const TEST_PASSWORD = 'Password123!';

let counselorUserId: string;
let counselorToken: string;

let otherCounselorUserId: string;
let otherCounselorToken: string;

let principalUserId: string;
let principalToken: string;

let studentUserId: string;
let studentToken: string;
let studentId: string;

let guidanceRecordId: string;

describe('Phase 4E: Guidance Characterization Tests', () => {
  beforeAll(async () => {
    // Cleanup any orphaned records from failed runs
    try {
      const orphanedUsers = await prisma.user.findMany({
        where: { email: { in: ['counselor_g@calulut.edu.ph', 'other_counselor_g@calulut.edu.ph', 'principal_g@calulut.edu.ph', 'student_g@calulut.edu.ph'] } }
      });
      if (orphanedUsers.length > 0) {
        const uids = orphanedUsers.map(u => u.id);
        await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: uids } } });
        await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.student.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.user.deleteMany({ where: { id: { in: uids } } });
      }
    } catch(err) {}

    const password_hash = await bcrypt.hash(TEST_PASSWORD, 10);
    
    // Create Roles
    let guidanceRole = await prisma.role.findFirst({ where: { name: 'Guidance' } });
    if (!guidanceRole) guidanceRole = await prisma.role.create({ data: { id: generateId(), name: 'Guidance' } });

    let principalRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (!principalRole) principalRole = await prisma.role.create({ data: { id: generateId(), name: 'Principal' } });

    let studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!studentRole) studentRole = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });
    
    // Ensure permissions are attached
    let permRead = await prisma.permission.findFirst({ where: { key: 'guidance:read' } });
    if (!permRead) permRead = await prisma.permission.create({ data: { id: generateId(), key: 'guidance:read' } });
    let permWrite = await prisma.permission.findFirst({ where: { key: 'guidance:write' } });
    if (!permWrite) permWrite = await prisma.permission.create({ data: { id: generateId(), key: 'guidance:write' } });

    // Link perms to Guidance and Principal
    await prisma.rolePermission.createMany({
      data: [
        { role_id: guidanceRole.id, permission_id: permRead.id },
        { role_id: guidanceRole.id, permission_id: permWrite.id },
        { role_id: principalRole.id, permission_id: permRead.id },
        { role_id: principalRole.id, permission_id: permWrite.id }
      ],
      skipDuplicates: true
    });

    // 1. Create Counselor (Guidance)
    counselorUserId = generateId();
    await prisma.user.create({
      data: {
        id: counselorUserId, email: 'counselor_g@calulut.edu.ph', password_hash, first_name: 'Coun', last_name: 'Selor', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: guidanceRole.id } },
        staff: { create: { id: generateId(), employee_id: 'G-COUN-1', position: 'Counselor', department: 'Guidance' } }
      }
    });
    counselorToken = sign({ userId: counselorUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 2. Create Other Counselor (Guidance)
    otherCounselorUserId = generateId();
    await prisma.user.create({
      data: {
        id: otherCounselorUserId, email: 'other_counselor_g@calulut.edu.ph', password_hash, first_name: 'Other', last_name: 'Coun', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: guidanceRole.id } },
        staff: { create: { id: generateId(), employee_id: 'G-COUN-2', position: 'Counselor', department: 'Guidance' } }
      }
    });
    otherCounselorToken = sign({ userId: otherCounselorUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 3. Create Principal
    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId, email: 'principal_g@calulut.edu.ph', password_hash, first_name: 'Prin', last_name: 'Cipal', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: principalRole.id } },
        staff: { create: { id: generateId(), employee_id: 'P-GUIDE-1', position: 'Principal', department: 'Administration' } }
      }
    });
    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 4. Create Student
    studentUserId = generateId();
    studentId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId, email: 'student_g@calulut.edu.ph', password_hash, first_name: 'Student', last_name: 'Guide', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: { create: { id: studentId, lrn: '777777777777', grade_level: 10 } }
      }
    });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    // Cleanup
    if (studentId) await prisma.guidanceRecord.deleteMany({ where: { student_id: studentId } });
    const userIds = [counselorUserId, otherCounselorUserId, principalUserId, studentUserId].filter(Boolean) as string[];
    if (userIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: userIds } } });
      await prisma.staff.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.student.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it('POST /api/student-services/guidance - should create guidance record by authorized counselor', async () => {
    const res = await request(app)
      .post('/api/student-services/guidance')
      .set('Authorization', `Bearer ${counselorToken}`)
      .send({
        studentId: studentId,
        type: 'Academic Counseling',
        date: new Date().toISOString(),
        reason: 'Failing grades in Math',
        notes: 'Spoke with student about study habits',
        actionTaken: 'Scheduled weekly followups'
      });
      
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student_id).toBe(studentId);
    expect(res.body.data.counselor_id).toBe(counselorUserId);
    expect(res.body.data.status).toBe('Open'); // default status
    
    guidanceRecordId = res.body.data.id;

    // Verify Audit Log
    const audit = await prisma.auditLog.findFirst({
      where: { resource_id: guidanceRecordId, action: 'GUIDANCE_RECORD_CREATED' }
    });
    expect(audit).toBeTruthy();
    expect(audit?.actor_user_id).toBe(counselorUserId);
  });

  it('GET /api/student-services/guidance - should return guidance records with counselor name and student name', async () => {
    const res = await request(app)
      .get('/api/student-services/guidance')
      .set('Authorization', `Bearer ${counselorToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const logs = res.body.data;
    expect(Array.isArray(logs)).toBe(true);
    
    const myLog = logs.find((l: any) => l.id === guidanceRecordId);
    expect(myLog).toBeTruthy();
    expect(myLog.counselor_name).toBe('Coun Selor');
    expect(myLog.studentName).toBe('Student Guide');
  });

  it('GET /api/student-services/guidance/:studentId - should return records scoped to student', async () => {
    const res = await request(app)
      .get(`/api/student-services/guidance/${studentId}`)
      .set('Authorization', `Bearer ${counselorToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].student_id).toBe(studentId);
    expect(res.body.data[0].counselor_name).toBe('Coun Selor');
  });

  it('GET /api/student-services/guidance - unauthorized user should get 403', async () => {
    const res = await request(app)
      .get('/api/student-services/guidance')
      .set('Authorization', `Bearer ${studentToken}`); // students don't have guidance:read
      
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('PATCH /api/student-services/guidance/:id/status - should allow owner to update status', async () => {
    const res = await request(app)
      .patch(`/api/student-services/guidance/${guidanceRecordId}/status`)
      .set('Authorization', `Bearer ${counselorToken}`)
      .send({ status: 'In Progress' });
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('In Progress');
    
    // Characterize that GUIDANCE_RECORD_UPDATED audit log is created
    const audit = await prisma.auditLog.findFirst({
      where: { resource_id: guidanceRecordId, action: 'GUIDANCE_RECORD_UPDATED' }
    });
    expect(audit).toBeTruthy();
    expect(audit?.actor_user_id).toBe(counselorUserId);
  });

  it('PATCH /api/student-services/guidance/:id/status - should reject non-owner without global view', async () => {
    const res = await request(app)
      .patch(`/api/student-services/guidance/${guidanceRecordId}/status`)
      .set('Authorization', `Bearer ${otherCounselorToken}`)
      .send({ status: 'Closed' });
      
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/only update your own/);
  });

  it('PATCH /api/student-services/guidance/:id/status - should allow global viewer (Principal) to update', async () => {
    const res = await request(app)
      .patch(`/api/student-services/guidance/${guidanceRecordId}/status`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ status: 'Closed' });
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Closed');
  });
});
