import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

describe('Phase 5D: Principal Behavioral Reports Authorization & Read Workflow', () => {
  let principalToken: string;
  let principalUserId: string;

  let studentToken: string;
  let studentUserId: string;
  let studentId: string;

  let reporterUserId: string;
  let reporterToken: string;

  let testRolePrincipalId: string;
  let testRoleStudentId: string;
  let testRoleReporterId: string;

  let behaviorLogId: string;

  beforeAll(async () => {
    // Cleanup any orphaned test entities from previous runs
    try {
      const existingUsers = await prisma.user.findMany({
        where: { email: { in: ['prin_behav_test@calulut.edu.ph', 'stud_behav_test@calulut.edu.ph', 'rep_behav_test@calulut.edu.ph'] } }
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
        name: 'TestPrincipalBehavRole',
        role_permissions: {
          create: [{ permission_id: permRead.id }] // ONLY behavior:read — strictly NO behavior:write
        }
      }
    });

    testRoleReporterId = generateId();
    await prisma.role.create({
      data: {
        id: testRoleReporterId,
        name: 'TestReporterBehavRole',
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
        name: 'TestStudentBehavRole'
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

    // 3. Create Student User & Record
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

    // 4. Seed a genuine BehaviorLog record
    behaviorLogId = generateId();
    await prisma.behaviorLog.create({
      data: {
        id: behaviorLogId,
        student_id: studentId,
        type: 'Classroom Disruption',
        date: new Date('2026-10-10T10:00:00.000Z'),
        status: 'Reported',
        note: 'Repeatedly interrupted instruction and spoke out of turn during class.',
        reported_by: reporterUserId
      }
    });
  });

  afterAll(async () => {
    try {
      if (behaviorLogId) {
        await prisma.behaviorLog.deleteMany({ where: { id: behaviorLogId } });
      }
      const uids = [principalUserId, reporterUserId, studentUserId].filter(Boolean);
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

    const match = res.body.data.find((l: any) => l.id === behaviorLogId);
    expect(match).toBeTruthy();
    expect(match.studentName).toBe('Juan Dela Cruz');
    expect(match.reporter_name).toBe('Maria Clara');
    expect(match.type).toBe('Classroom Disruption');
    expect(match.status).toBe('Reported');
    expect(match.note).toBe('Repeatedly interrupted instruction and spoke out of turn during class.');
  });

  it('GET /api/student-services/behavior/:studentId - Principal read scoped to student returns 200', async () => {
    const res = await request(app)
      .get(`/api/student-services/behavior/${studentId}`)
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].student_id).toBe(studentId);
    expect(res.body.data[0].reporter_name).toBe('Maria Clara');
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
      .patch(`/api/student-services/behavior/${behaviorLogId}/status`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ status: 'Resolved' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
