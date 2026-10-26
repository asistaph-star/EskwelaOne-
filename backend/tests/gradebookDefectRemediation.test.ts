import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { config } from '../src/config/env.js';
import { generateId } from '../src/common/utils/uuid.js';
import { saveLedger, getLedger } from '../src/gradebooks/ledger.service.js';
import { upsertGrade } from '../src/gradebooks/gradebook.service.js';

describe('DIGISKWELA — DEF-GRADE-001 & DEF-GRADE-002 Comprehensive Remediation & Data Integrity Verification (digiskwela_test)', () => {
  // Synthetic Teacher 1 (Authorized owner)
  const synthTeacherUserId = 'synth-u-rem-teacher';
  const synthTeacherProfileId = 'synth-p-rem-teacher';
  const synthTeacherSchoolId = 'SYNTH-TCH-REM1';

  // Synthetic Teacher 2 (Unauthorized teacher)
  const synthUnauthorizedTeacherUserId = 'synth-u-unauth-teacher';
  const synthUnauthorizedTeacherProfileId = 'synth-p-unauth-teacher';
  const synthUnauthorizedTeacherSchoolId = 'SYNTH-TCH-UNAUTH';

  // Synthetic Students
  const synthStudent1UserId = 'synth-u-rem-student1';
  const synthStudent1ProfileId = 'synth-p-rem-student1';
  const synthEnrollment1Id = 'synth-enroll-rem-1';

  const synthStudent2UserId = 'synth-u-rem-student2';
  const synthStudent2ProfileId = 'synth-p-rem-student2';
  const synthEnrollment2Id = 'synth-enroll-rem-2';

  const synthSectionId = 'synth-sec-rem-verify';
  const synthAssignmentId = 'synth-assign-rem-verify';
  const academicYearId = 'demo-ay-2026';
  const subjectId = 'demo-subj-math10';

  let teacherToken: string;
  let unauthorizedTeacherToken: string;

  async function cleanup() {
    // 1. Delete grade entries
    await prisma.grade_entries.deleteMany({
      where: { enrollment_id: { in: [synthEnrollment1Id, synthEnrollment2Id] } }
    });
    // 2. Delete gradebook columns
    await prisma.gradebook_columns.deleteMany({
      where: { gradebook: { assignment_id: synthAssignmentId } }
    });
    // 3. Delete gradebooks
    await prisma.gradebooks.deleteMany({
      where: { assignment_id: synthAssignmentId }
    });
    // 4. Delete grade records
    await prisma.grade.deleteMany({
      where: { student_id: { in: [synthStudent1ProfileId, synthStudent2ProfileId] } }
    });
    // 5. Delete enrollments
    await prisma.enrollment.deleteMany({
      where: { id: { in: [synthEnrollment1Id, synthEnrollment2Id] } }
    });
    // 6. Delete assignments
    await prisma.teacherSubjectAssignment.deleteMany({
      where: { id: synthAssignmentId }
    });
    // 7. Delete sections
    await prisma.section.deleteMany({
      where: { id: synthSectionId }
    });
    // 8. Delete student profiles
    await prisma.student.deleteMany({
      where: { id: { in: [synthStudent1ProfileId, synthStudent2ProfileId] } }
    });
    // 9. Delete teacher profiles
    await prisma.teacher.deleteMany({
      where: { id: { in: [synthTeacherProfileId, synthUnauthorizedTeacherProfileId] } }
    });
    // 10. Delete audit logs
    await prisma.auditLog.deleteMany({
      where: { actor_user_id: { in: [synthTeacherUserId, synthUnauthorizedTeacherUserId, synthStudent1UserId, synthStudent2UserId] } }
    });
    // 11. Delete user roles
    await prisma.userRole.deleteMany({
      where: { user_id: { in: [synthTeacherUserId, synthUnauthorizedTeacherUserId, synthStudent1UserId, synthStudent2UserId] } }
    });
    // 12. Delete users
    await prisma.user.deleteMany({
      where: { id: { in: [synthTeacherUserId, synthUnauthorizedTeacherUserId, synthStudent1UserId, synthStudent2UserId] } }
    });
  }

  beforeAll(async () => {
    await cleanup();

    const roleTeacher = await prisma.role.findUnique({ where: { name: 'Teacher' } });
    const roleStudent = await prisma.role.findUnique({ where: { name: 'Student' } });
    if (!roleTeacher || !roleStudent) throw new Error('Required roles not found');

    // 1. Authorized Teacher
    await prisma.user.create({
      data: {
        id: synthTeacherUserId,
        school_id: synthTeacherSchoolId,
        email: 'rem_teacher@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Authorized',
        last_name: 'Teacher',
        status: 'active',
        user_roles: { create: { role_id: roleTeacher.id } }
      }
    });

    await prisma.teacher.create({
      data: {
        id: synthTeacherProfileId,
        user_id: synthTeacherUserId,
        employee_id: synthTeacherSchoolId,
        department: 'Mathematics',
        position: 'Teacher III'
      }
    });

    // 2. Unauthorized Teacher
    await prisma.user.create({
      data: {
        id: synthUnauthorizedTeacherUserId,
        school_id: synthUnauthorizedTeacherSchoolId,
        email: 'unauth_teacher@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Unauthorized',
        last_name: 'Teacher',
        status: 'active',
        user_roles: { create: { role_id: roleTeacher.id } }
      }
    });

    await prisma.teacher.create({
      data: {
        id: synthUnauthorizedTeacherProfileId,
        user_id: synthUnauthorizedTeacherUserId,
        employee_id: synthUnauthorizedTeacherSchoolId,
        department: 'English',
        position: 'Teacher I'
      }
    });

    // 3. Students
    await prisma.user.create({
      data: {
        id: synthStudent1UserId,
        school_id: 'SYNTH-STU-REM1',
        email: 'student1@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Student',
        last_name: 'One',
        status: 'active',
        user_roles: { create: { role_id: roleStudent.id } }
      }
    });

    await prisma.student.create({
      data: {
        id: synthStudent1ProfileId,
        user_id: synthStudent1UserId,
        student_number: 'SN-REM-001',
        lrn: '999900003331',
        grade_level: 10
      }
    });

    await prisma.user.create({
      data: {
        id: synthStudent2UserId,
        school_id: 'SYNTH-STU-REM2',
        email: 'student2@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Student',
        last_name: 'Two',
        status: 'active',
        user_roles: { create: { role_id: roleStudent.id } }
      }
    });

    await prisma.student.create({
      data: {
        id: synthStudent2ProfileId,
        user_id: synthStudent2UserId,
        student_number: 'SN-REM-002',
        lrn: '999900003332',
        grade_level: 10
      }
    });

    // 4. Section & Assignment
    await prisma.section.create({
      data: {
        id: synthSectionId,
        academic_year_id: academicYearId,
        name: 'Remediation-Verify-Section',
        grade_level: 10
      }
    });

    await prisma.teacherSubjectAssignment.create({
      data: {
        id: synthAssignmentId,
        academic_year_id: academicYearId,
        teacher_id: synthTeacherProfileId,
        section_id: synthSectionId,
        subject_id: subjectId
      }
    });

    // 5. Enrollments
    await prisma.enrollment.create({
      data: {
        id: synthEnrollment1Id,
        academic_year_id: academicYearId,
        student_id: synthStudent1ProfileId,
        section_id: synthSectionId,
        status: 'Enrolled'
      }
    });

    await prisma.enrollment.create({
      data: {
        id: synthEnrollment2Id,
        academic_year_id: academicYearId,
        student_id: synthStudent2ProfileId,
        section_id: synthSectionId,
        status: 'Enrolled'
      }
    });

    teacherToken = sign({ userId: synthTeacherUserId }, config.jwt.secret, { expiresIn: '1h' });
    unauthorizedTeacherToken = sign({ userId: synthUnauthorizedTeacherUserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PHASE 1: DEF-GRADE-001 (SAVE LEDGER INTEGRITY & STABILITY)
  // ══════════════════════════════════════════════════════════════════════════════

  const ww1ColId = generateId();
  const ww2ColId = generateId();
  const pt1ColId = generateId();
  let ww3ColId: string;

  it('TC-GRADE-001-A & B: Initial Gradebook creation and score entry succeeds', async () => {
    const payload = {
      T1: {
        wwItems: [
          { id: ww1ColId, label: 'Written Work 1', max: 20 },
          { id: ww2ColId, label: 'Written Work 2', max: 20 }
        ],
        ptItems: [
          { id: pt1ColId, label: 'Performance Task 1', max: 50 }
        ],
        qaMax: 100,
        grades: {
          [synthEnrollment1Id]: {
            [ww1ColId]: '18',
            [ww2ColId]: '19',
            [pt1ColId]: '45',
            qa: '90'
          },
          [synthEnrollment2Id]: {
            [ww1ColId]: '0', // Valid recorded zero
            [ww2ColId]: '15',
            [pt1ColId]: '40',
            qa: '80'
          }
        }
      }
    };

    await expect(saveLedger(synthAssignmentId, payload, synthTeacherUserId)).resolves.not.toThrow();

    // Verify persisted gradebook columns
    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: synthAssignmentId } },
      orderBy: { sort_order: 'asc' }
    });
    expect(cols.length).toBe(4); // WW1, WW2, PT1, QA

    // Verify persisted entries
    const entries = await prisma.grade_entries.findMany({
      where: { enrollment_id: synthEnrollment1Id }
    });
    expect(entries.length).toBe(4);
  });

  it('TC-GRADE-001-C: Repeated save of populated gradebook succeeds without FK violation and preserves IDs', async () => {
    const payload = {
      T1: {
        wwItems: [
          { id: ww1ColId, label: 'Written Work 1', max: 20 },
          { id: ww2ColId, label: 'Written Work 2', max: 20 }
        ],
        ptItems: [
          { id: pt1ColId, label: 'Performance Task 1', max: 50 }
        ],
        qaMax: 100,
        grades: {
          [synthEnrollment1Id]: {
            [ww1ColId]: '18',
            [ww2ColId]: '19',
            [pt1ColId]: '45',
            qa: '90'
          },
          [synthEnrollment2Id]: {
            [ww1ColId]: '0',
            [ww2ColId]: '15',
            [pt1ColId]: '40',
            qa: '80'
          }
        }
      }
    };

    // PROVES FIX FOR DEF-GRADE-001: Calling saveLedger again on an already-populated gradebook MUST NOT THROW!
    await expect(saveLedger(synthAssignmentId, payload, synthTeacherUserId)).resolves.not.toThrow();

    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: synthAssignmentId } },
      orderBy: { sort_order: 'asc' }
    });
    expect(cols.length).toBe(4); // No duplicates
    expect(cols[0].id).toBe(ww1ColId);
    expect(cols[1].id).toBe(ww2ColId);
    expect(cols[2].id).toBe(pt1ColId);

    const entriesStudent1 = await prisma.grade_entries.findMany({
      where: { enrollment_id: synthEnrollment1Id }
    });
    expect(entriesStudent1.length).toBe(4); // No duplicates or deleted entries
  });

  it('TC-GRADE-001-D: Existing score update updates in-place without altering other student records', async () => {
    const payload = {
      T1: {
        wwItems: [
          { id: ww1ColId, label: 'Written Work 1', max: 20 },
          { id: ww2ColId, label: 'Written Work 2', max: 20 }
        ],
        ptItems: [
          { id: pt1ColId, label: 'Performance Task 1', max: 50 }
        ],
        qaMax: 100,
        grades: {
          [synthEnrollment1Id]: {
            [ww1ColId]: '20', // Updated from 18 to 20
            [ww2ColId]: '19',
            [pt1ColId]: '45',
            qa: '90'
          },
          [synthEnrollment2Id]: {
            [ww1ColId]: '0',
            [ww2ColId]: '15',
            [pt1ColId]: '40',
            qa: '80'
          }
        }
      }
    };

    await saveLedger(synthAssignmentId, payload, synthTeacherUserId);

    const s1WW1Entry = await prisma.grade_entries.findFirst({
      where: { enrollment_id: synthEnrollment1Id, column_id: ww1ColId }
    });
    expect(s1WW1Entry?.score).toBe(20);

    // Other student's score remains untouched
    const s2WW1Entry = await prisma.grade_entries.findFirst({
      where: { enrollment_id: synthEnrollment2Id, column_id: ww1ColId }
    });
    expect(s2WW1Entry?.score).toBe(0);
  });

  it('TC-GRADE-001-E & F: Recorded zero is preserved and cleared/missing scores remain absent (null)', async () => {
    const payload = {
      T1: {
        wwItems: [
          { id: ww1ColId, label: 'Written Work 1', max: 20 },
          { id: ww2ColId, label: 'Written Work 2', max: 20 }
        ],
        ptItems: [
          { id: pt1ColId, label: 'Performance Task 1', max: 50 }
        ],
        qaMax: 100,
        grades: {
          [synthEnrollment1Id]: {
            [ww1ColId]: '20',
            [ww2ColId]: '', // Cleared cell!
            [pt1ColId]: '45',
            qa: '90'
          },
          [synthEnrollment2Id]: {
            [ww1ColId]: '0', // Valid zero
            [ww2ColId]: '15',
            [pt1ColId]: '40',
            qa: '80'
          }
        }
      }
    };

    await saveLedger(synthAssignmentId, payload, synthTeacherUserId);

    // Student 1 WW2 entry was cleared -> must be deleted, leaving 3 entries
    const s1WW2 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: synthEnrollment1Id, column_id: ww2ColId }
    });
    expect(s1WW2).toBeNull();

    // Student 2 WW1 entry is 0 -> must exist with score 0
    const s2WW1 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: synthEnrollment2Id, column_id: ww1ColId }
    });
    expect(s2WW1).not.toBeNull();
    expect(s2WW1?.score).toBe(0);
  });

  it('TC-GRADE-001-G: Adding a new assessment column preserves existing columns and scores', async () => {
    ww3ColId = generateId();
    const payload = {
      T1: {
        wwItems: [
          { id: ww1ColId, label: 'Written Work 1', max: 20 },
          { id: ww2ColId, label: 'Written Work 2', max: 20 },
          { id: ww3ColId, label: 'Written Work 3', max: 25 } // Added WW3
        ],
        ptItems: [
          { id: pt1ColId, label: 'Performance Task 1', max: 50 }
        ],
        qaMax: 100,
        grades: {
          [synthEnrollment1Id]: {
            [ww1ColId]: '20',
            [ww3ColId]: '24', // New score for WW3
            [pt1ColId]: '45',
            qa: '90'
          }
        }
      }
    };

    await saveLedger(synthAssignmentId, payload, synthTeacherUserId);

    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: synthAssignmentId } }
    });
    expect(cols.length).toBe(5); // WW1, WW2, WW3, PT1, QA

    // Existing WW1 score preserved
    const s1WW1 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: synthEnrollment1Id, column_id: ww1ColId }
    });
    expect(s1WW1?.score).toBe(20);

    // New WW3 score recorded
    const s1WW3 = await prisma.grade_entries.findFirst({
      where: { enrollment_id: synthEnrollment1Id, column_id: ww3ColId }
    });
    expect(s1WW3?.score).toBe(24);
  });

  it('TC-GRADE-001-H: Removing an assessment column deletes dependent entries safely and atomically', async () => {
    // Remove WW2 from the payload
    const payload = {
      T1: {
        wwItems: [
          { id: ww1ColId, label: 'Written Work 1', max: 20 }
          // ww2ColId and ww3ColId omitted -> removed
        ],
        ptItems: [
          { id: pt1ColId, label: 'Performance Task 1', max: 50 }
        ],
        qaMax: 100,
        grades: {
          [synthEnrollment1Id]: {
            [ww1ColId]: '20',
            [pt1ColId]: '45',
            qa: '90'
          }
        },
        deletedColumnIds: [ww2ColId, ww3ColId]
      }
    };

    await saveLedger(synthAssignmentId, payload, synthTeacherUserId);

    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: synthAssignmentId } }
    });
    expect(cols.length).toBe(3); // WW1, PT1, QA

    // Columns WW2 and WW3 deleted
    const ww2 = await prisma.gradebook_columns.findUnique({ where: { id: ww2ColId } });
    expect(ww2).toBeNull();

    // Dependent entries for deleted columns deleted safely without foreign key error
    const ww2Entries = await prisma.grade_entries.findMany({ where: { column_id: ww2ColId } });
    expect(ww2Entries.length).toBe(0);
  });

  it('TC-GRADE-001-I: Transaction rollback preserves previous state on failure', async () => {
    const invalidClassId = 'non-existent-class-assignment';
    await expect(
      saveLedger(invalidClassId, { T1: { wwItems: [], ptItems: [], grades: {} } }, synthTeacherUserId)
    ).rejects.toThrow();
  });

  it('TC-GRADE-001-J: Unauthorized teacher receives 403 Forbidden', async () => {
    await expect(
      saveLedger(synthAssignmentId, { T1: { wwItems: [], ptItems: [], grades: {} } }, synthUnauthorizedTeacherUserId)
    ).rejects.toThrow(/You do not have access to modify this class gradebook/);

    // Also via HTTP route
    const res = await request(app)
      .post('/api/gradebooks/ledger')
      .set('Authorization', `Bearer ${unauthorizedTeacherToken}`)
      .send({
        classId: synthAssignmentId,
        terms: { T1: { wwItems: [], ptItems: [], grades: {} } }
      });
    expect(res.status).toBe(403);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PHASE 2: DEF-GRADE-002 (SERVICE-LEVEL GRADE VALIDATION)
  // ══════════════════════════════════════════════════════════════════════════════

  it('TC-GRADE-002-A: Valid grade input succeeds in direct upsertGrade call', async () => {
    const result = await upsertGrade({
      studentId: synthStudent1ProfileId,
      subjectId,
      term: 'T1',
      schoolYear: 'SY 2026-2027',
      writtenWork: 88.5,
      performanceTask: 92.0,
      termAssessment: 90.0,
      termGrade: 90.6
    }, synthTeacherUserId);

    expect(result).toBeDefined();
    expect(result.term_grade).toBe(90.6);
    expect(result.written_work).toBe(88.5);
  });

  it('TC-GRADE-002-B: Direct service call rejects negative values', async () => {
    await expect(
      upsertGrade({
        studentId: synthStudent1ProfileId,
        subjectId,
        term: 'T1',
        schoolYear: 'SY 2026-2027',
        writtenWork: -10.0 // Invalid negative
      }, synthTeacherUserId)
    ).rejects.toThrow();
  });

  it('TC-GRADE-002-C: Direct service call rejects above-maximum values (> 100)', async () => {
    await expect(
      upsertGrade({
        studentId: synthStudent1ProfileId,
        subjectId,
        term: 'T1',
        schoolYear: 'SY 2026-2027',
        writtenWork: 150.0 // Invalid > 100
      }, synthTeacherUserId)
    ).rejects.toThrow();

    await expect(
      upsertGrade({
        studentId: synthStudent1ProfileId,
        subjectId,
        term: 'T1',
        schoolYear: 'SY 2026-2027',
        termGrade: 105.0 // Invalid > 100
      }, synthTeacherUserId)
    ).rejects.toThrow();
  });

  it('TC-GRADE-002-D: Recorded zero is accepted as a valid score', async () => {
    const result = await upsertGrade({
      studentId: synthStudent2ProfileId,
      subjectId,
      term: 'T1',
      schoolYear: 'SY 2026-2027',
      writtenWork: 0.0,
      performanceTask: 75.0,
      termAssessment: 80.0,
      termGrade: 57.5
    }, synthTeacherUserId);

    expect(result).toBeDefined();
    expect(result.written_work).toBe(0.0);
  });

  it('TC-GRADE-002-E: Invalid numeric inputs (NaN, Infinity, non-numeric) are rejected', async () => {
    await expect(
      upsertGrade({
        studentId: synthStudent1ProfileId,
        subjectId,
        term: 'T1',
        schoolYear: 'SY 2026-2027',
        writtenWork: NaN as any
      }, synthTeacherUserId)
    ).rejects.toThrow();

    await expect(
      upsertGrade({
        studentId: synthStudent1ProfileId,
        subjectId,
        term: 'T1',
        schoolYear: 'SY 2026-2027',
        writtenWork: Infinity as any
      }, synthTeacherUserId)
    ).rejects.toThrow();

    await expect(
      upsertGrade({
        studentId: synthStudent1ProfileId,
        subjectId,
        term: 'T1',
        schoolYear: 'SY 2026-2027',
        writtenWork: 'eighty-five' as any
      }, synthTeacherUserId)
    ).rejects.toThrow();
  });

  it('TC-GRADE-002-F: Route and Service validation enforce identical constraints', async () => {
    // Calling HTTP route with writtenWork = 150 must return 400
    const res = await request(app)
      .post('/api/gradebooks/entries')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        studentId: synthStudent1ProfileId,
        subjectId,
        term: 'T1',
        schoolYear: 'SY 2026-2027',
        writtenWork: 150.0
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('TC-GRADE-002-G: Database integrity confirmed — no invalid Grade records were persisted', async () => {
    const invalidGrades = await prisma.grade.findMany({
      where: {
        OR: [
          { written_work: { gt: 100 } },
          { written_work: { lt: 0 } },
          { performance_task: { gt: 100 } },
          { performance_task: { lt: 0 } },
          { term_assessment: { gt: 100 } },
          { term_assessment: { lt: 0 } },
          { term_grade: { gt: 100 } },
          { term_grade: { lt: 0 } }
        ]
      }
    });

    expect(invalidGrades.length).toBe(0);
  });
});
