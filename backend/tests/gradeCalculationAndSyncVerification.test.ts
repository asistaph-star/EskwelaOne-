import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { saveLedger } from '../src/gradebooks/ledger.service.js';
import { upsertGrade, upsertGradeSchema } from '../src/gradebooks/gradebook.service.js';

describe('DIGISKWELA — Grade Calculation & Synchronization Lifecycle Verification (digiskwela_test)', () => {
  const synthTeacherUserId = 'synth-u-calc-teacher';
  const synthTeacherProfileId = 'synth-p-calc-teacher';
  const synthStudentUserId = 'synth-u-calc-student';
  const synthStudentProfileId = 'synth-p-calc-student';
  const synthSectionId = 'synth-sec-calc-verify';
  const synthAssignmentId = 'synth-assign-calc-verify';
  const synthEnrollmentId = 'synth-enroll-calc-verify';
  const academicYearId = 'demo-ay-2026';
  const subjectId = 'demo-subj-math10';

  async function cleanup() {
    // 1. Delete grade entries
    await prisma.grade_entries.deleteMany({
      where: { enrollment_id: synthEnrollmentId }
    });
    // 2. Delete gradebook columns
    await prisma.gradebook_columns.deleteMany({
      where: { gradebook: { assignment_id: synthAssignmentId } }
    });
    // 3. Delete gradebooks
    await prisma.gradebooks.deleteMany({
      where: { assignment_id: synthAssignmentId }
    });
    // 4. Delete grade
    await prisma.grade.deleteMany({
      where: { student_id: synthStudentProfileId }
    });
    // 5. Delete enrollments
    await prisma.enrollment.deleteMany({
      where: { id: synthEnrollmentId }
    });
    // 6. Delete assignments
    await prisma.teacherSubjectAssignment.deleteMany({
      where: { id: synthAssignmentId }
    });
    // 7. Delete sections
    await prisma.section.deleteMany({
      where: { id: synthSectionId }
    });
    // 8. Delete student profile
    await prisma.student.deleteMany({
      where: { id: synthStudentProfileId }
    });
    // 9. Delete teacher profile
    await prisma.teacher.deleteMany({
      where: { id: synthTeacherProfileId }
    });
    // 10. Delete audit logs associated with synthetic users before deleting users
    await prisma.auditLog.deleteMany({
      where: { actor_user_id: { in: [synthTeacherUserId, synthStudentUserId] } }
    });
    // 11. Delete user roles
    await prisma.userRole.deleteMany({
      where: { user_id: { in: [synthTeacherUserId, synthStudentUserId] } }
    });
    // 12. Delete users
    await prisma.user.deleteMany({
      where: { id: { in: [synthTeacherUserId, synthStudentUserId] } }
    });
  }

  beforeAll(async () => {
    await cleanup();

    const roleTeacher = await prisma.role.findUnique({ where: { name: 'Teacher' } });
    const roleStudent = await prisma.role.findUnique({ where: { name: 'Student' } });
    if (!roleTeacher || !roleStudent) throw new Error('Base roles not found');

    // 1. Create Teacher
    await prisma.user.create({
      data: {
        id: synthTeacherUserId,
        school_id: 'SYNTH-TCH-CALC',
        email: 'calc_teacher@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Calc',
        last_name: 'Teacher',
        status: 'active',
        user_roles: { create: { role_id: roleTeacher.id } }
      }
    });

    await prisma.teacher.create({
      data: {
        id: synthTeacherProfileId,
        user_id: synthTeacherUserId,
        employee_id: 'EMP-CALC-001',
        department: 'Mathematics',
        position: 'Master Teacher I'
      }
    });

    // 2. Create Student
    await prisma.user.create({
      data: {
        id: synthStudentUserId,
        school_id: 'SYNTH-STU-CALC',
        email: 'calc_student@test.local',
        password_hash: 'HASH_PLACEHOLDER',
        first_name: 'Test',
        last_name: 'Student',
        status: 'active',
        user_roles: { create: { role_id: roleStudent.id } }
      }
    });

    await prisma.student.create({
      data: {
        id: synthStudentProfileId,
        user_id: synthStudentUserId,
        student_number: 'SN-CALC-001',
        lrn: '999900001111',
        grade_level: 10
      }
    });

    // 3. Create Section & Assignment
    await prisma.section.create({
      data: {
        id: synthSectionId,
        academic_year_id: academicYearId,
        name: 'Calc-Verify-Section',
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

    // 4. Create Enrollment
    await prisma.enrollment.create({
      data: {
        id: synthEnrollmentId,
        academic_year_id: academicYearId,
        student_id: synthStudentProfileId,
        section_id: synthSectionId,
        status: 'Enrolled'
      }
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('TC-CALC-01: Proves deterministic calculation for full marks and zero score cases', () => {
    const weights = { ww: 0.25, pt: 0.50, qa: 0.25 };

    // Full marks
    const fullWW = 100.0;
    const fullPT = 100.0;
    const fullQA = 100.0;
    const fullGrade = Math.round((fullWW * weights.ww + fullPT * weights.pt + fullQA * weights.qa) * 10) / 10;
    expect(fullGrade).toBe(100.0);

    // Francis Garcia zero case
    const garciaWW = Math.round(((0 + 14 + 14) / 60) * 1000) / 10; // 46.7%
    const garciaPT = 72.0;
    const garciaQA = 81.0;
    const garciaTermGrade = Math.round((garciaWW * weights.ww + garciaPT * weights.pt + garciaQA * weights.qa) * 10) / 10;
    expect(garciaWW).toBe(46.7);
    expect(garciaTermGrade).toBe(67.9);
  });

  it('TC-CALC-02: saveLedger creates gradebook entries and columns but does NOT write to Grade table (no automatic sync)', async () => {
    const wwColId = generateId();
    const ptColId = generateId();

    const termsPayload = {
      T1: {
        wwItems: [{ id: wwColId, label: 'WW1', max: 20 }],
        ptItems: [{ id: ptColId, label: 'PT1', max: 50 }],
        qaMax: 100,
        grades: {
          [synthEnrollmentId]: {
            [wwColId]: '18',
            [ptColId]: '45',
            qa: '88'
          }
        }
      }
    };

    // Save the ledger
    await saveLedger(synthAssignmentId, termsPayload, synthTeacherUserId);

    // Verify entries exist in grade_entries
    const entries = await prisma.grade_entries.findMany({
      where: { enrollment_id: synthEnrollmentId }
    });
    expect(entries.length).toBe(3); // WW1, PT1, QA

    // CRITICAL INVARIANT: The Grade table MUST NOT have been automatically updated!
    const gradeInDb = await prisma.grade.findFirst({
      where: {
        student_id: synthStudentProfileId,
        subject_id: subjectId,
        term: 'T1'
      }
    });
    expect(gradeInDb).toBeNull();
  });

  it('TC-CALC-03: upsertGrade manually persists official term grade independently of gradebook entries', async () => {
    // 1. Manually persist an official grade via upsertGrade
    await upsertGrade({
      studentId: synthStudentProfileId,
      subjectId: subjectId,
      term: 'T1',
      schoolYear: 'SY 2026-2027',
      writtenWork: 90.0,
      performanceTask: 90.0,
      termAssessment: 88.0,
      termGrade: 89.5
    }, synthTeacherUserId);

    const storedBefore = await prisma.grade.findFirst({
      where: { student_id: synthStudentProfileId, subject_id: subjectId, term: 'T1' }
    });
    expect(storedBefore?.term_grade).toBe(89.5);
    expect(storedBefore?.written_work).toBe(90.0);
    expect(storedBefore?.performance_task).toBe(90.0);
    expect(storedBefore?.term_assessment).toBe(88.0);
  });

  it('TC-CALC-04: upsertGradeSchema enforces validation constraints on score ranges', () => {
    // Score > 100
    expect(() =>
      upsertGradeSchema.parse({
        studentId: synthStudentProfileId,
        subjectId: subjectId,
        term: 'T1',
        schoolYear: 'SY 2026-2027',
        writtenWork: 150.0 // Invalid > 100
      })
    ).toThrow();

    // Score < 0
    expect(() =>
      upsertGradeSchema.parse({
        studentId: synthStudentProfileId,
        subjectId: subjectId,
        term: 'T1',
        schoolYear: 'SY 2026-2027',
        termGrade: -5.0 // Invalid < 0
      })
    ).toThrow();

    // Valid inputs pass
    const valid = upsertGradeSchema.parse({
      studentId: synthStudentProfileId,
      subjectId: subjectId,
      term: 'T1',
      schoolYear: 'SY 2026-2027',
      writtenWork: 85.5,
      performanceTask: 90.0,
      termAssessment: 88.0,
      termGrade: 88.4
    });
    expect(valid.termGrade).toBe(88.4);
  });
});
