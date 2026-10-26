import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { generateId } from '../src/common/utils/uuid';
import bcrypt from 'bcrypt';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

describe('Phase 5D: Principal Dashboard Aggregation API', () => {
  let principalToken: string;
  let studentToken: string;
  
  // Set TZ to UTC to prevent date-fns from creating local-time boundaries that span two UTC days in the DB
  process.env.TZ = 'UTC';
  
  // Use a completely isolated date far in the past to avoid concurrent test interference
  const mockNow = new Date('2020-05-15T12:00:00Z');
  
  let baselineEnrollments = 0;
  let baselineTeachers = 0;
  let baselineGateToday = 0;
  let baselinePendingLeaves = 0;
  let baselineGateTrend: number[] = Array(7).fill(0);

  const pEmail = 'dashboard_principal_' + Date.now() + '@dash.com';
  const sEmail = 'dashboard_student_' + Date.now() + '@dash.com';
  let principalId = generateId();
  let studentUserId = generateId();
  let tEmail = 'dashboard_teacher_' + Date.now() + '@dash.com';
  let teacherId = generateId();
  let studentId = generateId();

  // Keep references to clean up easily
  const cleanupIds = {
    users: [principalId, studentUserId, teacherId],
    roles: [],
    academicYears: [],
    sections: [],
    students: [studentId],
    teachers: [],
    enrollments: [],
    gate: [],
    leaves: []
  };

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(mockNow);

    const now = mockNow;

    // Create Principal and Student users for Auth
    await prisma.user.createMany({
      data: [
        { id: principalId, school_id: `SCH-P-${principalId.slice(-6)}`, email: pEmail, password_hash: await bcrypt.hash('password123', 10), status: 'active', first_name: 'P', last_name: 'P' },
        { id: studentUserId, school_id: `SCH-S-${studentUserId.slice(-6)}`, email: sEmail, password_hash: await bcrypt.hash('password123', 10), status: 'active', first_name: 'S', last_name: 'S' },
        { id: teacherId, school_id: `SCH-T-${teacherId.slice(-6)}`, email: tEmail, password_hash: await bcrypt.hash('password123', 10), status: 'active', first_name: 'T', last_name: 'T' }
      ]
    });

    
    let pRoleObj = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (!pRoleObj) pRoleObj = await prisma.role.create({ data: { id: generateId(), name: 'Principal' } });
    let sRoleObj = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!sRoleObj) sRoleObj = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });
    let tRoleObj = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    if (!tRoleObj) tRoleObj = await prisma.role.create({ data: { id: generateId(), name: 'Teacher' } });

    await prisma.userRole.createMany({
      data: [
        { user_id: principalId, role_id: pRoleObj.id },
        { user_id: studentUserId, role_id: sRoleObj.id },
        { user_id: teacherId, role_id: tRoleObj.id }
      ]
    });


    // Generate tokens
    const pRes = await request(app).post('/api/auth/login').send({ schoolId: `SCH-P-${principalId.slice(-6)}`, password: 'password123' });
    principalToken = pRes.headers['set-cookie'] ? pRes.headers['set-cookie'][0] : '';
    const sRes = await request(app).post('/api/auth/login').send({ schoolId: `SCH-S-${studentUserId.slice(-6)}`, password: 'password123' });
    studentToken = sRes.headers['set-cookie'] ? sRes.headers['set-cookie'][0] : '';

    // Measure Baselines FIRST
    const currentAy = await prisma.academicYear.findFirst({ where: { is_current: true } });
    if (currentAy) {
      baselineEnrollments = await prisma.enrollment.count({ where: { academic_year_id: currentAy.id, status: 'Enrolled' } });
    }
    baselineTeachers = await prisma.teacher.count();
    
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    baselineGateToday = await prisma.gateAttendance.count({ where: { date: { gte: todayStart, lte: todayEnd } } });
    baselinePendingLeaves = await prisma.leaveRequest.count({ where: { status: 'Pending' } });

    for (let i = 6; i >= 0; i--) {
      const d = subDays(now, i);
      const start = startOfDay(d);
      const end = endOfDay(d);
      baselineGateTrend[6-i] = await prisma.gateAttendance.count({
        where: { date: { gte: start, lte: end } }
      });
    }

    // Now inject exactly what we expect
    let testYearId = currentAy ? currentAy.id : generateId();
    if (!currentAy) {
      await prisma.academicYear.create({
        data: { id: testYearId, name: 'AY ' + generateId(), start_date: new Date(), end_date: new Date(), is_current: true }
      });
      cleanupIds.academicYears.push(testYearId);
    }
    const nonCurrentYearId = generateId();
    await prisma.academicYear.create({
      data: { id: nonCurrentYearId, name: 'AY ' + generateId(), start_date: new Date(), end_date: new Date(), is_current: false }
    });
    cleanupIds.academicYears.push(nonCurrentYearId);

    const s2UserId = generateId(); const s3UserId = generateId();
    cleanupIds.users.push(s2UserId, s3UserId);
    await prisma.user.createMany({
      data: [
        { id: s2UserId, school_id: 'SCH-S2-' + s2UserId.slice(-6), email: 'dash_s2' + Date.now() + '@dash.com', password_hash: '123', status: 'Active', first_name: 'S2', last_name: 'S2' },
        { id: s3UserId, school_id: 'SCH-S3-' + s3UserId.slice(-6), email: 'dash_s3' + Date.now() + '@dash.com', password_hash: '123', status: 'Active', first_name: 'S3', last_name: 'S3' }
      ]
    });

    const s2Id = generateId(); const s3Id = generateId();
    cleanupIds.students.push(s2Id, s3Id);
    await prisma.student.createMany({ data: [
      { id: studentId, user_id: studentUserId, lrn: 'L1' + Date.now(), grade_level: 7 },
      { id: s2Id, user_id: s2UserId, lrn: 'L2' + Date.now(), grade_level: 8 },
      { id: s3Id, user_id: s3UserId, lrn: 'L3' + Date.now(), grade_level: 9 }
    ]});

    const secId = generateId();
    cleanupIds.sections.push(secId);
    await prisma.section.create({ data: { id: secId, name: 'Dash Sec ' + Date.now(), grade_level: 7, academic_year_id: testYearId } });

    const e1 = generateId(); const e2 = generateId(); const e3 = generateId();
    cleanupIds.enrollments.push(e1, e2, e3);
    await prisma.enrollment.createMany({ data: [
      { id: e1, student_id: studentId, section_id: secId, academic_year_id: testYearId, status: 'Enrolled' },
      { id: e2, student_id: s2Id, section_id: secId, academic_year_id: testYearId, status: 'Enrolled' },
      { id: e3, student_id: s3Id, section_id: secId, academic_year_id: nonCurrentYearId, status: 'Enrolled' }
    ]});

    const tRealId = generateId(); const t2Id = generateId();
    cleanupIds.teachers.push(tRealId, t2Id);
    await prisma.teacher.createMany({ data: [
      { id: tRealId, user_id: teacherId, employee_id: 'T1' + Date.now(), department: 'Math' },
      { id: t2Id, user_id: principalId, employee_id: 'T2' + Date.now(), department: 'Science' } // Reusing principal user for simplicity
    ]});

    // Gate Attendance
    const yestStart = startOfDay(subDays(now, 1));
    const sixStart = startOfDay(subDays(now, 6));

    const g1 = generateId(), g2 = generateId(), g3 = generateId(), g4 = generateId(), g5 = generateId(), g6 = generateId();
    cleanupIds.gate.push(g1, g2, g3, g4, g5, g6);
    await prisma.gateAttendance.createMany({ data: [
      { id: g1, student_id: studentId, date: todayStart, status: 'Present' },
      { id: g2, student_id: s2Id, date: todayStart, status: 'Present' },
      { id: g3, student_id: s3Id, date: todayStart, status: 'Present' },
      { id: g4, student_id: studentId, date: yestStart, status: 'Present' },
      { id: g5, student_id: s2Id, date: sixStart, status: 'Present' },
      { id: g6, student_id: s3Id, date: sixStart, status: 'Present' }
    ]});

    // Leave Requests
    const l1 = generateId(), l2 = generateId(), l3 = generateId();
    cleanupIds.leaves.push(l1, l2, l3);
    await prisma.leaveRequest.createMany({ data: [
      { id: l1, user_id: teacherId, type: 'Sick', start_date: now, end_date: now, days: 1, reason: 'r1', status: 'Pending' },
      { id: l2, user_id: teacherId, type: 'Vacation', start_date: now, end_date: now, days: 1, reason: 'r2', status: 'Pending' },
      { id: l3, user_id: teacherId, type: 'Personal', start_date: now, end_date: now, days: 1, reason: 'r3', status: 'Approved' }
    ]});
  });

  afterAll(async () => {
    vi.useRealTimers();
    // Targeted cleanups using our specific IDs to avoid deleting records from parallel tests
    try {
      if (cleanupIds.gate.length) await prisma.gateAttendance.deleteMany({ where: { id: { in: cleanupIds.gate } } });
      if (cleanupIds.leaves.length) await prisma.leaveRequest.deleteMany({ where: { id: { in: cleanupIds.leaves } } });
      if (cleanupIds.enrollments.length) await prisma.enrollment.deleteMany({ where: { id: { in: cleanupIds.enrollments } } });
      if (cleanupIds.students.length) await prisma.student.deleteMany({ where: { id: { in: cleanupIds.students } } });
      if (cleanupIds.teachers.length) await prisma.teacher.deleteMany({ where: { id: { in: cleanupIds.teachers } } });
      if (cleanupIds.sections.length) await prisma.section.deleteMany({ where: { id: { in: cleanupIds.sections } } });
      if (cleanupIds.academicYears.length) await prisma.academicYear.deleteMany({ where: { id: { in: cleanupIds.academicYears } } });
      if (cleanupIds.users.length) await prisma.userRole.deleteMany({ where: { user_id: { in: cleanupIds.users } } });
      
      // Audit logs often reference users, so we must delete them first before users
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: cleanupIds.users } } });
      if (cleanupIds.users.length) await prisma.user.deleteMany({ where: { id: { in: cleanupIds.users } } });
    } catch (e) {
      console.error("Dashboard Cleanup Error:", e);
    }
  });

  it('should prevent unauthenticated access', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('should prevent unauthorized access (e.g. Student role)', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', studentToken);
    expect(res.status).toBe(403);
  });

  it('should return exactly controlled aggregate numbers for Principal', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', principalToken);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    const data = res.body.data;
    const now = mockNow;
    
    // Enrollment: 2 matching active year
    expect(data.enrolledStudents).toBe(baselineEnrollments + 2);
    
    // Teachers: 2
    expect(data.totalTeachers).toBe(baselineTeachers + 2);
    
    // Active Sections: type check
    expect(typeof data.activeSections).toBe('number');
    
    // Gate Today: 3
    expect(data.gateToday).toBe(baselineGateToday + 3);
    
    // Pending Leaves: 2
    expect(data.pendingApprovals).toBe(baselinePendingLeaves + 2);
    
    // Gate Trend
    expect(Array.isArray(data.gateTrend)).toBe(true);
    expect(data.gateTrend.length).toBe(7);

    const oldest = data.gateTrend[0];
    expect(oldest.date).toBe(format(subDays(now, 6), 'MMM dd'));
    expect(oldest.count).toBe(baselineGateTrend[0] + 2);

    const yesterday = data.gateTrend[5];
    expect(yesterday.date).toBe(format(subDays(now, 1), 'MMM dd'));
    expect(yesterday.count).toBe(baselineGateTrend[5] + 1);

    const todayDay = data.gateTrend[6];
    expect(todayDay.date).toBe(format(now, 'MMM dd'));
    expect(todayDay.count).toBe(baselineGateTrend[6] + 3);
  });
});
