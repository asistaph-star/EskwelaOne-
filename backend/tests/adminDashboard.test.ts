import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/app';
import prisma from '../src/config/database';
import { generateId } from '../src/common/utils/uuid';
import { hashPassword } from '../src/auth/auth.service';
import { startOfDay, subDays } from 'date-fns';

describe('Phase 5D: Principal Dashboard Aggregation API', () => {
  let principalToken: string;
  let teacherToken: string;
  let testYearId: string;

  beforeAll(async () => {
    // 1. Create Principal User
    const principalId = generateId();
    await prisma.user.create({
      data: {
        id: principalId,
        email: 'dashboard_principal@test.com',
        password_hash: await hashPassword('password123'),
        first_name: 'Dashboard',
        last_name: 'Principal',
        status: 'active'
      }
    });

    const pRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (pRole) {
      await prisma.userRole.create({
        data: { user_id: principalId, role_id: pRole.id }
      });
    }

    // 2. Create a Teacher User (should not have access if missing permissions, but teacher might have user:read. Wait, user:read is allowed for Teacher in this system. Let's test with someone who lacks it, or just verify the endpoint contract)
    const teacherId = generateId();
    await prisma.user.create({
      data: {
        id: teacherId,
        email: 'dashboard_teacher@test.com',
        password_hash: await hashPassword('password123'),
        first_name: 'Dashboard',
        last_name: 'Teacher',
        status: 'active'
      }
    });

    const tRole = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    if (tRole) {
      await prisma.userRole.create({
        data: { user_id: teacherId, role_id: tRole.id }
      });
    }

    // 3. Login to get tokens
    let res = await request(app).post('/api/auth/login').send({ email: 'dashboard_principal@test.com', password: 'password123' });
    if (!res.body.success) console.error("Principal Login failed:", res.body);
    principalToken = res.headers['set-cookie'] ? res.headers['set-cookie'][0] : '';

    res = await request(app).post('/api/auth/login').send({ email: 'dashboard_teacher@test.com', password: 'password123' });
    if (!res.body.success) console.error("Teacher Login failed:", res.body);
    teacherToken = res.headers['set-cookie'] ? res.headers['set-cookie'][0] : '';

    // 4. Create an Academic Year
    testYearId = generateId();
    await prisma.academicYear.create({
      data: {
        id: testYearId,
        name: 'Dashboard Test Year',
        start_date: new Date('2025-01-01'),
        end_date: new Date('2025-12-31'),
        is_current: true
      }
    });

    // 5. Create some students & enrollments
    const student1Id = generateId();
    const student2Id = generateId();
    const userS1 = generateId();
    const userS2 = generateId();

    await prisma.user.createMany({
      data: [
        { id: userS1, email: 's1_dash@test.com', password_hash: '123', first_name: 'S1', last_name: 'Dash' },
        { id: userS2, email: 's2_dash@test.com', password_hash: '123', first_name: 'S2', last_name: 'Dash' }
      ]
    });

    await prisma.student.createMany({
      data: [
        { id: student1Id, user_id: userS1, lrn: 'DASH_LRN1', grade_level: 7 },
        { id: student2Id, user_id: userS2, lrn: 'DASH_LRN2', grade_level: 8 }
      ]
    });

    const sectionId = generateId();
    await prisma.section.create({
      data: { id: sectionId, name: 'Dash Sec', grade_level: 7, academic_year_id: testYearId }
    });

    await prisma.enrollment.createMany({
      data: [
        { id: generateId(), student_id: student1Id, section_id: sectionId, academic_year_id: testYearId, status: 'Enrolled' },
        { id: generateId(), student_id: student2Id, section_id: sectionId, academic_year_id: testYearId, status: 'Enrolled' }
      ]
    });

    // 6. Create some Gate Attendance
    const today = new Date();
    const yesterday = subDays(today, 1);

    await prisma.gateAttendance.createMany({
      data: [
        { id: generateId(), student_id: student1Id, date: startOfDay(today), status: 'Present' },
        { id: generateId(), student_id: student1Id, date: startOfDay(yesterday), status: 'Present' },
      ]
    });

    // 7. Create Pending Leave Request
    await prisma.leaveRequest.create({
      data: {
        id: generateId(),
        user_id: teacherId,
        type: 'Sick Leave',
        start_date: new Date(),
        end_date: new Date(),
        days: 1,
        reason: 'Sick',
        status: 'Pending'
      }
    });

    // Wait for DB sync
    await new Promise(r => setTimeout(r, 100));
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: { contains: 'dashboard_' } } } });
    await prisma.leaveRequest.deleteMany({ where: { user: { email: { contains: 'dashboard_' } } } });
    await prisma.gateAttendance.deleteMany({ where: { student: { user: { email: { contains: '_dash' } } } } });
    await prisma.enrollment.deleteMany({ where: { academic_year_id: testYearId } });
    await prisma.section.deleteMany({ where: { academic_year_id: testYearId } });
    await prisma.student.deleteMany({ where: { user: { email: { contains: '_dash' } } } });
    await prisma.userRole.deleteMany({ where: { user: { email: { contains: 'dashboard_' } } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'dashboard_' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 's1_dash' } } });
    await prisma.user.deleteMany({ where: { email: { contains: 's2_dash' } } });
    await prisma.academicYear.deleteMany({ where: { id: testYearId } });
  });

  it('should prevent unauthenticated access', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('should return aggregated data for Principal', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Cookie', principalToken);
    
    if (res.status !== 200) console.error("Dashboard endpoint failed:", res.body);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enrolledStudents');
    expect(res.body).toHaveProperty('totalTeachers');
    expect(res.body).toHaveProperty('gateToday');
    expect(res.body).toHaveProperty('pendingApprovals');
    expect(res.body).toHaveProperty('gateTrend');
    
    expect(typeof res.body.enrolledStudents).toBe('number');
    expect(res.body.enrolledStudents).toBeGreaterThanOrEqual(0);
    
    expect(typeof res.body.totalTeachers).toBe('number');
    expect(typeof res.body.gateToday).toBe('number');
    expect(typeof res.body.pendingApprovals).toBe('number');
    expect(res.body.pendingApprovals).toBeGreaterThanOrEqual(1);

    expect(Array.isArray(res.body.gateTrend)).toBe(true);
    expect(res.body.gateTrend.length).toBe(7);
    expect(res.body.gateTrend[0]).toHaveProperty('date');
    expect(res.body.gateTrend[0]).toHaveProperty('count');
  });
});
