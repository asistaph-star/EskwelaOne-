import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import { generateId } from '../src/common/utils/uuid';
import bcrypt from 'bcrypt';

describe('Phase 5E: Principal Academic Analytics API', () => {
  let principalToken: string;
  let studentToken: string;
  let teacherToken: string;
  
  const pEmail = 'analytics_principal_' + Date.now() + '@dash.com';
  const sEmail = 'analytics_student_' + Date.now() + '@dash.com';
  const tEmail = 'analytics_teacher_' + Date.now() + '@dash.com';
  let principalId = generateId();
  let studentUserId = generateId();
  let teacherId = generateId();
  
  const cleanupIds = {
    users: [principalId, studentUserId, teacherId],
    roles: [] as string[],
    academicYears: [] as string[],
    sections: [] as string[],
    students: [] as string[],
    subjects: [] as string[],
    enrollments: [] as string[],
    grades: [] as string[]
  };

  beforeAll(async () => {
    // Auth Setup
    await prisma.user.createMany({
      data: [
        { id: principalId, email: pEmail, password_hash: await bcrypt.hash('password123', 10), status: 'active', first_name: 'P', last_name: 'P' },
        { id: studentUserId, email: sEmail, password_hash: await bcrypt.hash('password123', 10), status: 'active', first_name: 'S', last_name: 'S' },
        { id: teacherId, email: tEmail, password_hash: await bcrypt.hash('password123', 10), status: 'active', first_name: 'T', last_name: 'T' }
      ]
    });
    let pRoleObj = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (!pRoleObj) pRoleObj = await prisma.role.create({ data: { id: generateId(), name: 'Principal' } });
    
    // Ensure Principal has grade:read_all
    let gradeReadPerm = await prisma.permission.findFirst({ where: { key: 'grade:read_all' } });
    if (!gradeReadPerm) gradeReadPerm = await prisma.permission.create({ data: { id: generateId(), key: 'grade:read_all' } });
    
    const existingRolePerm = await prisma.rolePermission.findFirst({
      where: { role_id: pRoleObj.id, permission_id: gradeReadPerm.id }
    });
    if (!existingRolePerm) {
      await prisma.rolePermission.create({
        data: { id: generateId(), role_id: pRoleObj.id, permission_id: gradeReadPerm.id }
      });
    }

    let sRoleObj = await prisma.role.findFirst({ where: { name: 'Student' } });
    if (!sRoleObj) sRoleObj = await prisma.role.create({ data: { id: generateId(), name: 'Student' } });

    let tRoleObj = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    if (!tRoleObj) tRoleObj = await prisma.role.create({ data: { id: generateId(), name: 'Teacher' } });
    
    // Teacher gets user:read but not grade:read_all
    const existingTRolePerm = await prisma.rolePermission.findFirst({
      where: { role_id: tRoleObj.id, permission_id: gradeReadPerm.id }
    });
    if (existingTRolePerm) {
      await prisma.rolePermission.delete({ where: { id: existingTRolePerm.id } });
    }

    await prisma.userRole.createMany({
      data: [
        { user_id: principalId, role_id: pRoleObj.id },
        { user_id: studentUserId, role_id: sRoleObj.id },
        { user_id: teacherId, role_id: tRoleObj.id }
      ]
    });

    const pRes = await request(app).post('/api/auth/login').send({ email: pEmail, password: 'password123' });
    principalToken = pRes.headers['set-cookie'] ? pRes.headers['set-cookie'][0] : '';
    const sRes = await request(app).post('/api/auth/login').send({ email: sEmail, password: 'password123' });
    studentToken = sRes.headers['set-cookie'] ? sRes.headers['set-cookie'][0] : '';
    const tRes = await request(app).post('/api/auth/login').send({ email: tEmail, password: 'password123' });
    teacherToken = tRes.headers['set-cookie'] ? tRes.headers['set-cookie'][0] : '';

    // Data Setup
    let currentAy = await prisma.academicYear.findFirst({ where: { is_current: true } });
    if (!currentAy) {
      currentAy = await prisma.academicYear.create({
        data: { id: generateId(), name: 'AY ' + Date.now(), start_date: new Date(), end_date: new Date(), is_current: true }
      });
      cleanupIds.academicYears.push(currentAy.id);
    }

    const secId = generateId();
    cleanupIds.sections.push(secId);
    await prisma.section.create({ data: { id: secId, name: 'Analytics Section', grade_level: 10, academic_year_id: currentAy.id } });

    const studentId = generateId();
    cleanupIds.students.push(studentId);
    await prisma.student.create({ data: { id: studentId, user_id: studentUserId, lrn: 'L1' + Date.now(), grade_level: 10 } });

    const e1 = generateId();
    cleanupIds.enrollments.push(e1);
    await prisma.enrollment.create({ data: { id: e1, student_id: studentId, section_id: secId, academic_year_id: currentAy.id, status: 'Enrolled' } });

    const subId = generateId();
    cleanupIds.subjects.push(subId);
    await prisma.subject.create({ data: { id: subId, name: 'Analytics Math', code: 'MATH' + Date.now() } });

    const g1 = generateId();
    const g2 = generateId();
    const g3 = generateId();
    const g4 = generateId();
    cleanupIds.grades.push(g1, g2, g3, g4);
    await prisma.grade.createMany({ 
      data: [
        { id: g1, student_id: studentId, subject_id: subId, term: 'T1', term_grade: 85, academic_year_id: currentAy.id },
        { id: g2, student_id: studentId, subject_id: subId, term: 'T2', term_grade: 86, academic_year_id: currentAy.id },
        { id: g3, student_id: studentId, subject_id: subId, term: 'T3', term_grade: 87, academic_year_id: currentAy.id },
        { id: g4, student_id: studentId, subject_id: subId, term: 'T4', term_grade: 88, academic_year_id: currentAy.id }
      ]
    });
  });

  afterAll(async () => {
    try {
      if (cleanupIds.grades.length) await prisma.grade.deleteMany({ where: { id: { in: cleanupIds.grades } } });
      if (cleanupIds.enrollments.length) await prisma.enrollment.deleteMany({ where: { id: { in: cleanupIds.enrollments } } });
      if (cleanupIds.students.length) await prisma.student.deleteMany({ where: { id: { in: cleanupIds.students } } });
      if (cleanupIds.subjects.length) await prisma.subject.deleteMany({ where: { id: { in: cleanupIds.subjects } } });
      if (cleanupIds.sections.length) await prisma.section.deleteMany({ where: { id: { in: cleanupIds.sections } } });
      if (cleanupIds.academicYears.length) await prisma.academicYear.deleteMany({ where: { id: { in: cleanupIds.academicYears } } });
      if (cleanupIds.users.length) await prisma.userRole.deleteMany({ where: { user_id: { in: cleanupIds.users } } });
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: cleanupIds.users } } });
      if (cleanupIds.users.length) await prisma.user.deleteMany({ where: { id: { in: cleanupIds.users } } });
    } catch (e) {
      console.error(e);
    }
  });

  it('should prevent unauthenticated access', async () => {
    const res = await request(app).get('/api/admin/analytics/academics');
    expect(res.status).toBe(401);
  });

  it('should prevent unauthorized access (e.g. Student role)', async () => {
    const res = await request(app).get('/api/admin/analytics/academics').set('Cookie', studentToken);
    expect(res.status).toBe(403);
  });

  it('should prevent access for roles with user:read but lacking grade:read_all (e.g. Teacher)', async () => {
    const res = await request(app).get('/api/admin/analytics/academics').set('Cookie', teacherToken);
    expect(res.status).toBe(403);
  });

  it('should return exactly controlled aggregate numbers for Principal', async () => {
    const res = await request(app).get('/api/admin/analytics/academics').set('Cookie', principalToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    const data = res.body.data;
    expect(Array.isArray(data.schoolAverageByGradeLevel)).toBe(true);
    expect(Array.isArray(data.trendAverages)).toBe(true);
    expect(Array.isArray(data.lowestPerformingSubjects)).toBe(true);
    expect(Array.isArray(data.passingVsFailingByGradeLevel)).toBe(true);
    expect(Array.isArray(data.topSections)).toBe(true);
    expect(Array.isArray(data.topPerformers)).toBe(true);
    expect(Array.isArray(data.gradeDistribution)).toBe(true);

    // Verify the injected data is present in the distribution
    const dist85 = data.gradeDistribution.find((d: any) => d.bucket === '85-89');
    expect(dist85.count).toBeGreaterThanOrEqual(1);

    // Verify passing vs failing exists for Grade 10
    const pf10 = data.passingVsFailingByGradeLevel.find((d: any) => d.gradeLevel === 10);
    expect(pf10).toBeDefined();
    expect(pf10.passing).toBeGreaterThanOrEqual(1);
    expect(pf10.rate).toBeDefined();
  });
});
