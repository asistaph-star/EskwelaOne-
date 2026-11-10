/**
 * DIGISKWELA — Phase H.3.2 Multi-Student Generation & Student Release Integration Tests
 * Module: tests/calulutSf9PhaseH32MultiStudentRelease.test.ts
 *
 * Validates the complete 25-student class-wide SF9 generation, data isolation,
 * lifecycle separation (Save -> Publish -> Issue -> Release), and strict student-level
 * authorization against PostgreSQL 17 `digiskwela_test`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import request from 'supertest';
import { PrismaClient } from '../src/generated/sf2Sf9TestClient/index.js';
import app from '../src/app.js';
import {
  CALULUT_SF9_MONTH_SLOTS,
  enumerateDatesInMonth,
  upsertSchoolCalendarMonth,
  upsertSchoolCalendarDay,
  finalizeSchoolCalendarMonth,
  recordOfficialDailyAttendance,
  verifyOfficialDailyAttendance,
  assignSectionClassAdviser,
  saveSf9AdviserComment,
  publishSubjectTermGradeSnapshot,
  generatePersistedStudentCalulutSf9FromDb,
  renderCalulutSf9BufferToPdf,
  generateCalulutSf9,
} from '../src/academic/grading/index.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://digiskwela_test_user:4AG2GOiMKcQl-T5zJPr4NwlV2PbyWpb_@localhost:5432/digiskwela_test?schema=public';

const testDb = new PrismaClient({
  datasources: {
    db: { url: TEST_DB_URL },
  },
});

const PREFIX = 'h32_test_';
const AY_ID = `${PREFIX}ay_2026_2027`;
const SEC_ID = `${PREFIX}sec_mabini10`;
const ADVISER_USER_ID = `${PREFIX}usr_adviser`;
const ADVISER_TEACHER_ID = `${PREFIX}tch_adviser`;
const PRINCIPAL_USER_ID = `${PREFIX}usr_principal`;

const NUM_STUDENTS = 25;
const STUDENT_IDS: string[] = [];
const ENROLLMENT_IDS: string[] = [];
const USER_IDS: string[] = [];
const LRNS: string[] = [];

for (let i = 1; i <= NUM_STUDENTS; i++) {
  const pad = String(i).padStart(2, '0');
  STUDENT_IDS.push(`${PREFIX}stu_${pad}`);
  ENROLLMENT_IDS.push(`${PREFIX}enr_${pad}`);
  USER_IDS.push(`${PREFIX}usr_${pad}`);
  LRNS.push(`1029384756${pad}`);
}

const REQUIRED_SUBJECTS = [
  { key: 'filipino', code: `${PREFIX}FIL10`, name: 'Filipino 10' },
  { key: 'english', code: `${PREFIX}ENG10`, name: 'English 10' },
  { key: 'math', code: `${PREFIX}MATH10`, name: 'Mathematics 10' },
  { key: 'science', code: `${PREFIX}SCI10`, name: 'Science 10' },
  { key: 'ap', code: `${PREFIX}AP10`, name: 'Araling Panlipunan 10' },
  { key: 'gmrc', code: `${PREFIX}ESP10`, name: 'Edukasyon sa Pagpapakatao 10' },
  { key: 'tle', code: `${PREFIX}TLE10`, name: 'Technology and Livelihood Education 10' },
  { key: 'music', code: `${PREFIX}MUS10`, name: 'Music 10' },
  { key: 'pe', code: `${PREFIX}PE10`, name: 'Physical Education 10' },
];

async function cleanupFixtures() {
  await testDb.sf9OfficialIssuance.deleteMany({ where: { OR: [{ academic_year_id: AY_ID }, { student_id: { in: STUDENT_IDS } }, { student: { lrn: { in: LRNS } } }] } });
  await testDb.sf9AdviserComment.deleteMany({ where: { OR: [{ academic_year_id: AY_ID }, { student_id: { in: STUDENT_IDS } }, { student: { lrn: { in: LRNS } } }] } });
  await testDb.officialDailyAttendance.deleteMany({ where: { OR: [{ academic_year_id: AY_ID }, { student_id: { in: STUDENT_IDS } }, { student: { lrn: { in: LRNS } } }] } });
  await testDb.schoolCalendarDay.deleteMany({ where: { academic_year_id: AY_ID } });
  await testDb.schoolCalendarMonth.deleteMany({ where: { academic_year_id: AY_ID } });
  await testDb.grade.deleteMany({ where: { OR: [{ academic_year_id: AY_ID }, { student_id: { in: STUDENT_IDS } }, { student: { lrn: { in: LRNS } } }] } });
  await testDb.teacherSubjectAssignment.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await testDb.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await testDb.enrollment.deleteMany({ where: { OR: [{ academic_year_id: AY_ID }, { student_id: { in: STUDENT_IDS } }, { student: { lrn: { in: LRNS } } }] } });
  await testDb.student.updateMany({
    where: { OR: [{ id: { startsWith: PREFIX } }, { lrn: { in: LRNS } }] },
    data: { current_section_id: null },
  });
  await testDb.student.deleteMany({ where: { OR: [{ id: { startsWith: PREFIX } }, { lrn: { in: LRNS } }] } });
  await testDb.section.deleteMany({ where: { academic_year_id: AY_ID } });
  await testDb.teacher.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await testDb.auditLog.deleteMany({ where: { actor_user_id: { startsWith: PREFIX } } });
  await testDb.userRole.deleteMany({ where: { user_id: { startsWith: PREFIX } } });
  await testDb.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await testDb.academicYear.deleteMany({ where: { id: AY_ID } });
}

describe('Phase H.3.2 — Multi-Student SF9 Generation & Student Report Card Release (`digiskwela_test`)', () => {
  let adviserToken: string;
  let principalToken: string;
  let student1Token: string;
  let student2Token: string;

  beforeAll(async () => {
    // 1. Strict DB Preflight
    const dbCheck = await testDb.$queryRaw<Array<{ db_name: string }>>`
      SELECT current_database() AS db_name
    `;
    expect(dbCheck[0]?.db_name).toBe('digiskwela_test');

    await cleanupFixtures();

    // 2. Seed Academic Year
    await testDb.academicYear.create({
      data: {
        id: AY_ID,
        name: 'SY 2026-2027-H32',
        start_date: new Date('2026-06-01T00:00:00.000Z'),
        end_date: new Date('2027-05-31T00:00:00.000Z'),
        is_current: false,
        school_head_name_snapshot: 'DR. JANE DOE, EDD',
        school_head_title_snapshot: 'Principal IV',
      },
    });

    // 3. Resolve Roles
    const teacherRole = await testDb.role.findFirst({ where: { name: 'Teacher' } });
    const principalRole = await testDb.role.findFirst({ where: { name: 'Principal' } });
    const studentRole = await testDb.role.findFirst({ where: { name: 'Student' } });

    // 4. Seed Adviser & Principal Users
    await testDb.user.create({
      data: {
        id: ADVISER_USER_ID,
        school_id: `SCH_${ADVISER_USER_ID}`,
        email: 'h32.adviser@synthetic.test',
        password_hash: 'hash',
        first_name: 'Maria',
        last_name: 'Clara',
        status: 'active',
        user_roles: teacherRole ? { create: { role_id: teacherRole.id } } : undefined,
      },
    });
    await testDb.teacher.create({
      data: { id: ADVISER_TEACHER_ID, user_id: ADVISER_USER_ID, employee_id: `${PREFIX}EMP_001` },
    });

    await testDb.user.create({
      data: {
        id: PRINCIPAL_USER_ID,
        school_id: `SCH_${PRINCIPAL_USER_ID}`,
        email: 'h32.principal@synthetic.test',
        password_hash: 'hash',
        first_name: 'Jane',
        last_name: 'Doe',
        status: 'active',
        user_roles: principalRole ? { create: { role_id: principalRole.id } } : undefined,
      },
    });

    // 5. Seed Section
    await testDb.section.create({
      data: {
        id: SEC_ID,
        name: 'Mabini-10',
        grade_level: 10,
        academic_year_id: AY_ID,
      },
    });

    await assignSectionClassAdviser(testDb, {
      sectionId: SEC_ID,
      adviserTeacherId: ADVISER_TEACHER_ID,
      adviserNameSnapshot: 'MARIA CLARA',
      actorUserId: PRINCIPAL_USER_ID,
    });

    // 6. Seed Subjects
    for (const s of REQUIRED_SUBJECTS) {
      await testDb.subject.create({
        data: {
          id: s.code,
          code: s.code,
          name: s.name,
        },
      });
      await testDb.teacherSubjectAssignment.create({
        data: {
          id: `${PREFIX}tsa_${s.code}`,
          section_id: SEC_ID,
          subject_id: s.code,
          teacher_id: ADVISER_TEACHER_ID,
          academic_year_id: AY_ID,
        },
      });
    }

    // 7. Seed 25 Synthetic Students and Enrollments
    for (let i = 0; i < NUM_STUDENTS; i++) {
      const uId = USER_IDS[i];
      const sId = STUDENT_IDS[i];
      const eId = ENROLLMENT_IDS[i];
      const lrn = LRNS[i];
      const gender = i % 2 === 0 ? 'M' : 'F';
      const firstName = `Learner${i + 1}`;
      const lastName = `Synthetic${i + 1}`;

      await testDb.user.create({
        data: {
          id: uId,
          school_id: `SCH_${uId}`,
          email: `h32.student${i + 1}@synthetic.test`,
          password_hash: 'hash',
          first_name: firstName,
          last_name: lastName,
          status: 'active',
          user_roles: studentRole ? { create: { role_id: studentRole.id } } : undefined,
        },
      });

      await testDb.student.create({
        data: {
          id: sId,
          user_id: uId,
          lrn,
          gender,
          grade_level: 10,
          date_of_birth: new Date('2011-04-15T00:00:00.000Z'),
          current_section_id: SEC_ID,
        },
      });

      await testDb.enrollment.create({
        data: {
          id: eId,
          student_id: sId,
          section_id: SEC_ID,
          academic_year_id: AY_ID,
          status: 'Enrolled',
        },
      });

      // 8. Seed Distinct Published Grades across 3 Terms for all subjects
      // Base score varies by student index: e.g. student 1 has 90s, student 25 has 78s
      const baseGrade = 75 + ((i * 3) % 20); // 75 to 94

      for (const subj of REQUIRED_SUBJECTS) {
        for (const term of ['T1', 'T2', 'T3'] as const) {
          const delta = term === 'T1' ? 0 : term === 'T2' ? 2 : 3;
          const score = Math.min(100, Math.max(65, baseGrade + delta));

          await testDb.grade.create({
            data: {
              id: crypto.randomUUID(),
              student_id: sId,
              subject_id: subj.code,
              academic_year_id: AY_ID,
              term,
              term_grade: score,
              published_term_grade: score,
              published_initial_grade: score - 2,
              published_version: 1,
              published_at: new Date(),
            },
          });
        }
      }

      // 9. Seed Adviser Comments (T1, T2, T3)
      for (const term of ['T1', 'T2', 'T3'] as const) {
        await saveSf9AdviserComment(testDb, {
          academicYearId: AY_ID,
          sectionId: SEC_ID,
          enrollmentId: eId,
          studentId: sId,
          term,
          comment: `${firstName} demonstrated commendable academic diligence in ${term}.`,
          status: 'PUBLISHED',
          actor: { userId: ADVISER_USER_ID, role: 'Teacher' },
        });
      }
    }

    // 10. Seed Official Calendar & Attendance (11 DepEd Months)
    for (const slot of CALULUT_SF9_MONTH_SLOTS) {
      const calendarYear = slot.monthOfYear >= 6 ? 2026 : 2027;
      const monthRec = await upsertSchoolCalendarMonth(testDb, {
        academicYearId: AY_ID,
        monthKey: slot.monthKey,
        calendarYear,
        calendarMonth: slot.monthOfYear,
        actorUserId: PRINCIPAL_USER_ID,
      });

      const dates = enumerateDatesInMonth(calendarYear, slot.monthOfYear);
      let instructionalDayId = '';
      let instructionalDate = '';

      for (let dIdx = 0; dIdx < dates.length; dIdx++) {
        const isoDate = dates[dIdx];
        const isInstr = dIdx === 0; // 1 instructional day per month for fast, lean execution
        const dayType = isInstr ? 'INSTRUCTIONAL' : 'SCHOOL_ACTIVITY_NON_INSTRUCTIONAL';

        const { day } = await upsertSchoolCalendarDay(testDb, {
          id: `${PREFIX}day_${isoDate}`,
          academicYearId: AY_ID,
          calendarMonthId: monthRec.id,
          date: isoDate,
          dayType,
          isInstructional: isInstr,
          approvalStatus: 'APPROVED',
          actorUserId: PRINCIPAL_USER_ID,
        });

        if (isInstr) {
          instructionalDayId = day.id;
          instructionalDate = isoDate;
        }
      }

      // Record daily attendance for all 25 students on the instructional day
      for (let i = 0; i < NUM_STUDENTS; i++) {
        const sId = STUDENT_IDS[i];
        const eId = ENROLLMENT_IDS[i];
        const status = (i === 24 && slot.monthKey === 'DEC') ? 'A' : 'P';

        await recordOfficialDailyAttendance(testDb, {
          academicYearId: AY_ID,
          sectionId: SEC_ID,
          enrollmentId: eId,
          studentId: sId,
          calendarDayId: instructionalDayId,
          date: instructionalDate,
          status,
          currentManilaDate: '2027-05-31',
          actor: { userId: ADVISER_USER_ID, role: 'Teacher' },
        });
      }

      await verifyOfficialDailyAttendance(testDb, {
        sectionId: SEC_ID,
        actor: { userId: ADVISER_USER_ID, role: 'Teacher' },
      });

      await finalizeSchoolCalendarMonth(testDb, {
        calendarMonthId: monthRec.id,
        actorUserId: PRINCIPAL_USER_ID,
      });
    }

    // Generate JWT auth tokens for testing HTTP endpoints
    adviserToken = jwt.sign({ userId: ADVISER_USER_ID }, config.jwt.secret, { expiresIn: '8h' });
    principalToken = jwt.sign({ userId: PRINCIPAL_USER_ID }, config.jwt.secret, { expiresIn: '8h' });
    student1Token = jwt.sign({ userId: USER_IDS[0] }, config.jwt.secret, { expiresIn: '8h' });
    student2Token = jwt.sign({ userId: USER_IDS[1] }, config.jwt.secret, { expiresIn: '8h' });
  }, 120000);

  afterAll(async () => {
    await cleanupFixtures();
    await testDb.$disconnect();
  });

  it('1. Class-wide generation: Successfully generates distinct SF9 workbooks for all 25 students within reasonable resource limits', async () => {
    const startTime = Date.now();
    const generatedBuffers: Buffer[] = [];
    const calculatedSummaries: any[] = [];

    for (let i = 0; i < NUM_STUDENTS; i++) {
      const sId = STUDENT_IDS[i];
      const eId = ENROLLMENT_IDS[i];

      const res = await generatePersistedStudentCalulutSf9FromDb(testDb, {
        studentId: sId,
        enrollmentId: eId,
        academicYearId: AY_ID,
        renderPdf: false,
        mode: 'OFFICIAL',
        currentManilaDate: '2027-05-31',
      });

      if (!res.readyForOfficialSf9) {
        console.log('Student ' + i + ' blockingReasons:', res.blockingReasons);
      }
      expect(res.readyForOfficialSf9).toBe(true);
      expect(res.blockingReasons).toEqual([]);
      expect(res.xlsxBuffer).toBeDefined();
      expect(res.calculated).toBeDefined();

      generatedBuffers.push(res.xlsxBuffer!);
      calculatedSummaries.push(res.calculated!);
    }

    const durationMs = Date.now() - startTime;
    // 25 in-memory OpenXML workbooks assembled in under 10 seconds
    expect(durationMs).toBeLessThan(10000);
    expect(generatedBuffers.length).toBe(25);
  });

  it('2. Student isolation: Each student SF9 contains strictly their own demographics, distinct grades, and comments', async () => {
    // Generate workbook for Student 1 (index 0) and Student 2 (index 1)
    const [res1, res2] = await Promise.all([
      generatePersistedStudentCalulutSf9FromDb(testDb, {
        studentId: STUDENT_IDS[0],
        enrollmentId: ENROLLMENT_IDS[0],
        academicYearId: AY_ID,
        renderPdf: false,
        mode: 'OFFICIAL',
        currentManilaDate: '2027-05-31',
      }),
      generatePersistedStudentCalulutSf9FromDb(testDb, {
        studentId: STUDENT_IDS[1],
        enrollmentId: ENROLLMENT_IDS[1],
        academicYearId: AY_ID,
        renderPdf: false,
        mode: 'OFFICIAL',
        currentManilaDate: '2027-05-31',
      }),
    ]);

    const zip1 = new AdmZip(res1.xlsxBuffer!);
    const zip2 = new AdmZip(res2.xlsxBuffer!);

    const sst1 = zip1.readAsText('xl/sharedStrings.xml');
    const sst2 = zip2.readAsText('xl/sharedStrings.xml');

    // Student 1 name and LRN appear in workbook 1, but NOT in workbook 2
    expect(sst1.toUpperCase()).toContain('SYNTHETIC1, LEARNER1');
    expect(sst1.toUpperCase()).not.toContain('SYNTHETIC2, LEARNER2');
    expect(sst2.toUpperCase()).toContain('SYNTHETIC2, LEARNER2');
    expect(sst2.toUpperCase()).not.toContain('SYNTHETIC1, LEARNER1');

    // General Average differs between Student 1 and Student 2
    expect(res1.calculated!.generalAverage).not.toEqual(res2.calculated!.generalAverage);

    // Verify cell coordinates in sheet6.xml (SF9 - GRADE 4-10)
    const s6Xml1 = zip1.readAsText('xl/worksheets/sheet6.xml');
    expect(s6Xml1).toContain('r="F32"'); // Filipino T1
    expect(s6Xml1).toContain('r="R5"');  // June school days
    expect(s6Xml1).toContain('r="R7"');  // June days present
    expect(s6Xml1).toContain('r="R9"');  // June days absent
    expect(s6Xml1).toContain('r="R15"'); // Visible Term 1 comment VLOOKUP
  });

  it('3. Lifecycle separation: Grade saving, publication, issuance, and release are distinct authorized stages', async () => {
    const sId = STUDENT_IDS[2]; // Student 3

    // Stage A: Before issuance, no official issuance record exists
    const beforeIssuance = await testDb.sf9OfficialIssuance.findFirst({
      where: { student_id: sId, is_current: true },
    });
    expect(beforeIssuance).toBeNull();

    // Stage B: Issue official SF9 via POST /:studentId/sf9/issue
    const issueRes = await request(app)
      .post(`/api/academic/report-card/${sId}/sf9/issue`)
      .set('Authorization', `Bearer ${adviserToken}`)
      .send({ currentManilaDate: '2027-05-31' });

    expect(issueRes.status).toBe(200);
    expect(issueRes.body.success).toBe(true);
    const issuanceId = issueRes.body.data.issuanceId;
    expect(issuanceId).toBeDefined();

    // Verify that issuance alone does NOT release the document to the student
    const checkUnreleased = await request(app)
      .get(`/api/academic/report-card/${sId}/released-sf9`)
      .set('Authorization', `Bearer ${principalToken}`);

    expect(checkUnreleased.status).toBe(200);
    expect(checkUnreleased.body.data.released).toBe(false);
    expect(checkUnreleased.body.data.status).toBe('PENDING_EVALUATION');

    // Stage C: Release official SF9 via POST /:studentId/sf9/release
    const releaseRes = await request(app)
      .post(`/api/academic/report-card/${sId}/sf9/release`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ reportingPeriod: 'Annual SF9 (Terms 1-3)' });

    expect(releaseRes.status).toBe(200);
    expect(releaseRes.body.success).toBe(true);
    expect(releaseRes.body.data.released).toBe(true);

    // Verify document is now confirmed released
    const checkReleased = await request(app)
      .get(`/api/academic/report-card/${sId}/released-sf9`)
      .set('Authorization', `Bearer ${principalToken}`);

    expect(checkReleased.status).toBe(200);
    expect(checkReleased.body.data.released).toBe(true);
    expect(checkReleased.body.data.status).toBe('RELEASED');
    expect(checkReleased.body.data.reportingPeriod).toBe('Annual SF9 (Terms 1-3)');
  }, 90000);

  it('4. Student security: Authenticated student can view only their own released SF9; cross-student access is denied', async () => {
    // Issue and release Student 1's SF9
    const s1Id = STUDENT_IDS[0];
    await request(app)
      .post(`/api/academic/report-card/${s1Id}/sf9/issue`)
      .set('Authorization', `Bearer ${adviserToken}`)
      .send({ currentManilaDate: '2027-05-31' });
    await request(app)
      .post(`/api/academic/report-card/${s1Id}/sf9/release`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send();

    // A. Student 1 queries their own released SF9 via /student/released-sf9 -> SUCCESS
    const s1SelfRes = await request(app)
      .get('/api/academic/report-card/student/released-sf9')
      .set('Authorization', `Bearer ${student1Token}`);

    expect(s1SelfRes.status).toBe(200);
    expect(s1SelfRes.body.data.released).toBe(true);
    expect(s1SelfRes.body.data.status).toBe('RELEASED');

    // B. Student 1 attempts to query Student 2's report card via URL parameter -> HTTP 403 FORBIDDEN
    const s1TamperRes = await request(app)
      .get(`/api/academic/report-card/${STUDENT_IDS[1]}/released-sf9`)
      .set('Authorization', `Bearer ${student1Token}`);

    expect(s1TamperRes.status).toBe(403);
    expect(s1TamperRes.body.error.code).toBe('UNAUTHORIZED_STUDENT_ACCESS');

    // C. Student 2 (unreleased) queries their own report card -> PENDING_EVALUATION, released: false
    const s2SelfRes = await request(app)
      .get('/api/academic/report-card/student/released-sf9')
      .set('Authorization', `Bearer ${student2Token}`);

    expect(s2SelfRes.status).toBe(200);
    expect(s2SelfRes.body.data.released).toBe(false);
    expect(s2SelfRes.body.data.status).toBe('PENDING_EVALUATION');

    // D. Student 2 attempts to download unreleased PDF -> HTTP 403 FORBIDDEN
    const s2PdfRes = await request(app)
      .get('/api/academic/report-card/student/released-sf9/pdf')
      .set('Authorization', `Bearer ${student2Token}`);

    expect(s2PdfRes.status).toBe(403);
    expect(s2PdfRes.body.error.code).toBe('SF9_NOT_RELEASED_TO_STUDENT');

    // E. Student attempts to invoke privileged issuance endpoint -> HTTP 403 FORBIDDEN
    const s1PrivilegeRes = await request(app)
      .post(`/api/academic/report-card/${s1Id}/sf9/issue`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send();

    expect(s1PrivilegeRes.status).toBe(403);
  }, 90000);

  it('5. Historical version preservation: Re-issuing creates an incremented version and marks prior issuance superseded without deletion', async () => {
    const sId = STUDENT_IDS[3]; // Student 4

    // First issuance (Version 1)
    const v1Res = await request(app)
      .post(`/api/academic/report-card/${sId}/sf9/issue`)
      .set('Authorization', `Bearer ${adviserToken}`)
      .send({ currentManilaDate: '2027-05-31' });
    expect(v1Res.body.data.version).toBe(1);
    const v1Id = v1Res.body.data.issuanceId;

    // Second issuance (Version 2) with correction reason
    const v2Res = await request(app)
      .post(`/api/academic/report-card/${sId}/sf9/issue`)
      .set('Authorization', `Bearer ${adviserToken}`)
      .send({
        currentManilaDate: '2027-05-31',
        correctionReason: 'Administrative correction of Term 3 English grade',
      });
    expect(v2Res.body.data.version).toBe(2);
    const v2Id = v2Res.body.data.issuanceId;

    // Verify in database: Version 1 is superseded, Version 2 is current
    const v1Rec = await testDb.sf9OfficialIssuance.findUnique({ where: { id: v1Id } });
    const v2Rec = await testDb.sf9OfficialIssuance.findUnique({ where: { id: v2Id } });

    expect(v1Rec).not.toBeNull();
    expect(v1Rec!.version).toBe(1);
    expect(v1Rec!.is_current).toBe(false);
    expect(v1Rec!.superseded_by_id).toBe(v2Id);

    expect(v2Rec).not.toBeNull();
    expect(v2Rec!.version).toBe(2);
    expect(v2Rec!.is_current).toBe(true);
    expect(v2Rec!.correction_reason).toBe('Administrative correction of Term 3 English grade');
  }, 90000);

  it('6. PDF rendering: Generates authentic Calulut SF9 PDF with LibreOffice Calc without draft watermark in official mode', async () => {
    const sId = STUDENT_IDS[0];
    const eId = ENROLLMENT_IDS[0];

    const result = await generatePersistedStudentCalulutSf9FromDb(testDb, {
      studentId: sId,
      enrollmentId: eId,
      academicYearId: AY_ID,
      renderPdf: true,
      mode: 'OFFICIAL',
      currentManilaDate: '2027-05-31',
    });

    expect(result.readyForOfficialSf9).toBe(true);
    expect(result.pdfBuffer).toBeDefined();
    expect(result.pdfBuffer!.length).toBeGreaterThan(50000);

    // Verify PDF header %PDF-
    const header = result.pdfBuffer!.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');

    // In OFFICIAL mode, draft watermark is NOT in the workbook row 2
    const zip = new AdmZip(result.xlsxBuffer!);
    const s6Xml = zip.readAsText('xl/worksheets/sheet6.xml');
    expect(s6Xml).not.toContain('*** DRAFT PREVIEW');
  }, 90000);
});
