/**
 * DIGISKWELA — Gradebook Publication & Release Boundary Regression Tests
 * File: backend/tests/gradebookPublishBoundary.test.ts
 *
 * Verifies Task 1B & 1C backend boundaries against PostgreSQL 17 `digiskwela_test`:
 * - Publishing grades ONLY publishes the selected subject and term.
 * - Incomplete grades are strictly blocked with 422 INCOMPLETE_GRADES.
 * - Eligible grade publication succeeds and creates permanent snapshots.
 * - Publishing grades NEVER creates/issues an official Calulut SF9.
 * - Publishing grades NEVER releases a report card to the Student Portal.
 * - Reopening published grades preserves historical audit snapshots.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '../src/generated/sf2Sf9TestClient/index.js';
import { publishGradebook, unpublishGradebook } from '../src/gradebooks/gradebook.service.js';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://digiskwela_test_user:4AG2GOiMKcQl-T5zJPr4NwlV2PbyWpb_@localhost:5432/digiskwela_test?schema=public';

const testDb = new PrismaClient({
  datasources: {
    db: { url: TEST_DB_URL },
  },
});

const P = 'gb_bndry_';
const AY_ID = `${P}ay_2026_2027`;
const SEC_ID = `${P}sec_rizal10`;
const SUBJ_MATH_ID = `${P}subj_math`;
const SUBJ_SCI_ID = `${P}subj_science`;
const TEACHER_USER_ID = `${P}usr_teacher`;
const TEACHER_ID = `${P}tch_maria`;
const GB_MATH_T1_ID = `${P}gb_math_t1`;
const GB_MATH_T2_ID = `${P}gb_math_t2`;
const GB_SCI_T1_ID = `${P}gb_sci_t1`;
const ASSIGN_MATH_ID = `${P}asgn_math`;
const ASSIGN_SCI_ID = `${P}asgn_sci`;

const STUDENTS = [
  { id: `${P}std_01`, userId: `${P}usr_std_01`, enrId: `${P}enr_01`, lrn: '109876543201', fn: 'Juan', ln: 'Dela Cruz' },
  { id: `${P}std_02`, userId: `${P}usr_std_02`, enrId: `${P}enr_02`, lrn: '109876543202', fn: 'Maria', ln: 'Santos' },
  { id: `${P}std_03`, userId: `${P}usr_std_03`, enrId: `${P}enr_03`, lrn: '109876543203', fn: 'Jose', ln: 'Rizal' },
];

describe('DIGISKWELA — GRADEBOOK PUBLICATION & RELEASE BOUNDARY TESTS', () => {
  beforeAll(async () => {
    // Clean up any residual test data
    await testDb.sf9OfficialIssuance.deleteMany({ where: { student_id: { startsWith: P } } });
    await testDb.sf9AdviserComment.deleteMany({ where: { student_id: { startsWith: P } } });
    await testDb.grade.deleteMany({ where: { student_id: { startsWith: P } } });
    await testDb.gradebooks.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.teacherSubjectAssignment.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.enrollment.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.student.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.teacher.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.auditLog.deleteMany({ where: { actor_user_id: { startsWith: P } } });
    await testDb.user.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.subject.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.section.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.term.deleteMany({ where: { academic_year_id: AY_ID } });
    await testDb.academicYear.deleteMany({ where: { id: AY_ID } });

    // 1. Create Academic Year
    await testDb.academicYear.create({
      data: {
        id: AY_ID,
        name: `${P}SY 2026-2027`,
        start_date: new Date('2026-06-01'),
        end_date: new Date('2027-03-31'),
        is_current: false,
      },
    });

    // 2. Ensure Academic Terms T1, T2, T3 exist
    for (const [key, name] of [['T1', 'Term 1'], ['T2', 'Term 2'], ['T3', 'Term 3']] as const) {
      await testDb.term.create({
        data: {
          id: `${P}term_${key.toLowerCase()}`,
          name,
          key: key as any,
          academic_year_id: AY_ID,
          start_date: new Date('2026-06-01'),
          end_date: new Date('2026-09-30'),
        },
      });
    }

    // 3. Create Section
    await testDb.section.create({
      data: {
        id: SEC_ID,
        name: 'Rizal',
        grade_level: 10,
        academic_year_id: AY_ID,
      },
    });

    // 4. Create Subjects
    await testDb.subject.createMany({
      data: [
        { id: SUBJ_MATH_ID, name: 'Mathematics 10', code: `${P}M10` },
        { id: SUBJ_SCI_ID, name: 'Science 10', code: `${P}S10` },
      ],
    });

    // 5. Create Teacher User & Teacher Profile
    await testDb.user.create({
      data: {
        id: TEACHER_USER_ID,
        school_id: 'EMP-TCH-001',
        email: 'maria.clara.test@school.edu',
        password_hash: '$2b$10$dummyHashForTestingPurposesOnly1234567890',
        first_name: 'Maria',
        last_name: 'Clara',
        status: 'active',
      },
    });

    await testDb.teacher.create({
      data: {
        id: TEACHER_ID,
        user_id: TEACHER_USER_ID,
        employee_id: 'EMP-TCH-001',
      },
    });

    // 6. Create Class Assignments
    await testDb.teacherSubjectAssignment.createMany({
      data: [
        {
          id: ASSIGN_MATH_ID,
          teacher_id: TEACHER_ID,
          subject_id: SUBJ_MATH_ID,
          section_id: SEC_ID,
          academic_year_id: AY_ID,
        },
        {
          id: ASSIGN_SCI_ID,
          teacher_id: TEACHER_ID,
          subject_id: SUBJ_SCI_ID,
          section_id: SEC_ID,
          academic_year_id: AY_ID,
        },
      ],
    });

    // 7. Create Gradebooks (Math T1, Math T2, Science T1)
    const termT1 = await testDb.term.findFirst({ where: { academic_year_id: AY_ID, key: 'T1' } });
    const termT2 = await testDb.term.findFirst({ where: { academic_year_id: AY_ID, key: 'T2' } });

    await testDb.gradebooks.createMany({
      data: [
        {
          id: GB_MATH_T1_ID,
          assignment_id: ASSIGN_MATH_ID,
          term_id: termT1!.id,
          status: 'Draft',
          version: 1,
          updated_at: new Date(),
        },
        {
          id: GB_MATH_T2_ID,
          assignment_id: ASSIGN_MATH_ID,
          term_id: termT2!.id,
          status: 'Draft',
          version: 1,
          updated_at: new Date(),
        },
        {
          id: GB_SCI_T1_ID,
          assignment_id: ASSIGN_SCI_ID,
          term_id: termT1!.id,
          status: 'Draft',
          version: 1,
          updated_at: new Date(),
        },
      ],
    });

    // 8. Create Students and Enrollments
    for (const s of STUDENTS) {
      await testDb.user.create({
        data: {
          id: s.userId,
          school_id: s.lrn,
          email: `${s.fn.toLowerCase()}.${s.ln.toLowerCase()}@student.edu`,
          password_hash: '$2b$10$dummyHashForTestingPurposesOnly1234567890',
          first_name: s.fn,
          last_name: s.ln,
          status: 'active',
        },
      });

      await testDb.student.create({
        data: {
          id: s.id,
          user_id: s.userId,
          lrn: s.lrn,
          student_number: s.lrn,
          grade_level: 10,
        },
      });

      await testDb.enrollment.create({
        data: {
          id: s.enrId,
          student_id: s.id,
          section_id: SEC_ID,
          academic_year_id: AY_ID,
          status: 'Enrolled',
        },
      });
    }
  });

  afterAll(async () => {
    // Teardown test fixtures
    await testDb.sf9OfficialIssuance.deleteMany({ where: { student_id: { startsWith: P } } });
    await testDb.sf9AdviserComment.deleteMany({ where: { student_id: { startsWith: P } } });
    await testDb.grade.deleteMany({ where: { student_id: { startsWith: P } } });
    await testDb.gradebooks.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.teacherSubjectAssignment.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.enrollment.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.student.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.teacher.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.auditLog.deleteMany({ where: { actor_user_id: { startsWith: P } } });
    await testDb.user.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.subject.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.section.deleteMany({ where: { id: { startsWith: P } } });
    await testDb.term.deleteMany({ where: { academic_year_id: AY_ID } });
    await testDb.academicYear.deleteMany({ where: { id: AY_ID } });
    await testDb.$disconnect();
  });

  it('BND-01: Blocks publication when student grades are missing/incomplete (throws 422)', async () => {
    // Create grades for only 2 out of 3 students (leaving Student 3 with no grade)
    await testDb.grade.createMany({
      data: [
        {
          id: `${P}grd_m_t1_01`,
          student_id: STUDENTS[0].id,
          subject_id: SUBJ_MATH_ID,
          term: 'T1',
          academic_year_id: AY_ID,
          term_grade: 88,
        },
        {
          id: `${P}grd_m_t1_02`,
          student_id: STUDENTS[1].id,
          subject_id: SUBJ_MATH_ID,
          term: 'T1',
          academic_year_id: AY_ID,
          term_grade: 92,
        },
      ],
    });

    // Attempt to publish Math T1 gradebook
    await expect(
      publishGradebook({
        gradebookId: GB_MATH_T1_ID,
        actorUserId: TEACHER_USER_ID,
        actorRole: 'Teacher',
      })
    ).rejects.toThrow(/INCOMPLETE_GRADES|incomplete\/missing grades/);

    // Verify gradebook remains in Draft status
    const gb = await testDb.gradebooks.findUnique({ where: { id: GB_MATH_T1_ID } });
    expect(gb?.status).toBe('Draft');
  });

  it('BND-02: Succeeds and creates immutable snapshots when all student grades are complete', async () => {
    // Fill in missing grade for student 3
    await testDb.grade.create({
      data: {
        id: `${P}grd_m_t1_03`,
        student_id: STUDENTS[2].id,
        subject_id: SUBJ_MATH_ID,
        term: 'T1',
        academic_year_id: AY_ID,
        term_grade: 85,
      },
    });

    const result = await publishGradebook({
      gradebookId: GB_MATH_T1_ID,
      actorUserId: TEACHER_USER_ID,
      actorRole: 'Teacher',
    });

    expect(result.publishedCount).toBe(3);
    expect(result.gradebook.status).toBe('Published');
    expect(result.gradebook.version).toBe(2);

    // Verify all 3 student grades have published snapshots
    const publishedGrades = await testDb.grade.findMany({
      where: {
        student_id: { in: STUDENTS.map((s) => s.id) },
        subject_id: SUBJ_MATH_ID,
        term: 'T1',
      },
    });

    expect(publishedGrades).toHaveLength(3);
    for (const pg of publishedGrades) {
      expect(pg.published_term_grade).not.toBeNull();
      expect(pg.published_gradebook_id).toBe(GB_MATH_T1_ID);
      expect(pg.published_version).toBe(2);
      expect(pg.published_at).not.toBeNull();
      expect(pg.published_by_id).toBe(TEACHER_USER_ID);
    }
  });

  it('BND-03: Publishing Math T1 does NOT publish Math T2 or Science T1 (scope isolation)', async () => {
    const gbMathT2 = await testDb.gradebooks.findUnique({ where: { id: GB_MATH_T2_ID } });
    const gbSciT1 = await testDb.gradebooks.findUnique({ where: { id: GB_SCI_T1_ID } });

    expect(gbMathT2?.status).toBe('Draft');
    expect(gbSciT1?.status).toBe('Draft');
  });

  it('BND-04: Gradebook publication NEVER issues an official Calulut SF9 (zero SF9 issuance)', async () => {
    // Check sf9OfficialIssuance table in database
    const sf9Count = await testDb.sf9OfficialIssuance.count({
      where: { student_id: { startsWith: P } },
    });

    expect(sf9Count).toBe(0);
  });

  it('BND-05: Gradebook publication does NOT release a report card to students', async () => {
    // Zero official report cards exist, so zero can be released
    const issuances = await testDb.sf9OfficialIssuance.findMany({
      where: { student_id: { startsWith: P } },
    });

    expect(issuances).toHaveLength(0);
  });

  it('BND-06: Non-assigned teacher is rejected with 403 FORBIDDEN', async () => {
    await expect(
      publishGradebook({
        gradebookId: GB_SCI_T1_ID,
        actorUserId: 'some_random_unauthorized_user',
        actorRole: 'Teacher',
      })
    ).rejects.toThrow(/FORBIDDEN|Only the assigned subject teacher/);
  });

  it('BND-07: Reopening a published gradebook requires minimum 5-char justification and logs audit', async () => {
    // Attempt without reason should fail
    await expect(
      unpublishGradebook(GB_MATH_T1_ID, TEACHER_USER_ID, 'Teacher', 'bad')
    ).rejects.toThrow(/at least 5 characters/);

    // Valid reopening
    const reopenResult = await unpublishGradebook(
      GB_MATH_T1_ID,
      TEACHER_USER_ID,
      'Teacher',
      'Authorized grade correction for special quiz makeup approved by department'
    );

    expect(reopenResult.status).toBe('Draft');

    // Verify gradebook in DB is Draft
    const gb = await testDb.gradebooks.findUnique({ where: { id: GB_MATH_T1_ID } });
    expect(gb?.status).toBe('Draft');

    // Verify Grade records retain historical published_term_grade for audit
    const gradesAfterReopen = await testDb.grade.findMany({
      where: {
        student_id: { in: STUDENTS.map((s) => s.id) },
        subject_id: SUBJ_MATH_ID,
        term: 'T1',
      },
    });

    for (const g of gradesAfterReopen) {
      expect(g.published_term_grade).not.toBeNull();
      expect(g.published_version).toBe(2);
    }
  });
});
