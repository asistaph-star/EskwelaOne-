/**
 * DIGISKWELA — PHASE I.3: STUDENT HEALTH & SF8 INTEGRATION TEST SUITE
 * File: backend/tests/healthMetricIntegration.test.ts
 *
 * Verifies:
 * 1. Class Adviser health metric encoding for advisory students
 * 2. Automatic age computation at actual measurement date
 * 3. Automatic BMI and WHO 2007 nutritional classifications
 * 4. Save and reload persistence
 * 5. Versioning & repeat measurement preservation (no overwriting or cascade deletion)
 * 6. RBAC boundaries: unauthorized teachers rejected (403), cross-student isolation
 * 7. Demographic updates (birthdate and sex) by Class Adviser
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { v4 as uuidv4 } from 'uuid';

describe('Phase I.3 — Student Health Metrics Integration Suite', () => {
  let adviserToken: string;
  let otherTeacherToken: string;
  let studentToken: string;
  let adminToken: string;

  let testStudentId: string;
  let testSectionId: string;
  let testAcademicYearId: string;
  let otherStudentId: string;

  beforeAll(async () => {
    // 0. Clean up any residual test records from prior runs
    const lingering = await prisma.student.findMany({
      where: {
        OR: [
          { id: { startsWith: 'test-health-student-' } },
          { id: { startsWith: 'other-student-' } },
          { first_name: 'HealthMetric' },
        ],
      },
      select: { id: true },
    });
    if (lingering.length > 0) {
      const lingIds = lingering.map((l) => l.id);
      await prisma.studentHealthMetric.deleteMany({ where: { student_id: { in: lingIds } } });
      await prisma.enrollment.deleteMany({ where: { student_id: { in: lingIds } } });
      await prisma.student.deleteMany({ where: { id: { in: lingIds } } });
    }

    // 1. Get or create test academic year & section
    let ay = await prisma.academicYear.findFirst({ where: { is_current: true } });
    if (!ay) {
      ay = await prisma.academicYear.create({
        data: {
          id: uuidv4(),
          name: '2026-2027',
          start_date: new Date('2026-06-01'),
          end_date: new Date('2027-03-31'),
          is_current: true,
        },
      });
    }
    testAcademicYearId = ay.id;

    // 2. Adviser teacher (EMP-T-001 / demo-teacher-1)
    let adviserUser = await prisma.user.findFirst({ where: { school_id: 'EMP-T-001' }, include: { teacher: true } });
    if (!adviserUser) {
      throw new Error('Adviser user EMP-T-001 not found in digiskwela_test!');
    }
    adviserToken = jwt.sign({ userId: adviserUser.id }, config.jwt.secret);

    // 3. Other teacher (EMP-T-002 or create if not present)
    let teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    if (!teacherRole) {
      teacherRole = await prisma.role.create({ data: { id: uuidv4(), name: 'Teacher' } });
    }

    let otherTeacher = await prisma.user.findFirst({
      where: { school_id: { not: 'EMP-T-001' }, teacher: { isNot: null } },
      include: { teacher: true },
    });
    if (!otherTeacher) {
      otherTeacher = await prisma.user.create({
        data: {
          id: uuidv4(),
          school_id: 'EMP-T-999',
          email: 'othert@demo.com',
          password_hash: 'hash',
          first_name: 'Other',
          last_name: 'Teacher',
          status: 'active',
          must_change_password: false,
          teacher: {
            create: {
              id: uuidv4(),
              employee_id: 'EMP-T-999',
            },
          },
        },
        include: { teacher: true },
      });
    } else {
      await prisma.user.update({
        where: { id: otherTeacher.id },
        data: { status: 'active', must_change_password: false },
      });
    }

    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: otherTeacher.id, role_id: teacherRole.id } },
      create: { user_id: otherTeacher.id, role_id: teacherRole.id },
      update: {},
    });
    otherTeacherToken = jwt.sign({ userId: otherTeacher.id }, config.jwt.secret);

    // 4. Admin user
    const adminUser = await prisma.user.findFirst({ where: { school_id: 'ADM-001' } });
    adminToken = jwt.sign({ userId: adminUser!.id }, config.jwt.secret);

    // 5. Section with adviser = EMP-T-001
    let section = await prisma.section.findFirst({
      where: { adviser_teacher_id: adviserUser.teacher!.id },
    });
    if (!section) {
      section = await prisma.section.create({
        data: {
          id: uuidv4(),
          name: 'Health-Test-Section',
          grade_level: 10,
          academic_year_id: testAcademicYearId,
          adviser_teacher_id: adviserUser.teacher!.id,
        },
      });
    }
    testSectionId = section.id;

    // 6. Test student in Adviser's section (16-year-old JHS learner)
    const synthStudentId = 'test-health-student-' + Date.now();
    const synthLrn = '1122' + Math.floor(10000000 + Math.random() * 90000000);
    const synthStudent = await prisma.student.create({
      data: {
        id: synthStudentId,
        student_number: 'SN-HLTH-' + Date.now().toString().slice(-6),
        first_name: 'HealthMetric',
        last_name: 'Learner',
        lrn: synthLrn,
        grade_level: 10,
        gender: 'Male',
        date_of_birth: new Date('2010-06-15'), // Exactly 16 years old in 2026
        current_section_id: testSectionId,
      },
    });
    testStudentId = synthStudent.id;

    // Enroll synthetic student
    await prisma.enrollment.create({
      data: {
        id: uuidv4(),
        student_id: testStudentId,
        section_id: testSectionId,
        academic_year_id: testAcademicYearId,
        status: 'Enrolled',
      },
    });

    // 7. Another student in a different section
    const otherLrn = '7788' + Math.floor(10000000 + Math.random() * 90000000);
    const otherStudent = await prisma.student.create({
      data: {
        id: 'other-student-' + Date.now(),
        student_number: 'SN-OTHER-' + Date.now().toString().slice(-6),
        first_name: 'SyntheticHMI',
        last_name: 'Learner',
        lrn: otherLrn,
        grade_level: 9,
        gender: 'Male',
        date_of_birth: new Date('2011-04-10'),
      },
    });
    otherStudentId = otherStudent.id;
  });

  afterAll(async () => {
    // Clean up test data from digiskwela_test
    const ids = [testStudentId, otherStudentId].filter(Boolean);
    if (ids.length > 0) {
      await prisma.studentHealthMetric.deleteMany({
        where: { student_id: { in: ids } },
      });
      await prisma.enrollment.deleteMany({
        where: { student_id: { in: ids } },
      });
      await prisma.student.deleteMany({
        where: { id: { in: ids } },
      });
    }
  });

  it('1. Rejects unauthorized teacher from recording student health metric (403 FORBIDDEN)', async () => {
    const res = await request(app)
      .post('/api/academic/health/metrics')
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({
        studentId: testStudentId,
        measurementPeriod: 'BOSY',
        measurementDate: '2026-08-15',
        heightCm: 165,
        weightKg: 55,
      });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  it('2. Enforces protected identity policy: rejects Class Adviser (403) and authorizes Admin to correct learner birthdate and sex', async () => {
    // Adviser attempting to casually alter protected DOB/sex is rejected per DepEd PSA policy
    const advRes = await request(app)
      .patch(`/api/academic/health/students/${testStudentId}/demographics`)
      .set('Authorization', `Bearer ${adviserToken}`)
      .send({
        dateOfBirth: '2010-06-15',
        gender: 'Male',
      });

    expect(advRes.status).toBe(403);
    expect(advRes.body.error?.code).toBe('PROTECTED_IDENTITY_FIELD');

    // Admin/Registrar is authorized to correct protected identity fields upon PSA verification
    const res = await request(app)
      .patch(`/api/academic/health/students/${testStudentId}/demographics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dateOfBirth: '2010-06-15',
        gender: 'Male',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.gender).toBe('Male');
  });

  it('3. Class Adviser records BOSY measurement: computes age (16y), BMI (20.2), and Normal WHO status', async () => {
    // 16y Male: Height 165 cm, Weight 55 kg -> BMI = 55 / (1.65)^2 = 20.20 -> Normal
    const res = await request(app)
      .post('/api/academic/health/metrics')
      .set('Authorization', `Bearer ${adviserToken}`)
      .send({
        studentId: testStudentId,
        measurementPeriod: 'BOSY',
        measurementDate: '2026-08-15',
        heightCm: 165,
        weightKg: 55,
        remarks: 'Beginning of school year baseline',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    expect(data.student_id).toBe(testStudentId);
    expect(data.measurement_period).toBe('BOSY');
    expect(data.computed_age_years).toBe(16);
    expect(Number(data.computed_bmi)).toBeCloseTo(20.2, 1);
    expect(data.bmi_category).toBe('Normal');
    expect(data.hfa_category).toBe('Normal');
    expect(data.assessment_status).toBe('COMPLETED');
    expect(data.version_number).toBe(1);
    expect(data.is_latest).toBe(true);
  });

  it('4. Save/Reload persistence: retrieves exact persisted health metric and history', async () => {
    const res = await request(app)
      .get(`/api/academic/health/students/${testStudentId}`)
      .set('Authorization', `Bearer ${adviserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);

    const saved = res.body.data[0];
    expect(Number(saved.height_cm)).toBe(165);
    expect(Number(saved.weight_kg)).toBe(55);
    expect(saved.bmi_category).toBe('Normal');
    expect(saved.is_latest).toBe(true);
    expect(saved.recorded_by).toBeDefined();
    expect(saved.recorded_by.school_id).toBe('EMP-T-001');
  });

  it('5. Repeat measurement versioning: subsequent measurement preserves version 1 and marks version 2 as latest', async () => {
    // Adviser records an updated measurement for the same period (e.g. corrected measurement: 58 kg)
    const res = await request(app)
      .post('/api/academic/health/metrics')
      .set('Authorization', `Bearer ${adviserToken}`)
      .send({
        studentId: testStudentId,
        measurementPeriod: 'BOSY',
        measurementDate: '2026-08-16',
        heightCm: 165,
        weightKg: 58,
        remarks: 'Corrected weight measurement',
      });

    expect(res.status).toBe(201);
    const v2 = res.body.data;
    expect(v2.version_number).toBe(2);
    expect(v2.is_latest).toBe(true);
    expect(v2.correction_of_metric_id).toBeDefined();

    // Verify history contains BOTH version 1 and version 2 (audit history preserved)
    const historyRes = await request(app)
      .get(`/api/academic/health/students/${testStudentId}`)
      .set('Authorization', `Bearer ${adviserToken}`);

    expect(historyRes.body.data.length).toBe(2);

    const latestRow = historyRes.body.data.find((m: any) => m.is_latest);
    const oldRow = historyRes.body.data.find((m: any) => !m.is_latest);

    expect(latestRow.version_number).toBe(2);
    expect(Number(latestRow.weight_kg)).toBe(58);

    expect(oldRow.version_number).toBe(1);
    expect(Number(oldRow.weight_kg)).toBe(55);
    expect(oldRow.is_latest).toBe(false);
  });

  it('6. Cross-student isolation: unrelated teacher cannot read student health history (403)', async () => {
    const res = await request(app)
      .get(`/api/academic/health/students/${testStudentId}`)
      .set('Authorization', `Bearer ${otherTeacherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  it('7. Section health roster (SF8 preparation) returns enrolled learners with latest metrics', async () => {
    const res = await request(app)
      .get(`/api/academic/health/sections/${testSectionId}`)
      .set('Authorization', `Bearer ${adviserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testSectionId);
    expect(Array.isArray(res.body.data.enrollments)).toBe(true);

    const enrolledCrispin = res.body.data.enrollments.find((e: any) => e.student.id === testStudentId);
    expect(enrolledCrispin).toBeDefined();
    expect(enrolledCrispin.student.health_metrics.length).toBeGreaterThan(0);
    expect(enrolledCrispin.student.health_metrics[0].is_latest).toBe(true);
  });
});
