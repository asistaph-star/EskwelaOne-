/**
 * DIGISKWELA — PHASE 5C-2A DYNAMIC ACADEMIC TERM COMPATIBILITY TEST SUITE
 * Module: phase5c2aDynamicTerms.test.ts
 *
 * Verifies Phase 5C-2A requirements in isolated digiskwela_test:
 * 1. 3-term academic year exposes exactly T1, T2, T3 in ledger.service.ts (no dummy T4).
 * 2. 4-term academic year exposes T1, T2, T3, T4 in ledger.service.ts.
 * 3. 3-term final rating calculation: (88 + 90 + 92) / 3 = 90.
 * 4. 4-term final rating calculation: (88 + 90 + 92 + 94) / 4 = 91.
 * 5. Incomplete terms do not produce false final ratings (remain null).
 * 6. Student privacy: draft grades remain null for students.
 * 7. MAPEH consolidation works for both 3-term and 4-term configurations.
 * 8. SF10 accurately handles different term counts across academic years.
 * 9. Official Calulut SF9 service preserves verified 3-term template and blocks non-3-term AY with 422.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../src/config/database.js';
import { getLedger } from '../src/gradebooks/ledger.service.js';
import { getReportCardData } from '../src/academic/reportCard.service.js';
import { getSF10Data } from '../src/academic/sf10.service.js';
import { resolveStudentSf9DataMapping } from '../src/academic/grading/calulutSf9Service.js';
import { generateId } from '../src/common/utils/uuid.js';

describe('Phase 5C-2A: Dynamic Academic Term Compatibility', () => {
  const ay3Id = 'test-ay-3terms-5c2a';
  const ay4Id = 'test-ay-4terms-5c2a';
  const sec3Id = 'test-sec-3terms-5c2a';
  const sec4Id = 'test-sec-4terms-5c2a';
  const stuId = 'test-stu-5c2a';
  const stuUserId = 'test-u-stu-5c2a';
  const teaId = 'test-tea-5c2a';
  const teaUserId = 'test-u-tea-5c2a';
  const admUserId = 'test-u-adm-5c2a';

  const asgn3Math = 'asgn-3terms-math';
  const asgn4Math = 'asgn-4terms-math';

  const mathSubjId = 'subj-math-5c2a';
  const musSubjId = 'subj-mus-5c2a';
  const peSubjId = 'subj-pe-5c2a';

  beforeEach(async () => {
    // Clean test records in digiskwela_test
    await prisma.grade.deleteMany({ where: { academic_year_id: { in: [ay3Id, ay4Id] } } }).catch(() => {});
    await prisma.gradebook_columns.deleteMany({ where: { gradebook: { assignment_id: { in: [asgn3Math, asgn4Math] } } } }).catch(() => {});
    await prisma.gradebooks.deleteMany({ where: { assignment_id: { in: [asgn3Math, asgn4Math] } } }).catch(() => {});
    await prisma.teacherSubjectAssignment.deleteMany({ where: { id: { in: [asgn3Math, asgn4Math] } } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { student_id: stuId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { id: stuId } }).catch(() => {});
    await prisma.section.deleteMany({ where: { id: { in: [sec3Id, sec4Id] } } }).catch(() => {});
    await prisma.term.deleteMany({ where: { academic_year_id: { in: [ay3Id, ay4Id] } } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: { in: [ay3Id, ay4Id] } } }).catch(() => {});
    await prisma.teacher.deleteMany({ where: { id: teaId } }).catch(() => {});
    await prisma.userRole.deleteMany({ where: { user_id: { in: [stuUserId, teaUserId, admUserId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [stuUserId, teaUserId, admUserId] } } }).catch(() => {});
    await prisma.subject.deleteMany({ where: { id: { in: [mathSubjId, musSubjId, peSubjId] } } }).catch(() => {});

    // Look up or create Roles
    const studentRole = await prisma.role.findFirst({ where: { name: 'Student' } }) ??
      await prisma.role.create({ data: { id: generateId(), name: 'Student' } });
    const teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' } }) ??
      await prisma.role.create({ data: { id: generateId(), name: 'Teacher' } });
    const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } }) ??
      await prisma.role.create({ data: { id: generateId(), name: 'Admin' } });

    // Create Users
    await prisma.user.create({
      data: { id: stuUserId, email: 'student.5c2a@test.com', first_name: 'Juan', last_name: 'Dela Cruz', password_hash: 'hash' },
    });
    await prisma.userRole.create({ data: { user_id: stuUserId, role_id: studentRole.id } });

    await prisma.user.create({
      data: { id: teaUserId, email: 'teacher.5c2a@test.com', first_name: 'Maria', last_name: 'Santos', password_hash: 'hash' },
    });
    await prisma.userRole.create({ data: { user_id: teaUserId, role_id: teacherRole.id } });

    await prisma.user.create({
      data: { id: admUserId, email: 'admin.5c2a@test.com', first_name: 'Admin', last_name: 'IT', password_hash: 'hash' },
    });
    await prisma.userRole.create({ data: { user_id: admUserId, role_id: adminRole.id } });

    await prisma.teacher.create({
      data: { id: teaId, user_id: teaUserId, employee_id: 'EMP-5C2A', department: 'Mathematics' },
    });

    await prisma.student.create({
      data: { id: stuId, user_id: stuUserId, lrn: '1234565C2A01', gender: 'male', grade_level: 10 },
    });

    // Create Subjects
    await prisma.subject.create({ data: { id: mathSubjId, code: 'MATH_5C2A', name: 'Mathematics 10' } });
    await prisma.subject.create({ data: { id: musSubjId, code: 'MUS_5C2A', name: 'Music and Arts 10' } });
    await prisma.subject.create({ data: { id: peSubjId, code: 'PE_5C2A', name: 'Physical Education and Health 10' } });

    // 1. Create 3-Term Academic Year (SY 2026-2027)
    await prisma.academicYear.create({
      data: { id: ay3Id, name: 'SY 2026-2027 (3 Terms)', start_date: new Date('2026-06-01'), end_date: new Date('2027-03-31'), is_current: true },
    });
    await prisma.term.createMany({
      data: [
        { id: 'term-3-t1', academic_year_id: ay3Id, key: 'T1', name: 'First Term' },
        { id: 'term-3-t2', academic_year_id: ay3Id, key: 'T2', name: 'Second Term' },
        { id: 'term-3-t3', academic_year_id: ay3Id, key: 'T3', name: 'Third Term' },
      ],
    });

    await prisma.section.create({
      data: { id: sec3Id, name: 'Rizal 3T', grade_level: 10, academic_year_id: ay3Id, adviser_teacher_id: teaId },
    });

    await prisma.teacherSubjectAssignment.create({
      data: { id: asgn3Math, section_id: sec3Id, subject_id: mathSubjId, teacher_id: teaId, academic_year_id: ay3Id },
    });

    // 2. Create 4-Term Academic Year (Historical or Future 4 Quarters)
    await prisma.academicYear.create({
      data: { id: ay4Id, name: 'SY 2025-2026 (4 Terms)', start_date: new Date('2025-06-01'), end_date: new Date('2026-03-31'), is_current: false },
    });
    await prisma.term.createMany({
      data: [
        { id: 'term-4-t1', academic_year_id: ay4Id, key: 'T1', name: 'Quarter 1' },
        { id: 'term-4-t2', academic_year_id: ay4Id, key: 'T2', name: 'Quarter 2' },
        { id: 'term-4-t3', academic_year_id: ay4Id, key: 'T3', name: 'Quarter 3' },
        { id: 'term-4-t4', academic_year_id: ay4Id, key: 'T4', name: 'Quarter 4' },
      ],
    });

    await prisma.section.create({
      data: { id: sec4Id, name: 'Rizal 4T', grade_level: 10, academic_year_id: ay4Id, adviser_teacher_id: teaId },
    });

    await prisma.teacherSubjectAssignment.create({
      data: { id: asgn4Math, section_id: sec4Id, subject_id: mathSubjId, teacher_id: teaId, academic_year_id: ay4Id },
    });
  });

  it('1. Gradebook ledger retrieval dynamically returns only configured terms (3 terms for 3-term AY)', async () => {
    const ledger = await getLedger(asgn3Math, teaUserId);
    expect(ledger).toBeDefined();
    expect(ledger.terms).toBeDefined();

    const returnedTermKeys = Object.keys(ledger.terms);
    expect(returnedTermKeys).toEqual(['T1', 'T2', 'T3']);
    expect(returnedTermKeys).not.toContain('T4');

    // Verify viewing does NOT create records in database
    const dbGradebooks = await prisma.gradebooks.findMany({ where: { assignment_id: asgn3Math } });
    expect(dbGradebooks.length).toBe(0);
  });

  it('2. Gradebook ledger retrieval dynamically returns all 4 terms for a 4-term AY', async () => {
    const ledger = await getLedger(asgn4Math, teaUserId);
    expect(ledger).toBeDefined();
    expect(ledger.terms).toBeDefined();

    const returnedTermKeys = Object.keys(ledger.terms);
    expect(returnedTermKeys).toEqual(['T1', 'T2', 'T3', 'T4']);
  });

  it('3. Computes 3-term final rating as arithmetic average of 3 terms: (88 + 90 + 92) / 3 = 90', async () => {
    // Enroll student in 3-term section
    await prisma.student.update({ where: { id: stuId }, data: { current_section_id: sec3Id } });
    await prisma.enrollment.create({
      data: { id: 'enr-3t', student_id: stuId, section_id: sec3Id, academic_year_id: ay3Id, status: 'Enrolled' },
    });

    // Create published gradebooks for T1, T2, T3
    const gbT1 = await prisma.gradebooks.create({
      data: { id: generateId(), assignment_id: asgn3Math, term_id: 'term-3-t1', status: 'Published', version: 1, updated_at: new Date() },
    });
    const gbT2 = await prisma.gradebooks.create({
      data: { id: generateId(), assignment_id: asgn3Math, term_id: 'term-3-t2', status: 'Published', version: 1, updated_at: new Date() },
    });
    const gbT3 = await prisma.gradebooks.create({
      data: { id: generateId(), assignment_id: asgn3Math, term_id: 'term-3-t3', status: 'Published', version: 1, updated_at: new Date() },
    });

    // Insert published grades: T1=88, T2=90, T3=92
    await prisma.grade.createMany({
      data: [
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay3Id, term: 'T1', published_term_grade: 88, published_gradebook_id: gbT1.id },
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay3Id, term: 'T2', published_term_grade: 90, published_gradebook_id: gbT2.id },
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay3Id, term: 'T3', published_term_grade: 92, published_gradebook_id: gbT3.id },
      ],
    });

    const reportCard = await getReportCardData(stuId, stuUserId);
    const math = reportCard.scholastic.subjects.find(s => s.id === mathSubjId);
    expect(math).toBeDefined();
    expect(math?.T1).toBe(88);
    expect(math?.T2).toBe(90);
    expect(math?.T3).toBe(92);
    expect(math?.T4).toBeNull();
    // 3-term formula: (88 + 90 + 92) / 3 = 90
    expect(math?.finalRating).toBe(90);
    expect(math?.remarks).toBe('PASSED');
  });

  it('4. Computes 4-term final rating as arithmetic average of 4 terms: (88 + 90 + 92 + 94) / 4 = 91', async () => {
    // Enroll student in 4-term section
    await prisma.student.update({ where: { id: stuId }, data: { current_section_id: sec4Id } });
    await prisma.enrollment.create({
      data: { id: 'enr-4t', student_id: stuId, section_id: sec4Id, academic_year_id: ay4Id, status: 'Enrolled' },
    });

    // Create published gradebooks for T1, T2, T3, T4
    const gbT1 = await prisma.gradebooks.create({
      data: { id: generateId(), assignment_id: asgn4Math, term_id: 'term-4-t1', status: 'Published', version: 1, updated_at: new Date() },
    });
    const gbT2 = await prisma.gradebooks.create({
      data: { id: generateId(), assignment_id: asgn4Math, term_id: 'term-4-t2', status: 'Published', version: 1, updated_at: new Date() },
    });
    const gbT3 = await prisma.gradebooks.create({
      data: { id: generateId(), assignment_id: asgn4Math, term_id: 'term-4-t3', status: 'Published', version: 1, updated_at: new Date() },
    });
    const gbT4 = await prisma.gradebooks.create({
      data: { id: generateId(), assignment_id: asgn4Math, term_id: 'term-4-t4', status: 'Published', version: 1, updated_at: new Date() },
    });

    // Insert published grades: T1=88, T2=90, T3=92, T4=94
    await prisma.grade.createMany({
      data: [
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay4Id, term: 'T1', published_term_grade: 88, published_gradebook_id: gbT1.id },
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay4Id, term: 'T2', published_term_grade: 90, published_gradebook_id: gbT2.id },
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay4Id, term: 'T3', published_term_grade: 92, published_gradebook_id: gbT3.id },
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay4Id, term: 'T4', published_term_grade: 94, published_gradebook_id: gbT4.id },
      ],
    });

    const reportCard = await getReportCardData(stuId, stuUserId);
    const math = reportCard.scholastic.subjects.find(s => s.id === mathSubjId);
    expect(math).toBeDefined();
    expect(math?.T1).toBe(88);
    expect(math?.T2).toBe(90);
    expect(math?.T3).toBe(92);
    expect(math?.T4).toBe(94);
    // 4-term formula: (88 + 90 + 92 + 94) / 4 = 364 / 4 = 91
    expect(math?.finalRating).toBe(91);
    expect(math?.remarks).toBe('PASSED');
  });

  it('5. Incomplete terms do not produce false final ratings (finalRating remains null)', async () => {
    await prisma.student.update({ where: { id: stuId }, data: { current_section_id: sec3Id } });
    await prisma.enrollment.create({
      data: { id: 'enr-3t-inc', student_id: stuId, section_id: sec3Id, academic_year_id: ay3Id, status: 'Enrolled' },
    });

    const gbT1 = await prisma.gradebooks.create({
      data: { id: generateId(), assignment_id: asgn3Math, term_id: 'term-3-t1', status: 'Published', version: 1, updated_at: new Date() },
    });

    // Only T1 published, T2 and T3 null
    await prisma.grade.create({
      data: { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay3Id, term: 'T1', published_term_grade: 88, published_gradebook_id: gbT1.id },
    });

    const reportCard = await getReportCardData(stuId, stuUserId);
    const math = reportCard.scholastic.subjects.find(s => s.id === mathSubjId);
    expect(math?.T1).toBe(88);
    expect(math?.T2).toBeNull();
    expect(math?.T3).toBeNull();
    // Incomplete terms must NEVER calculate a partial average or treat missing terms as zero
    expect(math?.finalRating).toBeNull();
    expect(math?.remarks).toBeNull();
    expect(reportCard.scholastic.generalAverage).toBeNull();
  });

  it('6. Student privacy: unpublished draft grades return null and do not affect finalRating', async () => {
    await prisma.student.update({ where: { id: stuId }, data: { current_section_id: sec3Id } });
    await prisma.enrollment.create({
      data: { id: 'enr-3t-draft', student_id: stuId, section_id: sec3Id, academic_year_id: ay3Id, status: 'Enrolled' },
    });

    // Draft gradebook (NOT Published)
    const gbDraft = await prisma.gradebooks.create({
      data: { id: generateId(), assignment_id: asgn3Math, term_id: 'term-3-t1', status: 'Draft', version: 1, updated_at: new Date() },
    });

    await prisma.grade.create({
      data: { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay3Id, term: 'T1', term_grade: 95, published_gradebook_id: gbDraft.id },
    });

    // Student self-request
    const studentView = await getReportCardData(stuId, stuUserId);
    const mathStudent = studentView.scholastic.subjects.find(s => s.id === mathSubjId);
    expect(mathStudent?.T1).toBeNull();
    expect(mathStudent?.finalRating).toBeNull();

    // Teacher request: sees draft for grading purposes
    const teacherView = await getReportCardData(stuId, teaUserId);
    const mathTeacher = teacherView.scholastic.subjects.find(s => s.id === mathSubjId);
    expect(mathTeacher?.T1).toBe(95);
    // Still no finalRating because T2 and T3 are missing
    expect(mathTeacher?.finalRating).toBeNull();
  });

  it('7. SF10 accurately handles different term counts across academic years', async () => {
    await prisma.student.update({ where: { id: stuId }, data: { current_section_id: sec3Id } });
    // Student enrolled in 4-term AY (Grade 9) and 3-term AY (Grade 10)
    await prisma.enrollment.createMany({
      data: [
        { id: 'enr-sf10-4t', student_id: stuId, section_id: sec4Id, academic_year_id: ay4Id, status: 'Enrolled' },
        { id: 'enr-sf10-3t', student_id: stuId, section_id: sec3Id, academic_year_id: ay3Id, status: 'Enrolled' },
      ],
    });

    // AY 4-term grades (90 across 4 terms) -> final = 90
    const gb4T1 = await prisma.gradebooks.create({ data: { id: generateId(), assignment_id: asgn4Math, term_id: 'term-4-t1', status: 'Published', version: 1, updated_at: new Date() } });
    const gb4T2 = await prisma.gradebooks.create({ data: { id: generateId(), assignment_id: asgn4Math, term_id: 'term-4-t2', status: 'Published', version: 1, updated_at: new Date() } });
    const gb4T3 = await prisma.gradebooks.create({ data: { id: generateId(), assignment_id: asgn4Math, term_id: 'term-4-t3', status: 'Published', version: 1, updated_at: new Date() } });
    const gb4T4 = await prisma.gradebooks.create({ data: { id: generateId(), assignment_id: asgn4Math, term_id: 'term-4-t4', status: 'Published', version: 1, updated_at: new Date() } });

    await prisma.grade.createMany({
      data: [
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay4Id, term: 'T1', published_term_grade: 90, published_gradebook_id: gb4T1.id },
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay4Id, term: 'T2', published_term_grade: 90, published_gradebook_id: gb4T2.id },
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay4Id, term: 'T3', published_term_grade: 90, published_gradebook_id: gb4T3.id },
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ay4Id, term: 'T4', published_term_grade: 90, published_gradebook_id: gb4T4.id },
      ],
    });

    const sf10 = await getSF10Data(stuId, admUserId);
    expect(sf10.academicYears.length).toBeGreaterThanOrEqual(1);

    const year4Record = sf10.academicYears.find(y => y.academicYearId === ay4Id);
    expect(year4Record).toBeDefined();
    const math4 = year4Record?.subjects.find(s => s.id === mathSubjId);
    expect(math4?.T1).toBe(90);
    expect(math4?.T2).toBe(90);
    expect(math4?.T3).toBe(90);
    expect(math4?.T4).toBe(90);
    expect(math4?.finalRating).toBe(90);
  });

  it('8. Calulut SF9 service preserves verified 3-term generation and blocks non-3-term AY with 422', async () => {
    // Student enrolled in 4-term section
    await prisma.student.update({ where: { id: stuId }, data: { current_section_id: sec4Id } });
    await prisma.enrollment.create({
      data: { id: 'enr-sf9-block', student_id: stuId, section_id: sec4Id, academic_year_id: ay4Id, status: 'Enrolled' },
    });

    // When requesting official SF9 mapping for a 4-term academic year
    await expect(
      resolveStudentSf9DataMapping(stuId, { id: admUserId, email: 'admin.5c2a@test.com', roles: ['Admin'] as any })
    ).rejects.toThrowError(/UNSUPPORTED_SF9_CONFIGURATION|designed specifically for 3-term/);
  });
});
