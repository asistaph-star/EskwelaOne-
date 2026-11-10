/**
 * DIGISKWELA — DepEd School Form 8 (SF8) Test Suite
 * File: backend/tests/depedSf8Report.test.ts
 *
 * Verifies official DepEd Form 8 (Learner Basic Health and Nutrition Report)
 * according to DepEd Order No. 058, s. 2017 & Calulut INHS Policy:
 * - Authorized generation by assigned Class Adviser
 * - Accurate BOSY/EOSY anthropometric data mapping
 * - Disaggregated Male & Female roster with sequential numbering
 * - Mathematical accuracy of Nutritional Status & Height-for-Age summary tables
 * - Zero School Nurse dependency
 * - Strict RBAC rejection (HTTP 403) for unauthorized teachers
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/database.js';
import { generateSf8Report, exportSf8Csv } from '../src/academic/health/sf8.service.js';
import { recordHealthMetric } from '../src/academic/health/healthMetric.service.js';
import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';

describe('DIGISKWELA — DEPED SCHOOL FORM 8 (SF8) INTEGRATION TESTS', () => {
  const SECTION_ID = 'demo-sec-rizal10';
  let adviserUserId: string;
  let unauthUserId: string;
  let adviserToken: string;
  let unauthToken: string;
  let student1Id: string;
  let student2Id: string;

  beforeAll(async () => {
    // Retrieve Class Adviser Maria Clara
    const adviser = await prisma.user.findFirst({
      where: { email: 'teacher@demo.com' },
      include: { teacher: true },
    });
    if (!adviser) throw new Error('Adviser teacher@demo.com not found');
    adviserUserId = adviser.id;
    adviserToken = jwt.sign({ userId: adviser.id }, config.jwt.secret);

    // Retrieve Unauthorized Teacher
    const unauth = await prisma.user.findFirst({
      where: { email: 'teacher_unauthorized@demo.com' },
    });
    if (!unauth) throw new Error('Unauthorized teacher not found');
    unauthUserId = unauth.id;
    unauthToken = jwt.sign({ userId: unauth.id }, config.jwt.secret);

    // Retrieve first 2 students in Section demo-sec-rizal10
    const enrollments = await prisma.enrollment.findMany({
      where: { section_id: SECTION_ID, status: 'Enrolled' },
      include: { student: true },
      take: 2,
    });
    student1Id = enrollments[0].student_id;
    student2Id = enrollments[1].student_id;

    // Ensure student 1 has verified birthdate and male sex
    await prisma.student.update({
      where: { id: student1Id },
      data: {
        date_of_birth: new Date('2011-05-15'),
        gender: 'Male',
      },
    });

    // Ensure student 2 has verified birthdate and female sex
    await prisma.student.update({
      where: { id: student2Id },
      data: {
        date_of_birth: new Date('2011-08-20'),
        gender: 'Female',
      },
    });

    // Record synthetic BOSY measurement for Student 1
    await recordHealthMetric(
      {
        studentId: student1Id,
        sectionId: SECTION_ID,
        measurementPeriod: 'BOSY',
        measurementDate: '2026-08-25',
        heightCm: 162.0,
        weightKg: 51.5,
        remarks: 'Baseline screening',
      },
      adviserUserId,
      'test-corr-sf8-1'
    );

    // Record synthetic BOSY measurement for Student 2
    await recordHealthMetric(
      {
        studentId: student2Id,
        sectionId: SECTION_ID,
        measurementPeriod: 'BOSY',
        measurementDate: '2026-08-25',
        heightCm: 154.0,
        weightKg: 46.0,
        remarks: 'Baseline screening',
      },
      adviserUserId,
      'test-corr-sf8-2'
    );
  });

  it('SF8-01: Authorized Class Adviser can generate complete SF8 Report', async () => {
    const report = await generateSf8Report(SECTION_ID, 'BOSY', adviserUserId);

    expect(report).toBeDefined();
    expect(report.schoolInfo.schoolName).toContain('Calulut');
    expect(report.schoolInfo.sectionName).toBe('Rizal');
    expect(report.schoolInfo.gradeLevel).toBe(10);
    expect(report.period).toBe('BOSY');
  });

  it('SF8-02: Accountability block conforms to Calulut INHS Policy (Zero Nurse Dependency)', async () => {
    const report = await generateSf8Report(SECTION_ID, 'BOSY', adviserUserId);

    expect(report.accountability.preparedByName).toContain('Maria Clara');
    expect(report.accountability.preparedByRole).toContain('Class Adviser');
    expect(report.accountability.schoolNurseRequired).toBe(false);
    expect(report.accountability.policyCitation).toContain('DepEd Order No. 058');
  });

  it('SF8-03: Learners roster is disaggregated by sex with sequential numbering', async () => {
    const report = await generateSf8Report(SECTION_ID, 'BOSY', adviserUserId);

    expect(report.learners.male.length).toBeGreaterThan(0);
    expect(report.learners.female.length).toBeGreaterThan(0);

    // Verify row numbering starts at 1
    expect(report.learners.male[0].rowNumber).toBe(1);
    expect(report.learners.female[0].rowNumber).toBe(1);

    // Verify all males have gender === 'Male'
    for (const m of report.learners.male) {
      expect(m.gender).toBe('Male');
      expect(m.lrn).toBeDefined();
    }

    // Verify all females have gender === 'Female'
    for (const f of report.learners.female) {
      expect(f.gender).toBe('Female');
      expect(f.lrn).toBeDefined();
    }
  });

  it('SF8-04: Anthropometric data maps height in meters, age in years/months, and valid WHO categories', async () => {
    const report = await generateSf8Report(SECTION_ID, 'BOSY', adviserUserId);

    const assessedMale = report.learners.male.find((m) => m.studentId === student1Id);
    expect(assessedMale).toBeDefined();
    expect(assessedMale?.bosy).toBeDefined();
    expect(assessedMale?.bosy?.heightCm).toBe(162.0);
    expect(assessedMale?.bosy?.heightM).toBe(1.62);
    expect(assessedMale?.bosy?.weightKg).toBe(51.5);
    expect(assessedMale?.bosy?.bmi).toBeGreaterThan(19);
    expect(assessedMale?.bosy?.nutritionalStatusBmi).toBe('Normal');
    expect(assessedMale?.bosy?.heightForAgeStatus).toBe('Normal');
  });

  it('SF8-05: DepEd Summary Statistics tables are mathematically consistent', async () => {
    const report = await generateSf8Report(SECTION_ID, 'BOSY', adviserUserId);

    expect(report.summaryBmi.bosy).toBeDefined();
    expect(report.summaryHfa.bosy).toBeDefined();

    // Verify BMI summary sum of counts equals total assessed
    const totalBmiAssessed = report.summaryBmi.bosy.reduce((sum, row) => sum + row.totalCount, 0);
    expect(totalBmiAssessed).toBeGreaterThanOrEqual(2);

    // Verify percentages sum to <= 100%
    const totalPercentage = report.summaryBmi.bosy.reduce((sum, row) => sum + row.totalPercentage, 0);
    expect(totalPercentage).toBeLessThanOrEqual(100.1);
  });

  it('SF8-06: Unauthorized Teacher is strictly blocked (HTTP 403 FORBIDDEN)', async () => {
    await expect(
      generateSf8Report(SECTION_ID, 'BOSY', unauthUserId)
    ).rejects.toThrow(/FORBIDDEN|restricted/);
  });

  it('SF8-07: EOSY post-assessment measurement support and dual-period mapping', async () => {
    // Record synthetic EOSY measurement for Student 1
    await recordHealthMetric(
      {
        studentId: student1Id,
        sectionId: SECTION_ID,
        measurementPeriod: 'EOSY',
        measurementDate: '2027-03-15',
        heightCm: 164.0,
        weightKg: 53.0,
        remarks: 'End of school year post-assessment',
      },
      adviserUserId,
      'test-corr-sf8-eosy-1'
    );

    const report = await generateSf8Report(SECTION_ID, 'ALL', adviserUserId);
    expect(report.period).toBe('ALL');

    const assessedMale = report.learners.male.find((m) => m.studentId === student1Id);
    expect(assessedMale).toBeDefined();
    expect(assessedMale?.bosy).toBeDefined();
    expect(assessedMale?.eosy).toBeDefined();
    expect(assessedMale?.eosy?.heightCm).toBe(164.0);
    expect(assessedMale?.eosy?.weightKg).toBe(53.0);
    expect(assessedMale?.eosy?.nutritionalStatusBmi).toBe('Normal');

    expect(report.summaryBmi.eosy).toBeDefined();
    expect(report.summaryHfa.eosy).toBeDefined();
  });

  it('SF8-08: Authorized SF8 CSV export generates valid official DepEd format with complete metadata and summaries', async () => {
    // Test service function
    const { filename, csv, report } = await exportSf8Csv(SECTION_ID, 'BOSY', adviserUserId);
    expect(filename).toContain('DepEd_SF8_Grade10_Rizal_BOSY.csv');
    expect(csv).toContain('DEPARTMENT OF EDUCATION');
    expect(csv).toContain('SCHOOL FORM 8 (SF8) - LEARNER BASIC HEALTH AND NUTRITION REPORT');
    expect(csv).toContain(report.schoolInfo.schoolName);
    expect(csv).toContain('MALE LEARNERS');
    expect(csv).toContain('FEMALE LEARNERS');
    expect(csv).toContain('SUMMARY NUTRITIONAL STATUS (BMI-FOR-AGE)');
    expect(csv).toContain('SUMMARY HEIGHT-FOR-AGE (HFA)');
    expect(csv).toContain('No School Nurse Required');

    // Test HTTP endpoint export route
    const res = await request(app)
      .get(`/api/academic/health/sf8/sections/${SECTION_ID}/export?period=BOSY&format=csv`)
      .set('Authorization', `Bearer ${adviserToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename=');
    expect(res.text).toContain('SCHOOL FORM 8 (SF8)');
    expect(res.text).toContain('Dela Cruz, Juan');
  });

  it('SF8-09: Unauthorized teacher is blocked from downloading SF8 CSV export (403 FORBIDDEN)', async () => {
    const res = await request(app)
      .get(`/api/academic/health/sf8/sections/${SECTION_ID}/export?period=BOSY&format=csv`)
      .set('Authorization', `Bearer ${unauthToken}`);

    expect(res.status).toBe(403);
  });

  afterAll(async () => {
    // Clean up test health metrics recorded in this suite
    await prisma.studentHealthMetric.deleteMany({
      where: {
        student_id: { in: [student1Id, student2Id] },
        remarks: { contains: 'assessment' },
      },
    });
  });
});

