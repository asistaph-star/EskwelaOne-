import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import bcrypt from 'bcrypt';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';

const TEST_PASSWORD = 'Password123!';

let reporterUserId: string;
let reporterToken: string;

let otherReporterUserId: string;
let otherReporterToken: string;

let principalUserId: string;
let principalToken: string;

let studentUserId: string;
let studentToken: string;
let studentId: string;

let behaviorLogId: string;

describe('Phase 4D: Behavior Characterization Tests', () => {
  beforeAll(async () => {
    // Cleanup any orphaned records from failed runs
    try {
      const orphanedUsers = await prisma.user.findMany({
        where: { email: { in: ['reporter@calulut.edu.ph', 'other_reporter@calulut.edu.ph', 'principal_behav@calulut.edu.ph', 'student_behav@calulut.edu.ph'] } }
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

    // 1. Create Reporter (Guidance)
    reporterUserId = generateId();
    await prisma.user.create({
      data: {
        id: reporterUserId, email: 'reporter@calulut.edu.ph', password_hash, first_name: 'Rep', last_name: 'Orter', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: guidanceRole.id } },
        staff: { create: { id: generateId(), employee_id: 'G-REP-1', position: 'Counselor', department: 'Guidance' } }
      }
    });
    reporterToken = sign({ userId: reporterUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 2. Create Other Reporter (Guidance)
    otherReporterUserId = generateId();
    await prisma.user.create({
      data: {
        id: otherReporterUserId, email: 'other_reporter@calulut.edu.ph', password_hash, first_name: 'Other', last_name: 'Rep', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: guidanceRole.id } },
        staff: { create: { id: generateId(), employee_id: 'G-REP-2', position: 'Counselor', department: 'Guidance' } }
      }
    });
    otherReporterToken = sign({ userId: otherReporterUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 3. Create Principal
    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId, email: 'principal_behav@calulut.edu.ph', password_hash, first_name: 'Prin', last_name: 'Cipal', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: principalRole.id } },
        staff: { create: { id: generateId(), employee_id: 'P-BEHAV-1', position: 'Principal', department: 'Administration' } }
      }
    });
    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 4. Create Student
    studentUserId = generateId();
    studentId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId, email: 'student_behav@calulut.edu.ph', password_hash, first_name: 'Student', last_name: 'Behav', status: 'active', must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: { create: { id: studentId, lrn: '555555555555', grade_level: 10 } }
      }
    });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    // Cleanup
    if (studentId) await prisma.behaviorLog.deleteMany({ where: { student_id: studentId } });
    const userIds = [reporterUserId, otherReporterUserId, principalUserId, studentUserId].filter(Boolean) as string[];
    if (userIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: userIds } } });
      await prisma.staff.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.student.deleteMany({ where: { user_id: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it('POST /api/student-services/behavior - should create behavior log by authorized reporter', async () => {
    const res = await request(app)
      .post('/api/student-services/behavior')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({
        studentId: studentId,
        type: 'Minor Offense',
        date: new Date().toISOString(),
        note: 'Talking during class.'
      });
      
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student_id).toBe(studentId);
    expect(res.body.data.reported_by).toBe(reporterUserId);
    expect(res.body.data.status).toBe('Reported'); // default status
    
    behaviorLogId = res.body.data.id;

    // Verify Audit Log
    const audit = await prisma.auditLog.findFirst({
      where: { resource_id: behaviorLogId, action: 'BEHAVIOR_LOG_CREATED' }
    });
    expect(audit).toBeTruthy();
    expect(audit?.actor_user_id).toBe(reporterUserId);
  });

  it('GET /api/student-services/behavior - should return behavior logs with reporter name and student name', async () => {
    const res = await request(app)
      .get('/api/student-services/behavior')
      .set('Authorization', `Bearer ${reporterToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const logs = res.body.data;
    expect(Array.isArray(logs)).toBe(true);
    
    const myLog = logs.find((l: any) => l.id === behaviorLogId);
    expect(myLog).toBeTruthy();
    expect(myLog.reporter_name).toBe('Rep Orter');
    expect(myLog.studentName).toBe('Student Behav');
  });

  it('GET /api/student-services/behavior/:studentId - should return logs scoped to student', async () => {
    const res = await request(app)
      .get(`/api/student-services/behavior/${studentId}`)
      .set('Authorization', `Bearer ${reporterToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].student_id).toBe(studentId);
    expect(res.body.data[0].reporter_name).toBe('Rep Orter');
  });

  it('GET /api/student-services/behavior - unauthorized user should get 403', async () => {
    const res = await request(app)
      .get('/api/student-services/behavior')
      .set('Authorization', `Bearer ${studentToken}`); // students don't have guidance:read
      
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('PATCH /api/student-services/behavior/:id/status - should allow owner to update status', async () => {
    const res = await request(app)
      .patch(`/api/student-services/behavior/${behaviorLogId}/status`)
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ status: 'Resolved' });
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Resolved');
    
    // Characterize that NO audit log is created for PATCH behavior status
    const audit = await prisma.auditLog.findFirst({
      where: { resource_id: behaviorLogId, action: 'BEHAVIOR_LOG_UPDATED' }
    });
    expect(audit).toBeNull();
  });

  it('PATCH /api/student-services/behavior/:id/status - should reject non-owner without global view', async () => {
    const res = await request(app)
      .patch(`/api/student-services/behavior/${behaviorLogId}/status`)
      .set('Authorization', `Bearer ${otherReporterToken}`)
      .send({ status: 'Closed' });
      
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/only update your own/);
  });

  it('PATCH /api/student-services/behavior/:id/status - should allow global viewer (Principal) to update', async () => {
    const res = await request(app)
      .patch(`/api/student-services/behavior/${behaviorLogId}/status`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ status: 'Archived' });
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Archived');
  });
});
