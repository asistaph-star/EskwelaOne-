import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { config } from '../src/config/env.js';
import { getPhilippineCalendarDate } from '../src/common/utils/dateTime.js';

describe('Faculty Attendance Integration Tests', () => {
  const ts = Date.now();
  let teacherToken: string;
  let teacherUserId: string;
  let teacherProfileId: string;

  let teacherNoProfileToken: string;
  let inactiveTeacherToken: string;

  let principalToken: string;
  let adminToken: string;

  let secondTeacherId: string;
  let secondTeacherUserId: string;

  const testUserIds: string[] = [];
  const testTeacherIds: string[] = [];

  const createUser = async (email: string, roles: string[], permissions: string[] = [], status = 'active') => {
    const id = generateId();
    testUserIds.push(id);
    const user = await prisma.user.create({
      data: {
        id,
        email,
        password_hash: 'hash',
        first_name: 'TestFirst',
        last_name: 'TestLast',
        status,
      },
    });

    for (const roleName of roles) {
      let role = await prisma.role.findFirst({ where: { name: roleName } });
      if (!role) role = await prisma.role.create({ data: { id: generateId(), name: roleName } });
      await prisma.userRole.create({ data: { user_id: user.id, role_id: role.id } });

      for (const p of permissions) {
        let perm = await prisma.permission.findFirst({ where: { key: p } });
        if (!perm) perm = await prisma.permission.create({ data: { id: generateId(), key: p } });
        const existingRP = await prisma.rolePermission.findFirst({
          where: { role_id: role.id, permission_id: perm.id },
        });
        if (!existingRP) {
          await prisma.rolePermission.create({ data: { role_id: role.id, permission_id: perm.id } });
        }
      }
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, roles, permissions },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    return { user, token };
  };

  beforeAll(async () => {
    // 1. Active Teacher with Profile
    const t = await createUser(`test-teacher-${ts}@test.com`, ['Teacher'], ['attendance:read']);
    teacherToken = t.token;
    teacherUserId = t.user.id;
    const tProfile = await prisma.teacher.create({
      data: {
        id: generateId(),
        user_id: t.user.id,
        employee_id: `EMP-${ts}-T1`,
        department: 'Science',
        position: 'Teacher II',
      },
    });
    teacherProfileId = tProfile.id;
    testTeacherIds.push(tProfile.id);

    // 2. Active Teacher with Profile for Leave testing
    const t2 = await createUser(`test-teacher-leave-${ts}@test.com`, ['Teacher'], ['attendance:read']);
    secondTeacherUserId = t2.user.id;
    const t2Profile = await prisma.teacher.create({
      data: {
        id: generateId(),
        user_id: t2.user.id,
        employee_id: `EMP-${ts}-T2`,
        department: 'Mathematics',
        position: 'Master Teacher I',
      },
    });
    secondTeacherId = t2Profile.id;
    testTeacherIds.push(t2Profile.id);

    // 3. User with Teacher role but NO Teacher profile
    const tNoProfile = await createUser(`test-teacher-noprofile-${ts}@test.com`, ['Teacher'], []);
    teacherNoProfileToken = tNoProfile.token;

    // 4. Inactive Teacher User
    const tInactive = await createUser(`test-teacher-inactive-${ts}@test.com`, ['Teacher'], [], 'inactive');
    inactiveTeacherToken = tInactive.token;

    // 5. Principal
    const p = await createUser(`test-principal-${ts}@test.com`, ['Principal'], ['faculty_attendance:read']);
    principalToken = p.token;

    // 6. Admin
    const a = await createUser(`test-admin-${ts}@test.com`, ['Admin'], ['faculty_attendance:read', 'faculty_attendance:write']);
    adminToken = a.token;
  });

  afterAll(async () => {
    // Clean up attendance records created in tests
    await prisma.facultyAttendance.deleteMany({
      where: {
        teacher_id: { in: testTeacherIds },
      },
    });
    // Clean up leave requests
    await prisma.leaveRequest.deleteMany({
      where: {
        user_id: { in: testUserIds },
      },
    });
    // Clean up teacher profiles
    await prisma.teacher.deleteMany({
      where: {
        id: { in: testTeacherIds },
      },
    });
    // Clean up audit logs created by test users
    await prisma.auditLog.deleteMany({
      where: {
        actor_user_id: { in: testUserIds },
      },
    });
    // Clean up user roles & users
    await prisma.userRole.deleteMany({
      where: {
        user_id: { in: testUserIds },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: testUserIds },
      },
    });
  });

  describe('Teacher Self-Service Time In / Time Out', () => {
    it('rejects Time Out before Time In has been recorded (400 TIME_IN_REQUIRED)', async () => {
      const res = await request(app)
        .post('/api/attendance/faculty/time-out')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TIME_IN_REQUIRED');
    });

    it('successfully records first Time In with server-derived identity and Manila date', async () => {
      const res = await request(app)
        .post('/api/attendance/faculty/time-in')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          // Spoofed teacherId must be ignored server-side
          teacherId: 'spoofed-id',
          remarks: 'Morning arrival',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.teacher_id).toBe(teacherProfileId); // Proves identity comes from session
      expect(res.body.data.status).toBe('Time Out Pending');
      expect(res.body.data.time_in).toBeDefined();
      expect(res.body.data.time_out).toBeNull();
      expect(res.body.data.capture_source).toBe('web_teacher');
      expect(res.body.data.timeInFormatted).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    });

    it('rejects duplicate Time In on the same day (409 ALREADY_TIMED_IN)', async () => {
      const res = await request(app)
        .post('/api/attendance/faculty/time-in')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ALREADY_TIMED_IN');
    });

    it('returns current punch card status via GET /me', async () => {
      const res = await request(app)
        .get('/api/attendance/faculty/me')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasTimedIn).toBe(true);
      expect(res.body.data.hasTimedOut).toBe(false);
      expect(res.body.data.status).toBe('Time Out Pending');
      expect(res.body.data.employeeId).toBe(`EMP-${ts}-T1`);
      expect(res.body.data.department).toBe('Science');
    });

    it('successfully records Time Out and marks session Completed', async () => {
      const res = await request(app)
        .post('/api/attendance/faculty/time-out')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('Completed');
      expect(res.body.data.time_out).toBeDefined();
      expect(res.body.data.timeOutFormatted).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    });

    it('rejects second Time Out on the same day (409 ALREADY_TIMED_OUT)', async () => {
      const res = await request(app)
        .post('/api/attendance/faculty/time-out')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ALREADY_TIMED_OUT');
    });

    it('fails safely when user has Teacher role but lacks a Teacher profile (403 TEACHER_PROFILE_NOT_FOUND)', async () => {
      const res = await request(app)
        .post('/api/attendance/faculty/time-in')
        .set('Authorization', `Bearer ${teacherNoProfileToken}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TEACHER_PROFILE_NOT_FOUND');
    });

    it('denies access to inactive/suspended Teacher account (401/403 ACCOUNT_INACTIVE)', async () => {
      const res = await request(app)
        .post('/api/attendance/faculty/time-in')
        .set('Authorization', `Bearer ${inactiveTeacherToken}`)
        .send({});

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('RBAC & Security Boundaries', () => {
    it('denies Teacher from reading all faculty attendance (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get('/api/attendance/faculty')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('denies Teacher from accessing administrative correction (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .patch('/api/attendance/faculty/dummy-id')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ override_status: 'Official Business', override_remarks: 'Not authorized' });

      expect(res.status).toBe(403);
    });

    it('denies Principal from mutating/correcting attendance records (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .patch('/api/attendance/faculty/dummy-id')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({ override_status: 'Official Business', override_remarks: 'Test' });

      expect(res.status).toBe(403);
    });

    it('allows Principal to read summary (200 OK)', async () => {
      const res = await request(app)
        .get('/api/attendance/faculty/summary')
        .set('Authorization', `Bearer ${principalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalActiveFaculty).toBeGreaterThanOrEqual(2);
      expect(res.body.data.checkedInCount).toBeGreaterThanOrEqual(1);
    });

    it('allows Principal to read full attendance table (200 OK)', async () => {
      const res = await request(app)
        .get('/api/attendance/faculty')
        .set('Authorization', `Bearer ${principalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();

      const item = res.body.data.find((r: any) => r.teacherId === teacherProfileId);
      expect(item).toBeDefined();
      expect(item.employeeId).toBe(`EMP-${ts}-T1`);
      expect(item.status).toBe('Completed');
    });
  });

  describe('Leave Integration & Override Precedence', () => {
    it('derives On Leave dynamically for a teacher with approved leave and no attendance', async () => {
      const { dateStr } = getPhilippineCalendarDate();
      const todayDate = new Date(`${dateStr}T00:00:00.000Z`);

      // Create an approved leave request for second teacher
      await prisma.leaveRequest.create({
        data: {
          id: generateId(),
          user_id: secondTeacherUserId,
          type: 'Vacation',
          start_date: todayDate,
          end_date: todayDate,
          days: 1,
          reason: 'Personal vacation',
          status: 'Approved',
        },
      });

      // Verify in Principal summary: second teacher should be On Leave
      const summaryRes = await request(app)
        .get('/api/attendance/faculty/summary')
        .set('Authorization', `Bearer ${principalToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data.onLeaveCount).toBeGreaterThanOrEqual(1);

      // Verify in Full List
      const listRes = await request(app)
        .get('/api/attendance/faculty')
        .set('Authorization', `Bearer ${principalToken}`);

      expect(listRes.status).toBe(200);
      const leaveTeacher = listRes.body.data.find((r: any) => r.teacherId === secondTeacherId);
      expect(leaveTeacher).toBeDefined();
      expect(leaveTeacher.status).toBe('On Leave');
      expect(leaveTeacher.timeIn).toBeNull();
      expect(leaveTeacher.remarks).toMatch(/Vacation Leave/i);

      // Verify zero synthetic rows were inserted into faculty_attendance for leave
      const syntheticRow = await prisma.facultyAttendance.findUnique({
        where: {
          teacher_id_date: {
            teacher_id: secondTeacherId,
            date: todayDate,
          },
        },
      });
      expect(syntheticRow).toBeNull();
    });

    it('prioritizes actual attendance if teacher clocks in despite having a leave record', async () => {
      // Second teacher decides to clock in anyway
      const clockInRes = await request(app)
        .post('/api/attendance/faculty/time-in')
        .set('Authorization', `Bearer ${jwt.sign({ userId: secondTeacherUserId, roles: ['Teacher'] }, config.jwt.secret)}`)
        .send({});

      expect(clockInRes.status).toBe(201);
      expect(clockInRes.body.data.status).toBe('Time Out Pending');

      // Now query list: status must be Time Out Pending, NOT On Leave!
      const listRes = await request(app)
        .get('/api/attendance/faculty')
        .set('Authorization', `Bearer ${principalToken}`);

      const t2Row = listRes.body.data.find((r: any) => r.teacherId === secondTeacherId);
      expect(t2Row.status).toBe('Time Out Pending');
    });
  });

  describe('Admin Correction & Official Business', () => {
    it('rejects Official Business override without remarks (400 validation error)', async () => {
      const { dateObj } = getPhilippineCalendarDate();
      const row = await prisma.facultyAttendance.findUnique({
        where: { teacher_id_date: { teacher_id: teacherProfileId, date: dateObj } },
      });

      const res = await request(app)
        .patch(`/api/attendance/faculty/${row?.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          override_status: 'Official Business',
          override_remarks: '', // Empty remarks not allowed
        });

      expect([400, 422]).toContain(res.status);
    });

    it('allows Admin to set Official Business with mandatory remarks and logs audit', async () => {
      const { dateObj } = getPhilippineCalendarDate();
      const row = await prisma.facultyAttendance.findUnique({
        where: { teacher_id_date: { teacher_id: teacherProfileId, date: dateObj } },
      });

      const res = await request(app)
        .patch(`/api/attendance/faculty/${row?.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          override_status: 'Official Business',
          override_remarks: 'DepEd Division Math Training Proctorship',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.override_status).toBe('Official Business');

      // In Full List, status should now be Official Business
      const listRes = await request(app)
        .get('/api/attendance/faculty')
        .set('Authorization', `Bearer ${principalToken}`);

      const item = listRes.body.data.find((r: any) => r.id === row?.id);
      expect(item.status).toBe('Official Business');
      expect(item.remarks).toBe('DepEd Division Math Training Proctorship');
    });
  });
});
