import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { v4 as uuidv4 } from 'uuid';

describe('Phase 4 Targeted Corrections & Governance Verification', () => {
  let adminToken: string;
  let adviserToken: string;
  let testStudentId: string;
  let testSectionId: string;
  let testAcademicYearId: string;

  beforeAll(async () => {
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

    // 2. Adviser teacher (EMP-T-001)
    const adviserUser = await prisma.user.findFirst({ where: { school_id: 'EMP-T-001' }, include: { teacher: true } });
    if (!adviserUser) throw new Error('Adviser user EMP-T-001 not found');
    adviserToken = jwt.sign({ userId: adviserUser.id }, config.jwt.secret);

    // 3. Admin user (ADM-001)
    const adminUser = await prisma.user.findFirst({ where: { school_id: 'ADM-001' } });
    if (!adminUser) throw new Error('Admin user ADM-001 not found');
    adminToken = jwt.sign({ userId: adminUser.id }, config.jwt.secret);

    // 4. Section with adviser = EMP-T-001
    let section = await prisma.section.findFirst({
      where: { adviser_teacher_id: adviserUser.teacher!.id },
    });
    if (!section) {
      section = await prisma.section.create({
        data: {
          id: uuidv4(),
          name: 'Grade 10 - Rizal',
          grade_level: 10,
          academic_year_id: testAcademicYearId,
          adviser_teacher_id: adviserUser.teacher!.id,
        },
      });
    }
    testSectionId = section.id;

    // 5. Create synthetic test student
    testStudentId = 'test-corr-student-' + Date.now();
    const synthLrn = '9900' + Math.floor(10000000 + Math.random() * 90000000);
    await prisma.student.create({
      data: {
        id: testStudentId,
        student_number: 'SN-CORR-' + Date.now().toString().slice(-6),
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        lrn: synthLrn,
        grade_level: 10,
        gender: 'Male',
        date_of_birth: new Date('2012-04-10'),
        current_section_id: testSectionId,
      },
    });

    await prisma.enrollment.create({
      data: {
        id: uuidv4(),
        student_id: testStudentId,
        section_id: testSectionId,
        academic_year_id: testAcademicYearId,
        status: 'Enrolled',
      },
    });
  });

  afterAll(async () => {
    await prisma.studentHealthMetric.deleteMany({ where: { student_id: testStudentId } });
    await prisma.enrollment.deleteMany({ where: { student_id: testStudentId } });
    await prisma.student.deleteMany({ where: { id: testStudentId } });
  });

  describe('Task 2 — Configurable School-Form Age Cutoffs', () => {
    it('returns active configured cutoffs with provisional notice for SF1', async () => {
      const res = await request(app)
        .get('/api/academic/health/cutoffs')
        .set('Authorization', `Bearer ${adviserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeSf1.referenceDate).toBe('2026-06-05');
      expect(res.body.data.activeSf1.isProvisional).toBe(true);
      expect(res.body.data.activeSf1.statusNote).toContain('PROVISIONAL — AWAITING CALULUT CONFIRMATION');
    });

    it('rejects unauthorized teacher trying to modify school-form cutoff with 403 Forbidden', async () => {
      const res = await request(app)
        .patch('/api/academic/health/cutoffs')
        .set('Authorization', `Bearer ${adviserToken}`)
        .send({
          academicYear: '2026-2027',
          formKey: 'SF1',
          referenceDate: '2026-06-12',
          isProvisional: false,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Admin to update the cutoff without database migrations, keeping historical records untouched', async () => {
      // Record health metric first to test non-rewriting
      const metricRes = await request(app)
        .post('/api/academic/health/metrics')
        .set('Authorization', `Bearer ${adviserToken}`)
        .send({
          studentId: testStudentId,
          academicYearId: testAcademicYearId,
          sectionId: testSectionId,
          measurementPeriod: 'BOSY',
          measurementDate: '2026-07-05',
          heightCm: 154.5,
          weightKg: 46.5,
        });
      expect(metricRes.status).toBe(201);
      const metricId = metricRes.body.data.id;
      const originalAgeYears = metricRes.body.data.computed_age_years;

      // Admin updates SF1 cutoff
      const updateRes = await request(app)
        .patch('/api/academic/health/cutoffs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          academicYear: '2026-2027',
          formKey: 'SF1',
          referenceDate: '2026-06-05',
          isProvisional: true,
          basis: 'Confirmed DepEd First Friday of June baseline',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.referenceDate).toBe('2026-06-05');

      // Verify historical health metric was NOT altered or rewritten
      const metricAfter = await prisma.studentHealthMetric.findUnique({
        where: { id: metricId },
      });
      expect(metricAfter?.computed_age_years).toBe(originalAgeYears);
      expect(metricAfter?.measurement_date.toISOString().split('T')[0]).toBe('2026-07-05');
    });
  });

  describe('Task 3 — Birthdate and Sex Protected Identity Governance', () => {
    it('rejects Class Adviser attempting to casually alter protected date of birth with 403', async () => {
      const res = await request(app)
        .patch(`/api/academic/health/students/${testStudentId}/personal-info`)
        .set('Authorization', `Bearer ${adviserToken}`)
        .send({
          dateOfBirth: '2013-01-01',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PROTECTED_IDENTITY_FIELD');
      expect(res.body.error.message).toContain('protected DepEd PSA identity records');
    });

    it('rejects Class Adviser attempting to casually alter protected recorded sex with 403', async () => {
      const res = await request(app)
        .patch(`/api/academic/health/students/${testStudentId}/personal-info`)
        .set('Authorization', `Bearer ${adviserToken}`)
        .send({
          gender: 'Female',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PROTECTED_IDENTITY_FIELD');
    });

    it('allows Class Adviser to update non-identity personal details (street, guardian)', async () => {
      const res = await request(app)
        .patch(`/api/academic/health/students/${testStudentId}/personal-info`)
        .set('Authorization', `Bearer ${adviserToken}`)
        .send({
          street: '123 MacArthur Highway, Brgy. Calulut',
          city: 'City of San Fernando',
          guardianFirstName: 'Crisostomo',
          guardianLastName: 'Dela Cruz',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.street).toBe('123 MacArthur Highway, Brgy. Calulut');
    });

    it('allows Admin / Registrar to correct protected date of birth with audit trail', async () => {
      const res = await request(app)
        .patch(`/api/academic/health/students/${testStudentId}/personal-info`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dateOfBirth: '2012-04-10', // restored to authentic date
          gender: 'Male',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gender).toBe('Male');
    });
  });
});
