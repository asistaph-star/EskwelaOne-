import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

describe('Phase 5D: Principal Behavioral Reports Authorization, Aggregates & Read Workflow', () => {
  let principalToken: string;
  let principalUserId: string;

  let studentToken: string;
  let studentUserId: string;
  let studentId: string;

  let studentUserId2: string;
  let studentId2: string;

  let reporterUserId: string;
  let reporterToken: string;

  let testRolePrincipalId: string;
  let testRoleStudentId: string;
  let testRoleReporterId: string;

  let behaviorLogId1: string;
  let behaviorLogId2: string;
  let behaviorLogId3: string;

  beforeAll(async () => {
    // Cleanup any orphaned test entities from previous runs
    try {
      const existingUsers = await prisma.user.findMany({
        where: { email: { in: ['prin_behav_test@calulut.edu.ph', 'stud_behav_test@calulut.edu.ph', 'stud_behav_test2@calulut.edu.ph', 'rep_behav_test@calulut.edu.ph'] } }
      });
      if (existingUsers.length > 0) {
        const uids = existingUsers.map(u => u.id);
        await prisma.behaviorLog.deleteMany({ where: { reported_by: { in: uids } } });
        await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: uids } } });
        await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.student.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.user.deleteMany({ where: { id: { in: uids } } });
      }
    } catch (_err) {}

    const password_hash = await bcrypt.hash('Password123!', 10);

    // Ensure permissions exist in database
    const permRead = await prisma.permission.upsert({
      where: { key: 'behavior:read' },
      update: {},
      create: { id: generateId(), key: 'behavior:read' }
    });

    const permWrite = await prisma.permission.upsert({
      where: { key: 'behavior:write' },
      update: {},
      create: { id: generateId(), key: 'behavior:write' }
    });

    // Create isolated test-specific roles to strictly control permission boundaries
    testRolePrincipalId = generateId();
    await prisma.role.create({
      data: {
        id: testRolePrincipalId,
        name: 'TestPrincipalBehavRole_' + Date.now(),
        role_permissions: {
          create: [{ permission_id: permRead.id }] // ONLY behavior:read — strictly NO behavior:write
        }
      }
    });

    testRoleReporterId = generateId();
    await prisma.role.create({
      data: {
        id: testRoleReporterId,
        name: 'TestReporterBehavRole_' + Date.now(),
        role_permissions: {
          create: [
            { permission_id: permRead.id },
            { permission_id: permWrite.id } // Guidance/Reporter has behavior:write
          ]
        }
      }
    });

    testRoleStudentId = generateId();
    await prisma.role.create({
      data: {
        id: testRoleStudentId,
        name: 'TestStudentBehavRole_' + Date.now()
        // No behavior permissions
      }
    });

    // 1. Create Principal User (Canonical permissions: behavior:read only)
    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId,
        email: 'prin_behav_test@calulut.edu.ph',
        password_hash,
        first_name: 'Principal',
        last_name: 'Santos',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: testRolePrincipalId } },
        staff: { create: { id: generateId(), employee_id: 'PRIN-BEHAV-01', position: 'Principal', department: 'Administration' } }
      }
    });
    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 2. Create Reporter User (Faculty / Guidance with behavior:write)
    reporterUserId = generateId();
    await prisma.user.create({
      data: {
        id: reporterUserId,
        email: 'rep_behav_test@calulut.edu.ph',
        password_hash,
        first_name: 'Maria',
        last_name: 'Clara',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: testRoleReporterId } },
        staff: { create: { id: generateId(), employee_id: 'REP-BEHAV-01', position: 'Counselor', department: 'Guidance' } }
      }
    });
    reporterToken = sign({ userId: reporterUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 3. Create Student User 1 & Record
    studentUserId = generateId();
    studentId = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId,
        email: 'stud_behav_test@calulut.edu.ph',
        password_hash,
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: testRoleStudentId } },
        student: { create: { id: studentId, lrn: '123456789012', grade_level: 9 } }
      }
    });
    studentToken = sign({ userId: studentUserId }, config.jwt.secret, { expiresIn: '1h' });

    // 4. Create Student User 2 & Record (to test distinct student count aggregate)
    studentUserId2 = generateId();
    studentId2 = generateId();
    await prisma.user.create({
      data: {
        id: studentUserId2,
        email: 'stud_behav_test2@calulut.edu.ph',
        password_hash,
        first_name: 'Pedro',
        last_name: 'Penduko',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: testRoleStudentId } },
        student: { create: { id: studentId2, lrn: '987654321098', grade_level: 10 } }
      }
    });

    // 5. Seed controlled BehaviorLog records with exact canonical statuses:
    // Record 1: Student 1, status = 'Reported'
    behaviorLogId1 = generateId();
    await prisma.behaviorLog.create({
      data: {
        id: behaviorLogId1,
        student_id: studentId,
        type: 'Classroom Disruption',
        date: new Date('2026-10-10T10:00:00.000Z'),
        status: 'Reported',
        note: 'Repeatedly interrupted instruction and spoke out of turn during class.',
        reported_by: reporterUserId
      }
    });

    // Record 2: Student 1, status = 'Under investigation'
    behaviorLogId2 = generateId();
    await prisma.behaviorLog.create({
      data: {
        id: behaviorLogId2,
        student_id: studentId,
        type: 'Bullying',
        date: new Date('2026-10-10T11:00:00.000Z'),
        status: 'Under investigation',
        note: 'Verbal harassment complaint filed and under inquiry.',
        reported_by: reporterUserId
      }
    });

    // Record 3: Student 2, status = 'Resolved'
    behaviorLogId3 = generateId();
    await prisma.behaviorLog.create({
      data: {
        id: behaviorLogId3,
        student_id: studentId2,
        type: 'Tardiness',
        date: new Date('2026-10-10T12:00:00.000Z'),
        status: 'Resolved',
        note: 'Addressed through counseling session with parents.',
        reported_by: reporterUserId
      }
    });
  });

  afterAll(async () => {
    try {
      const logIds = [behaviorLogId1, behaviorLogId2, behaviorLogId3].filter(Boolean);
      if (logIds.length > 0) {
        await prisma.behaviorLog.deleteMany({ where: { id: { in: logIds } } });
      }
      const uids = [principalUserId, reporterUserId, studentUserId, studentUserId2].filter(Boolean);
      if (uids.length > 0) {
        await prisma.behaviorLog.deleteMany({ where: { reported_by: { in: uids } } });
        await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: uids } } });
        await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.student.deleteMany({ where: { user_id: { in: uids } } });
        await prisma.user.deleteMany({ where: { id: { in: uids } } });
      }
      const roleIds = [testRolePrincipalId, testRoleReporterId, testRoleStudentId].filter(Boolean);
      if (roleIds.length > 0) {
        await prisma.rolePermission.deleteMany({ where: { role_id: { in: roleIds } } });
        await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
      }
    } catch (_err) {}
    await prisma.$disconnect();
  });

  it('GET /api/student-services/behavior - Principal read with behavior:read returns 200 and real records', async () => {
    const res = await request(app)
      .get('/api/student-services/behavior')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const match1 = res.body.data.find((l: any) => l.id === behaviorLogId1);
    expect(match1).toBeTruthy();
    expect(match1.studentName).toBe('Juan Dela Cruz');
    expect(match1.reporter_name).toBe('Maria Clara');
    expect(match1.type).toBe('Classroom Disruption');
    expect(match1.status).toBe('Reported');

    const match3 = res.body.data.find((l: any) => l.id === behaviorLogId3);
    expect(match3).toBeTruthy();
    expect(match3.studentName).toBe('Pedro Penduko');
    expect(match3.status).toBe('Resolved');
  });

  it('GET /api/student-services/behavior/summary - Database-wide aggregates are computed accurately', async () => {
    const res = await request(app)
      .get('/api/student-services/behavior/summary')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const summary = res.body.data;

    // Total incidents must be >= 3 (from our seeded records)
    expect(summary.total).toBeGreaterThanOrEqual(3);

    // Distinct students must be >= 2 (Juan Dela Cruz and Pedro Penduko)
    expect(summary.studentsCount).toBeGreaterThanOrEqual(2);

    // Status counts must accurately reflect persisted canonical values
    expect(summary.statusCounts['Reported']).toBeGreaterThanOrEqual(1);
    expect(summary.statusCounts['Under investigation']).toBeGreaterThanOrEqual(1);
    expect(summary.statusCounts['Resolved']).toBeGreaterThanOrEqual(1);

    // Convenience fields must match status counts
    expect(summary.reported).toBeGreaterThanOrEqual(1);
    expect(summary.underInvestigation).toBeGreaterThanOrEqual(1);
    expect(summary.resolved).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/student-services/behavior/summary - Unauthenticated request returns 401', async () => {
    const res = await request(app)
      .get('/api/student-services/behavior/summary');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/student-services/behavior/summary - Unauthorized role (Student) returns 403', async () => {
    const res = await request(app)
      .get('/api/student-services/behavior/summary')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/student-services/behavior/:studentId - Principal read scoped to student returns 200', async () => {
    const res = await request(app)
      .get(`/api/student-services/behavior/${studentId}`)
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.every((l: any) => l.student_id === studentId)).toBe(true);
  });

  it('GET /api/student-services/behavior - Unauthenticated request returns 401', async () => {
    const res = await request(app)
      .get('/api/student-services/behavior');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/student-services/behavior - Unauthorized role (Student without behavior:read) returns 403', async () => {
    const res = await request(app)
      .get('/api/student-services/behavior')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/student-services/behavior - Principal mutation (create) without behavior:write returns 403', async () => {
    const res = await request(app)
      .post('/api/student-services/behavior')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        studentId: studentId,
        type: 'Insubordination',
        date: new Date().toISOString(),
        note: 'Attempting to create incident log as Principal'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('PATCH /api/student-services/behavior/:id/status - Principal mutation (status update) without behavior:write returns 403', async () => {
    const res = await request(app)
      .patch(`/api/student-services/behavior/${behaviorLogId1}/status`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ status: 'Resolved' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
