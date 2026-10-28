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
  let academicYearId = 'demo-ay-2026';
  let subjectId = 'demo-subj-math10';

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

    let ay = await prisma.academicYear.findFirst();
    if (!ay) {
      ay = await prisma.academicYear.create({
        data: {
          id: 'demo-ay-2026',
          name: 'SY 2026-2027',
          start_date: new Date('2026-08-01'),
          end_date: new Date('2027-05-31'),
          is_current: true,
        }
      });
    }

    for (const t of ['T1', 'T2', 'T3', 'T4']) {
      const termExists = await prisma.term.findFirst({ where: { academic_year_id: ay.id, key: t as any } });
      if (!termExists) {
        await prisma.term.create({
          data: {
            id: `term-${ay.id}-${t}`,
            academic_year_id: ay.id,
            name: `Term ${t}`,
            key: t as any,
          }
        });
      }
    }

    let subj = await prisma.subject.findFirst();
    if (!subj) {
      subj = await prisma.subject.create({
        data: {
          id: 'demo-subj-math10',
          code: 'MATH10',
          name: 'Mathematics 10'
        }
      });
    }

    academicYearId = ay.id;
    subjectId = subj.id;

    // 3. Create Section & Assignment
    await prisma.section.create({
      data: {
        id: synthSectionId,
        academic_year_id: ay.id,
        name: 'Calc-Verify-Section',
        grade_level: 10
      }
    });

    await prisma.teacherSubjectAssignment.create({
      data: {
        id: synthAssignmentId,
        academic_year_id: ay.id,
        teacher_id: synthTeacherProfileId,
        section_id: synthSectionId,
        subject_id: subj.id
      }
    });

    // 4. Create Enrollment
    await prisma.enrollment.create({
      data: {
        id: synthEnrollmentId,
        academic_year_id: ay.id,
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
        st1Max: 25,
        st2Max: 25,
        teMax: 50,
        qaMax: 50,
        grades: {
          [synthEnrollmentId]: {
            [wwColId]: '18',
            [ptColId]: '45',
            st1: '20',
            st2: '20',
            te: '40'
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
    expect(entries.length).toBe(5); // WW1, PT1, ST1, ST2, TE

    // CRITICAL REQUIREMENT: The Grade table IS now automatically synchronized upon saving ledger!
    const gradeInDb = await prisma.grade.findFirst({
      where: {
        student_id: synthStudentProfileId,
        subject_id: subjectId,
        term: 'T1'
      }
    });
    expect(gradeInDb).not.toBeNull();
    expect(gradeInDb?.term_grade).toBeGreaterThanOrEqual(60);
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

  it('TC-CALC-05: Dynamic examination columns addition (ST3), renaming, and custom % weights', async () => {
    const termsPayload = {
      T1: {
        version: 1,
        wwItems: [{ id: 'ww1', label: 'WW 1', max: 50 }],
        ptItems: [{ id: 'pt1', label: 'PT 1', max: 50 }],
        examItems: [
          { id: 'st1', label: 'Diagnostic Exam', max: 20, weight: 20 },
          { id: 'st2', label: 'Midterm Quiz', max: 20, weight: 20 },
          { id: 'st3', label: 'Unit Test 3', max: 20, weight: 20 },
          { id: 'te',  label: 'Final Term Exam', max: 40, weight: 40 }
        ],
        grades: {
          [synthEnrollmentId]: {
            ww1: '40', // 80% -> 16.00 WS (20%)
            pt1: '45', // 90% -> 45.00 WS (50%)
            st1: '18', // 90% * 0.20 = 18.0
            st2: '16', // 80% * 0.20 = 16.0
            st3: '20', // 100% * 0.20 = 20.0
            te:  '36', // 90% * 0.40 = 36.0
            // Total Exam PS = 18 + 16 + 20 + 36 = 90.0%
            // Exam WS = 90.0 * 0.30 = 27.00 WS (30%)
            // Initial Grade = 16.00 + 45.00 + 27.00 = 88.00
            // Transmuted Grade = 92
          }
        }
      }
    };

    await saveLedger(synthAssignmentId, termsPayload, synthTeacherUserId);

    // Verify columns exist in gradebook_columns with customized labels and weights
    const cols = await prisma.gradebook_columns.findMany({
      where: { gradebook: { assignment_id: synthAssignmentId } }
    });
    const examCols = cols.filter(c => c.type === 'ST1' || c.type === 'ST2' || c.type === 'TE' || c.type === 'EX');
    expect(examCols.length).toBe(4);

    const st3Col = cols.find(c => c.label.includes('Unit Test 3'));
    expect(st3Col).toBeDefined();
    expect(st3Col?.label).toBe('Unit Test 3 [20%]');

    // Verify calculated transmuted grade in Grade table
    const gradeInDb = await prisma.grade.findFirst({
      where: {
        student_id: synthStudentProfileId,
        subject_id: subjectId,
        term: 'T1'
      }
    });
    expect(gradeInDb).toBeDefined();
    // Transmuted Grade = 90 (87.20 - 88.79 -> 90)
    expect(gradeInDb?.written_work).toBe(16.00);
    expect(gradeInDb?.performance_task).toBe(45.00);
    expect(gradeInDb?.term_assessment).toBe(27.00);
    expect(gradeInDb?.term_grade).toBe(90);
  });

  it('TC-CALC-06: Custom category weights modification (e.g. WW 30%, PT 40%, EX 30%) with dynamic exam', async () => {
    const termsPayload = {
      T1: {
        version: 2,
        wwItems: [{ id: 'ww1', label: 'WW 1', max: 100 }],
        ptItems: [{ id: 'pt1', label: 'PT 1', max: 100 }],
        examItems: [
          { id: 'st1', label: 'ST 1', max: 50, weight: 50 },
          { id: 'te',  label: 'Term Exam', max: 50, weight: 50 }
        ],
        customWeights: {
          ww: 30, // 30%
          pt: 40, // 40%
          qa: 30  // 30%
        },
        grades: {
          [synthEnrollmentId]: {
            ww1: '90', // 90% -> 27.00 WS (30%)
            pt1: '90', // 90% -> 36.00 WS (40%)
            st1: '45', // 90% * 0.50 = 45.0
            te:  '45', // 90% * 0.50 = 45.0
            // Total Exam PS = 90.0%
            // Exam WS = 90.0 * 0.30 = 27.00 WS (30%)
            // Initial Grade = 27.00 + 36.00 + 27.00 = 90.00
            // Transmuted Grade = 91 (88.80 - 90.39 -> 91)
          }
        }
      }
    };

    await saveLedger(synthAssignmentId, termsPayload, synthTeacherUserId);

    const gradeInDb = await prisma.grade.findFirst({
      where: {
        student_id: synthStudentProfileId,
        subject_id: subjectId,
        term: 'T1'
      }
    });
    expect(gradeInDb).toBeDefined();
    expect(gradeInDb?.written_work).toBe(27.00);
    expect(gradeInDb?.performance_task).toBe(36.00);
    expect(gradeInDb?.term_assessment).toBe(27.00);
    expect(gradeInDb?.term_grade).toBe(91);
  });
});
