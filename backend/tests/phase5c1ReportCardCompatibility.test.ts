/**
 * DIGISKWELA — PHASE 5C-1 INTEGRATION & COMPATIBILITY TEST SUITE
 * Module: phase5c1ReportCardCompatibility.test.ts
 *
 * Verifies Phase 5C-1 corrections in digiskwela_test:
 * 1. Unpublished draft grades are prevented from appearing in student-facing reporting (isStudentSelf === true).
 * 2. MAPEH consolidation: Music & Arts + PE & Health are consolidated into MAPEH.
 * 3. Eight-learning-area General Average: Sum of 8 official learning areas divided by 8.
 * 4. Alignment of reportCard.service.ts, sf10.service.ts, and student portal calculation with official SF9.
 * 5. Publication-state handling without modifying database records.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../src/config/database.js';
import { getReportCardData } from '../src/academic/reportCard.service.js';
import { getSF10Data } from '../src/academic/sf10.service.js';
import { generateId } from '../src/common/utils/uuid.js';

describe('Phase 5C-1: Student Grade Privacy & Report Card Calculation Corrections', () => {

  const testAyId = 'test-ay-phase5c1';
  const testSectionId = 'test-sec-phase5c1';
  const testStudentId = 'test-stu-phase5c1';
  const testStudentUserId = 'test-user-stu-phase5c1';
  const testTeacherUserId = 'test-user-tea-phase5c1';
  const testAdminUserId = 'test-user-adm-phase5c1';

  // 9 Subjects: 7 Core + Music + PE
  const subjects = [
    { id: 'subj-fil-5c1', name: 'Filipino 10', code: '5C1_FIL' },
    { id: 'subj-eng-5c1', name: 'English 10', code: '5C1_ENG' },
    { id: 'subj-math-5c1', name: 'Mathematics 10', code: '5C1_MATH' },
    { id: 'subj-sci-5c1', name: 'Science 10', code: '5C1_SCI' },
    { id: 'subj-ap-5c1', name: 'Araling Panlipunan 10', code: '5C1_AP' },
    { id: 'subj-esp-5c1', name: 'Values Education 10', code: '5C1_VE' },
    { id: 'subj-tle-5c1', name: 'Technology & Livelihood Education 10', code: '5C1_TLE' },
    { id: 'subj-mus-5c1', name: 'Music and Arts 10', code: '5C1_MUS' },
    { id: 'subj-pe-5c1', name: 'Physical Education and Health 10', code: '5C1_PE' },
  ];

  beforeEach(async () => {
    // Clean up test fixtures in digiskwela_test
    await prisma.grade.deleteMany({ where: { academic_year_id: testAyId } }).catch(() => {});
    await prisma.gradebooks.deleteMany({ where: { assignment: { section_id: testSectionId } } }).catch(() => {});
    await prisma.teacherSubjectAssignment.deleteMany({ where: { section_id: testSectionId } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { student_id: testStudentId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { id: testStudentId } }).catch(() => {});
    await prisma.section.deleteMany({ where: { id: testSectionId } }).catch(() => {});
    await prisma.term.deleteMany({ where: { academic_year_id: testAyId } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: testAyId } }).catch(() => {});
    await prisma.teacher.deleteMany({ where: { id: 'tea-rec-5c1' } }).catch(() => {});
    await prisma.userRole.deleteMany({ where: { user_id: { in: [testStudentUserId, testTeacherUserId, testAdminUserId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [testStudentUserId, testTeacherUserId, testAdminUserId] } } }).catch(() => {});
    for (const s of subjects) {
      await prisma.subject.deleteMany({ where: { id: s.id } }).catch(() => {});
    }

    // Provision Academic Year & Terms
    await prisma.academicYear.create({
      data: {
        id: testAyId,
        name: 'SY 2026-2027 5C1',
        start_date: new Date('2026-06-01'),
        end_date: new Date('2027-03-31'),
        is_current: false,
      }
    });

    for (const termKey of ['T1', 'T2', 'T3'] as const) {
      await prisma.term.create({
        data: {
          id: `term-${termKey.toLowerCase()}-5c1`,
          academic_year_id: testAyId,
          key: termKey,
          name: `${termKey === 'T1' ? 'First' : termKey === 'T2' ? 'Second' : 'Third'} Term`,
        }
      });
    }

    // Provision Users & Roles
    const studentRole = await prisma.role.findFirst({ where: { name: 'Student' } }) ??
      await prisma.role.create({ data: { id: generateId(), name: 'Student' } });
    const teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' } }) ??
      await prisma.role.create({ data: { id: generateId(), name: 'Teacher' } });
    const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } }) ??
      await prisma.role.create({ data: { id: generateId(), name: 'Admin' } });

    await prisma.user.create({
      data: {
        id: testStudentUserId,
        school_id: 'STU-5C1',
        email: 'student5c1@test.com',
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
        user_roles: { create: { role_id: studentRole.id } }
      }
    });

    await prisma.user.create({
      data: {
        id: testTeacherUserId,
        school_id: 'TEA-5C1',
        email: 'teacher5c1@test.com',
        first_name: 'Maria',
        last_name: 'Clara',
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
        user_roles: { create: { role_id: teacherRole.id } }
      }
    });

    await prisma.user.create({
      data: {
        id: testAdminUserId,
        school_id: 'ADM-5C1',
        email: 'admin5c1@test.com',
        first_name: 'Admin',
        last_name: 'Owner',
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
        user_roles: { create: { role_id: adminRole.id } }
      }
    });

    const teacherRec = await prisma.teacher.create({
      data: {
        id: `tea-rec-5c1`,
        user_id: testTeacherUserId,
        employee_id: 'EMP-5C1',
      }
    });

    // Provision Section
    await prisma.section.create({
      data: {
        id: testSectionId,
        name: 'Rizal',
        grade_level: 10,
        academic_year_id: testAyId,
        adviser_teacher_id: teacherRec.id,
      }
    });

    // Provision Student & Enrollment
    await prisma.student.create({
      data: {
        id: testStudentId,
        user_id: testStudentUserId,
        current_section_id: testSectionId,
        lrn: '123456789012',
        gender: 'male',
        grade_level: 10,
      }
    });

    await prisma.enrollment.create({
      data: {
        id: `enr-5c1`,
        student_id: testStudentId,
        section_id: testSectionId,
        academic_year_id: testAyId,
        status: 'Enrolled',
      }
    });

    // Provision 9 Subjects & Assignments
    for (const s of subjects) {
      await prisma.subject.create({
        data: {
          id: s.id,
          name: s.name,
          code: s.code,
        }
      });

      await prisma.teacherSubjectAssignment.create({
        data: {
          id: `asgn-${s.id}`,
          teacher_id: teacherRec.id,
          section_id: testSectionId,
          subject_id: s.id,
          academic_year_id: testAyId,
        }
      });
    }
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.grade.deleteMany({ where: { academic_year_id: testAyId } }).catch(() => {});
    await prisma.gradebooks.deleteMany({ where: { assignment: { section_id: testSectionId } } }).catch(() => {});
    await prisma.teacherSubjectAssignment.deleteMany({ where: { section_id: testSectionId } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { student_id: testStudentId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { id: testStudentId } }).catch(() => {});
    await prisma.section.deleteMany({ where: { id: testSectionId } }).catch(() => {});
    await prisma.term.deleteMany({ where: { academic_year_id: testAyId } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: testAyId } }).catch(() => {});
    await prisma.teacher.deleteMany({ where: { id: 'tea-rec-5c1' } }).catch(() => {});
    await prisma.userRole.deleteMany({ where: { user_id: { in: [testStudentUserId, testTeacherUserId, testAdminUserId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [testStudentUserId, testTeacherUserId, testAdminUserId] } } }).catch(() => {});
    for (const s of subjects) {
      await prisma.subject.deleteMany({ where: { id: s.id } }).catch(() => {});
    }
  });

  it('1. Prevents unpublished draft grades from appearing when viewed by student (isStudentSelf === true)', async () => {
    // Create draft grades for student in Math (without published gradebook)
    await prisma.grade.create({
      data: {
        id: generateId(),
        student_id: testStudentId,
        subject_id: 'subj-math-5c1',
        term: 'T1',
        academic_year_id: testAyId,
        term_grade: 88,
        published_term_grade: null,
        published_gradebook_id: null,
      }
    });

    // When student views own report card -> Math T1 must be null (draft hidden)
    const studentReport = await getReportCardData(testStudentId, testStudentUserId);
    const mathSubjStudent = studentReport.scholastic.subjects.find(s => s.name.includes('Math'));
    expect(mathSubjStudent?.T1).toBeNull();

    // When student views own SF10 -> Math T1 must also be null (draft hidden)
    const studentSf10 = await getSF10Data(testStudentId, testStudentUserId);
    const mathSubjSf10 = studentSf10.academicYears[0]?.subjects.find(s => s.name.includes('Math'));
    expect(mathSubjSf10?.T1).toBeNull();

    // When staff/admin views official permanent SF10 -> Math T1 must STILL be null (draft strictly excluded from permanent record)
    const staffSf10 = await getSF10Data(testStudentId, testAdminUserId);
    const mathSubjStaffSf10 = staffSf10.academicYears[0]?.subjects.find(s => s.name.includes('Math'));
    expect(mathSubjStaffSf10?.T1).toBeNull();

    // When teacher views student report card -> Math T1 is visible for staff review
    const teacherReport = await getReportCardData(testStudentId, testTeacherUserId);
    const mathSubjTeacher = teacherReport.scholastic.subjects.find(s => s.name.includes('Math'));
    expect(mathSubjTeacher?.T1).toBe(88);
  });

  it('2. Exposes grades to student once the gradebook is officially published', async () => {
    // Create a gradebook with status 'Published'
    const publishedGb = await prisma.gradebooks.create({
      data: {
        id: generateId(),
        assignment_id: 'asgn-subj-math-5c1',
        term_id: 'term-t1-5c1',
        status: 'Published',
        version: 2,
        updated_at: new Date(),
      }
    });

    // Create published grade record linked to published gradebook
    await prisma.grade.create({
      data: {
        id: generateId(),
        student_id: testStudentId,
        subject_id: 'subj-math-5c1',
        term: 'T1',
        academic_year_id: testAyId,
        term_grade: 91,
        published_term_grade: 91,
        published_gradebook_id: publishedGb.id,
      }
    });

    // When student views report card -> published grade is visible
    const studentReport = await getReportCardData(testStudentId, testStudentUserId);
    const mathSubj = studentReport.scholastic.subjects.find(s => s.name.includes('Math'));
    expect(mathSubj?.T1).toBe(91);
  });

  it('3. Correctly consolidates Music & Arts and PE & Health into MAPEH and divides General Average by 8', async () => {
    // Create published gradebooks for all subjects across all 3 terms
    for (const s of subjects) {
      for (const t of ['T1', 'T2', 'T3'] as const) {
        const gb = await prisma.gradebooks.create({
          data: {
            id: generateId(),
            assignment_id: `asgn-${s.id}`,
            term_id: `term-${t.toLowerCase()}-5c1`,
            status: 'Published',
            version: 1,
            updated_at: new Date(),
          }
        });

        // Grades scenario:
        // 7 Core Subjects: 80 in all 3 terms -> Final = 80
        // Music: 98 in all 3 terms -> Final = 98
        // PE: 98 in all 3 terms -> Final = 98
        let gradeVal = 80;
        if (s.id === 'subj-mus-5c1' || s.id === 'subj-pe-5c1') {
          gradeVal = 98;
        }

        await prisma.grade.create({
          data: {
            id: generateId(),
            student_id: testStudentId,
            subject_id: s.id,
            term: t,
            academic_year_id: testAyId,
            term_grade: gradeVal,
            published_term_grade: gradeVal,
            published_gradebook_id: gb.id,
          }
        });
      }
    }

    const reportCard = await getReportCardData(testStudentId, testStudentUserId);

    // Assert subjects array has exactly 8 official learning areas
    expect(reportCard.scholastic.subjects.length).toBe(8);

    // Confirm raw Music and PE are NOT standalone subjects in report card
    const rawMusic = reportCard.scholastic.subjects.find(s => s.id === 'subj-mus-5c1');
    const rawPe = reportCard.scholastic.subjects.find(s => s.id === 'subj-pe-5c1');
    expect(rawMusic).toBeUndefined();
    expect(rawPe).toBeUndefined();

    // Confirm consolidated MAPEH exists with 50/50 composite
    const mapeh = reportCard.scholastic.subjects.find(s => s.name === 'MAPEH');
    expect(mapeh).toBeDefined();
    expect(mapeh?.T1).toBe(98); // (98 + 98) / 2
    expect(mapeh?.T2).toBe(98);
    expect(mapeh?.T3).toBe(98);
    expect(mapeh?.finalRating).toBe(98);
    expect(mapeh?.remarks).toBe('PASSED');

    // Confirm General Average is calculated across 8 learning areas:
    // (7 * 80 + 98) / 8 = (560 + 98) / 8 = 658 / 8 = 82.25 -> 82
    // (If it incorrectly divided by 9, it would be 84)
    expect(reportCard.scholastic.generalAverage).toBe(82);

    // Also verify SF10 produces the identical 8 learning areas and General Average = 82
    const sf10 = await getSF10Data(testStudentId, testStudentUserId);
    expect(sf10.academicYears.length).toBe(1);
    const sf10Year = sf10.academicYears[0];
    expect(sf10Year.subjects.length).toBe(8);
    const sf10Mapeh = sf10Year.subjects.find(s => s.name === 'MAPEH');
    expect(sf10Mapeh?.finalRating).toBe(98);
    expect(sf10Year.generalAverage).toBe(82);
  });

  it('4. Retains null General Average when terms are incomplete', async () => {
    // Only Term 1 published for Math
    const gb = await prisma.gradebooks.create({
      data: {
        id: generateId(),
        assignment_id: 'asgn-subj-math-5c1',
        term_id: 'term-t1-5c1',
        status: 'Published',
        version: 1,
        updated_at: new Date(),
      }
    });

    await prisma.grade.create({
      data: {
        id: generateId(),
        student_id: testStudentId,
        subject_id: 'subj-math-5c1',
        term: 'T1',
        academic_year_id: testAyId,
        term_grade: 85,
        published_term_grade: 85,
        published_gradebook_id: gb.id,
      }
    });

    const reportCard = await getReportCardData(testStudentId, testStudentUserId);
    expect(reportCard.scholastic.generalAverage).toBeNull();
  });

  it('5. Strictly rejects cross-student report card and SF10 requests with 403 FORBIDDEN', async () => {
    // Provision another student
    const studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
    const studentBUserId = 'test-user-stub-5c1';
    await prisma.user.create({
      data: {
        id: studentBUserId,
        school_id: 'STU-B-5C1',
        email: 'studentB@test.com',
        first_name: 'Maria',
        last_name: 'Santos',
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
        user_roles: { create: { role_id: studentRole!.id } }
      }
    });

    try {
      // Student B attempts to access Student A's report card -> must throw 403 FORBIDDEN
      await expect(getReportCardData(testStudentId, studentBUserId)).rejects.toThrow('not authorized');

      // Student B attempts to access Student A's SF10 -> must throw 403 FORBIDDEN
      await expect(getSF10Data(testStudentId, studentBUserId)).rejects.toThrow('not authorized');
    } finally {
      await prisma.userRole.deleteMany({ where: { user_id: studentBUserId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: studentBUserId } }).catch(() => {});
    }
  });
});
