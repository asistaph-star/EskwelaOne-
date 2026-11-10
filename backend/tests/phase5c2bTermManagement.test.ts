/**
 * DIGISKWELA — PHASE 5C-2B SECURE ACADEMIC TERM MANAGEMENT TEST SUITE
 * Module: phase5c2bTermManagement.test.ts
 *
 * Verifies Phase 5C-2B requirements in isolated digiskwela_test:
 * 1. ITAdmin and Admin authorized to add/remove academic terms.
 * 2. Principal, Teacher, Student, and unauthorized roles receive 403 FORBIDDEN.
 * 3. 3-term academic year can safely add T4 when permitted.
 * 4. Unused T4 can be safely removed.
 * 5. Dependency verification: gradebooks/grades block removal with 409.
 * 6. Certified SF9 releases block term modifications.
 * 7. Duplicate and out-of-sequence additions are rejected.
 * 8. Intermediate terms and last term cannot be removed.
 * 9. Four-term year with missing T4 grades remains strictly incomplete (null GPA).
 * 10. Audit logs record actors and state transitions.
 * 11. Flexible academic year creation defaults to verified 3 terms or user-selected termKeys.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import prisma from '../src/config/database.js';
import { 
  addAcademicTerm, 
  removeAcademicTerm, 
  createAcademicYear 
} from '../src/academic/academic.service.js';
import { getReportCardData } from '../src/academic/reportCard.service.js';
import { generateId } from '../src/common/utils/uuid.js';

describe('Phase 5C-2B: Secure Academic Term Management', () => {
  const ayId = 'test-ay-5c2b';
  const ayFlexId = 'test-ay-flex-5c2b';
  const secId = 'test-sec-5c2b';
  const stuId = 'test-stu-5c2b';
  const stuUserId = 'test-u-stu-5c2b';
  const teaId = 'test-tea-5c2b';
  const teaUserId = 'test-u-tea-5c2b';

  const itAdminUserId = 'test-u-itadmin-5c2b';
  const adminUserId = 'test-u-admin-5c2b';
  const principalUserId = 'test-u-principal-5c2b';

  const asgnMath = 'asgn-math-5c2b';
  const mathSubjId = 'subj-math-5c2b';

  const cleanFixtures = async () => {
    await prisma.grade.deleteMany({ where: { academic_year_id: { in: [ayId, ayFlexId] } } }).catch(() => {});
    await prisma.gradebook_columns.deleteMany({ where: { gradebook: { assignment_id: asgnMath } } }).catch(() => {});
    await prisma.gradebooks.deleteMany({ where: { assignment_id: asgnMath } }).catch(() => {});
    await prisma.sf9AdviserComment.deleteMany({ where: { academic_year_id: { in: [ayId, ayFlexId] } } }).catch(() => {});
    await prisma.sf9OfficialIssuance.deleteMany({ where: { academic_year_id: { in: [ayId, ayFlexId] } } }).catch(() => {});
    await prisma.teacherSubjectAssignment.deleteMany({ where: { id: asgnMath } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { student_id: stuId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { id: stuId } }).catch(() => {});
    await prisma.section.deleteMany({ where: { id: secId } }).catch(() => {});
    await prisma.term.deleteMany({ where: { academic_year_id: { in: [ayId, ayFlexId] } } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: { in: [ayId, ayFlexId] } } }).catch(() => {});
    await prisma.teacher.deleteMany({ where: { id: teaId } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { OR: [{ resource_type: 'academic_term' }, { actor_user_id: { in: [stuUserId, teaUserId, itAdminUserId, adminUserId, principalUserId] } }] } }).catch(() => {});

    await prisma.userRole.deleteMany({ 
      where: { user_id: { in: [stuUserId, teaUserId, itAdminUserId, adminUserId, principalUserId] } } 
    }).catch(() => {});
    await prisma.user.deleteMany({ 
      where: { id: { in: [stuUserId, teaUserId, itAdminUserId, adminUserId, principalUserId] } } 
    }).catch(() => {});
    await prisma.subject.deleteMany({ where: { id: mathSubjId } }).catch(() => {});
  };

  afterAll(async () => {
    await cleanFixtures();
  });

  beforeEach(async () => {
    // Clean test records in digiskwela_test
    await cleanFixtures();

    // Look up system roles
    const itAdminRole = await prisma.role.findFirst({ where: { name: 'ITAdmin' } });
    const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
    const principalRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    const teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    const studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });

    // Seed test users with database-derived roles
    await prisma.user.createMany({
      data: [
        { id: itAdminUserId, school_id: 'IT-5C2B', email: 'itadmin5c2b@test.local', first_name: 'Sys', last_name: 'ITAdmin', password_hash: 'x', status: 'active' },
        { id: adminUserId, school_id: 'ADM-5C2B', email: 'admin5c2b@test.local', first_name: 'School', last_name: 'Admin', password_hash: 'x', status: 'active' },
        { id: principalUserId, school_id: 'PRN-5C2B', email: 'principal5c2b@test.local', first_name: 'School', last_name: 'Principal', password_hash: 'x', status: 'active' },
        { id: teaUserId, school_id: 'TEA-5C2B', email: 'teacher5c2b@test.local', first_name: 'Faculty', last_name: 'Teacher', password_hash: 'x', status: 'active' },
        { id: stuUserId, school_id: 'STU-5C2B', email: 'student5c2b@test.local', first_name: 'Learner', last_name: 'Student', password_hash: 'x', status: 'active' },
      ]
    });

    if (itAdminRole) await prisma.userRole.create({ data: { user_id: itAdminUserId, role_id: itAdminRole.id } });
    if (adminRole) await prisma.userRole.create({ data: { user_id: adminUserId, role_id: adminRole.id } });
    if (principalRole) await prisma.userRole.create({ data: { user_id: principalUserId, role_id: principalRole.id } });
    if (teacherRole) await prisma.userRole.create({ data: { user_id: teaUserId, role_id: teacherRole.id } });
    if (studentRole) await prisma.userRole.create({ data: { user_id: stuUserId, role_id: studentRole.id } });

    // Seed Subject & Teacher
    await prisma.subject.create({
      data: { id: mathSubjId, code: 'MATH-5C2B', name: 'Mathematics 10' }
    });
    await prisma.teacher.create({
      data: { id: teaId, user_id: teaUserId, employee_id: 'EMP-5C2B' }
    });

    // Seed initial 3-term Academic Year (T1, T2, T3)
    await prisma.academicYear.create({
      data: {
        id: ayId,
        name: 'SY 2026-2027 Test 5C2B',
        start_date: new Date('2026-08-01'),
        end_date: new Date('2027-05-31'),
        is_current: true,
      }
    });

    await prisma.term.createMany({
      data: [
        { id: 'term-5c2b-t1', academic_year_id: ayId, key: 'T1', name: 'First Term' },
        { id: 'term-5c2b-t2', academic_year_id: ayId, key: 'T2', name: 'Second Term' },
        { id: 'term-5c2b-t3', academic_year_id: ayId, key: 'T3', name: 'Third Term' },
      ]
    });

    // Seed Section
    await prisma.section.create({
      data: {
        id: secId,
        academic_year_id: ayId,
        name: 'Section Alpha',
        grade_level: 10,
        adviser_teacher_id: teaId,
      }
    });

    // Seed Student
    await prisma.student.create({
      data: {
        id: stuId,
        user_id: stuUserId,
        lrn: '999955552222',
        gender: 'male',
        grade_level: 10,
        current_section_id: secId,
      }
    });

    // Seed Assignment
    await prisma.teacherSubjectAssignment.create({
      data: {
        id: asgnMath,
        academic_year_id: ayId,
        section_id: secId,
        subject_id: mathSubjId,
        teacher_id: teaId,
      }
    });
  });

  it('1. Principal, Teacher, Student receive 403 FORBIDDEN when attempting term modifications', async () => {
    // Principal attempt Add
    await expect(
      addAcademicTerm(ayId, { key: 'T4', confirm: true }, principalUserId)
    ).rejects.toThrow(/Only Admin and ITAdmin are authorized/);

    // Principal attempt Remove
    await expect(
      removeAcademicTerm(ayId, 'term-5c2b-t3', principalUserId)
    ).rejects.toThrow(/Only Admin and ITAdmin are authorized/);

    // Teacher attempt Add
    await expect(
      addAcademicTerm(ayId, { key: 'T4', confirm: true }, teaUserId)
    ).rejects.toThrow(/Only Admin and ITAdmin are authorized/);

    // Student attempt Remove
    await expect(
      removeAcademicTerm(ayId, 'term-5c2b-t3', stuUserId)
    ).rejects.toThrow(/Only Admin and ITAdmin are authorized/);
  });

  it('2. Admin and ITAdmin can safely add the next supported term in sequence (T4)', async () => {
    const term = await addAcademicTerm(
      ayId,
      { key: 'T4', name: 'Fourth Term', confirm: true },
      adminUserId,
      'test-corr-add-t4'
    );

    expect(term).toBeDefined();
    expect(term.key).toBe('T4');
    expect(term.name).toBe('Fourth Term');

    // Verify DB has 4 terms now
    const termsInDb = await prisma.term.findMany({
      where: { academic_year_id: ayId },
      orderBy: { key: 'asc' }
    });
    expect(termsInDb.map(t => t.key)).toEqual(['T1', 'T2', 'T3', 'T4']);

    // Verify Audit Log captured Admin actor
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'ACADEMIC_TERM_ADDED',
        resource_id: term.id,
      }
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.actor_user_id).toBe(adminUserId);
  });

  it('3. Rejects duplicate and out-of-sequence additions', async () => {
    // Try adding duplicate T3
    await expect(
      addAcademicTerm(ayId, { key: 'T3', confirm: true }, itAdminUserId)
    ).rejects.toThrow(/already exists/);

    // Try adding T4 first, then adding another term (exceeding 4 terms)
    await addAcademicTerm(ayId, { key: 'T4', confirm: true }, itAdminUserId);

    // AY already has 4 terms
    await expect(
      addAcademicTerm(ayId, { key: 'T4', confirm: true }, itAdminUserId)
    ).rejects.toThrow(/maximum of 4 terms/);
  });

  it('4. ITAdmin can safely remove the highest unused term (T4)', async () => {
    // Add T4
    const t4 = await addAcademicTerm(ayId, { key: 'T4', confirm: true }, adminUserId);

    // Remove T4
    const result = await removeAcademicTerm(ayId, t4.id, itAdminUserId, 'test-corr-rem-t4');
    expect(result.success).toBe(true);

    const termsInDb = await prisma.term.findMany({
      where: { academic_year_id: ayId },
      orderBy: { key: 'asc' }
    });
    expect(termsInDb.map(t => t.key)).toEqual(['T1', 'T2', 'T3']);

    // Verify Audit Log captured ITAdmin actor
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'ACADEMIC_TERM_REMOVED',
        resource_id: t4.id,
      }
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.actor_user_id).toBe(itAdminUserId);
  });

  it('5. Rejects removal of intermediate terms and respects DepEd 3-term minimum constraint', async () => {
    // Add T4 so terms are T1, T2, T3, T4
    const t4 = await addAcademicTerm(ayId, { key: 'T4', confirm: true }, adminUserId);

    // Try removing T2 when T1, T2, T3, T4 exist (intermediate removal)
    await expect(
      removeAcademicTerm(ayId, 'term-5c2b-t2', itAdminUserId)
    ).rejects.toThrow(/Only the highest configured term/);

    // Remove T4 -> returns to 3 terms (T1, T2, T3)
    await removeAcademicTerm(ayId, t4.id, itAdminUserId);

    // Attempting to remove T3 must now be rejected under DepEd minimum 3-term policy
    await expect(
      removeAcademicTerm(ayId, 'term-5c2b-t3', itAdminUserId)
    ).rejects.toThrow(/below 3 terms/);
  });

  it('6. Existing gradebooks or grades block unsafe term removal with 409', async () => {
    // Add T4
    const t4 = await addAcademicTerm(ayId, { key: 'T4', confirm: true }, adminUserId);

    // Create an active gradebook for T4
    await prisma.gradebooks.create({
      data: {
        id: 'gb-5c2b-t4',
        assignment_id: asgnMath,
        term_id: t4.id,
        status: 'Draft',
        updated_at: new Date(),
      }
    });

    // Attempting to remove T4 must be blocked
    await expect(
      removeAcademicTerm(ayId, t4.id, itAdminUserId)
    ).rejects.toThrow(/active academic dependencies exist/);

    // Gradebook is NOT cascade-deleted
    const gbStillExists = await prisma.gradebooks.findUnique({ where: { id: 'gb-5c2b-t4' } });
    expect(gbStillExists).toBeDefined();

    // Now test with Grade record dependency
    await prisma.gradebooks.delete({ where: { id: 'gb-5c2b-t4' } });
    await prisma.grade.create({
      data: {
        id: generateId(),
        student_id: stuId,
        subject_id: mathSubjId,
        academic_year_id: ayId,
        term: 'T4',
        term_grade: 89,
      }
    });

    await expect(
      removeAcademicTerm(ayId, t4.id, adminUserId)
    ).rejects.toThrow(/grade record\(s\)/);
  });

  it('7. Certified SF9 releases block term modifications that would invalidate them', async () => {
    // Seed enrollment and official issuance
    const enr = await prisma.enrollment.create({
      data: {
        id: 'enr-sf9-5c2b',
        student_id: stuId,
        section_id: secId,
        academic_year_id: ayId,
        status: 'Enrolled',
      }
    });

    await prisma.sf9OfficialIssuance.create({
      data: {
        id: generateId(),
        enrollment_id: enr.id,
        student_id: stuId,
        section_id: secId,
        academic_year_id: ayId,
        version: 1,
        is_current: true,
        frozen_payload_encrypted: 'test-encrypted-payload',
        calculated_summary_encrypted: 'test-encrypted-summary',
        template_sha256: 'sha256-template',
        xlsx_sha256: 'sha256-xlsx',
        pdf_sha256: 'sha256-pdf',
        libreoffice_version: 'Headless Calc',
        adviser_teacher_id: teaId,
        adviser_name: 'Adviser Teacher',
        school_head_name: 'School Principal',
        school_head_title: 'School Head',
        issued_by_id: principalUserId,
      }
    });

    // Attempt to add T4 to this certified AY
    await expect(
      addAcademicTerm(ayId, { key: 'T4', confirm: true }, adminUserId)
    ).rejects.toThrow(/officially released SF9 report cards/);
  });

  it('8. Four-term year with missing T4 results remains strictly incomplete (Task 1)', async () => {
    // Add T4 to make it a 4-term year
    await addAcademicTerm(ayId, { key: 'T4', confirm: true }, adminUserId);

    // Record published grades for T1, T2, T3 only (T4 is unpublished/missing)
    const gbT1 = await prisma.gradebooks.create({
      data: { id: 'gb-t1', assignment_id: asgnMath, term_id: 'term-5c2b-t1', status: 'Published', updated_at: new Date() }
    });
    const gbT2 = await prisma.gradebooks.create({
      data: { id: 'gb-t2', assignment_id: asgnMath, term_id: 'term-5c2b-t2', status: 'Published', updated_at: new Date() }
    });
    const gbT3 = await prisma.gradebooks.create({
      data: { id: 'gb-t3', assignment_id: asgnMath, term_id: 'term-5c2b-t3', status: 'Published', updated_at: new Date() }
    });

    await prisma.grade.createMany({
      data: [
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ayId, term: 'T1', published_gradebook_id: gbT1.id, term_grade: 88, published_term_grade: 88 },
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ayId, term: 'T2', published_gradebook_id: gbT2.id, term_grade: 90, published_term_grade: 90 },
        { id: generateId(), student_id: stuId, subject_id: mathSubjId, academic_year_id: ayId, term: 'T3', published_gradebook_id: gbT3.id, term_grade: 92, published_term_grade: 92 },
      ]
    });

    const report = await getReportCardData(stuId, stuUserId);
    expect(report.scholastic.configuredTerms).toEqual(['T1', 'T2', 'T3', 'T4']);
    expect(report.scholastic.termCount).toBe(4);

    const math = report.scholastic.subjects.find(s => s.id === mathSubjId);
    expect(math).toBeDefined();
    expect(math?.T1).toBe(88);
    expect(math?.T2).toBe(90);
    expect(math?.T3).toBe(92);
    expect(math?.T4).toBeNull();

    // MUST NOT calculate as completed 3-term year!
    expect(math?.finalRating).toBeNull();
    expect(math?.remarks).toBeNull();
    expect(report.scholastic.generalAverage).toBeNull();
  });

  it('9. Flexible academic year creation defaults to verified 3 terms or user-selected termKeys (Task 5)', async () => {
    // Default creation (no termKeys specified) -> exactly 3 terms (T1, T2, T3)
    const ayDefault = await createAcademicYear(
      {
        name: 'SY 2027-2028 Default 3T',
        startDate: '2027-08-01T00:00:00.000Z',
        endDate: '2028-05-31T00:00:00.000Z',
        isCurrent: false,
      },
      adminUserId,
      'corr-ay-def'
    );
    const termsDef = await prisma.term.findMany({
      where: { academic_year_id: ayDefault.id },
      orderBy: { key: 'asc' }
    });
    expect(termsDef.map(t => t.key)).toEqual(['T1', 'T2', 'T3']);

    // Explicit 4 terms creation when selected
    const ay4Terms = await createAcademicYear(
      {
        name: 'SY 2028-2029 Custom 4T',
        startDate: '2028-08-01T00:00:00.000Z',
        endDate: '2029-05-31T00:00:00.000Z',
        isCurrent: false,
        termKeys: ['T1', 'T2', 'T3', 'T4'],
      },
      adminUserId,
      'corr-ay-4t'
    );
    const terms4 = await prisma.term.findMany({
      where: { academic_year_id: ay4Terms.id },
      orderBy: { key: 'asc' }
    });
    expect(terms4.map(t => t.key)).toEqual(['T1', 'T2', 'T3', 'T4']);

    // Cleanup created AYs
    await prisma.term.deleteMany({ where: { academic_year_id: { in: [ayDefault.id, ay4Terms.id] } } });
    await prisma.academicYear.deleteMany({ where: { id: { in: [ayDefault.id, ay4Terms.id] } } });
  });

  it('10. Published academic results require deliberate confirmation to add a term (Task 1)', async () => {
    // Create published gradebook and grade for T1
    const gb = await prisma.gradebooks.create({
      data: {
        id: 'gb-pub-test',
        assignment_id: asgnMath,
        term_id: 'term-5c2b-t1',
        status: 'Published',
        updated_at: new Date(),
      }
    });

    await prisma.grade.create({
      data: {
        id: generateId(),
        student_id: stuId,
        subject_id: mathSubjId,
        academic_year_id: ayId,
        term: 'T1',
        published_gradebook_id: gb.id,
        term_grade: 91,
        published_term_grade: 91,
      }
    });

    // Attempting to add T4 WITHOUT deliberate confirmation must be rejected with 409 PUBLISHED_RESULTS_EXIST
    await expect(
      addAcademicTerm(ayId, { key: 'T4', confirm: true }, adminUserId)
    ).rejects.toThrow(/Published academic results exist/);

    // Attempting with wrong confirmedAcademicYearId must also be rejected
    await expect(
      addAcademicTerm(ayId, { key: 'T4', confirm: true, confirmPublishedOverride: true, confirmedAcademicYearId: 'wrong-ay-id' }, adminUserId)
    ).rejects.toThrow(/Published academic results exist/);

    // Deliberate confirmation tied to this exact academic year succeeds
    const t4 = await addAcademicTerm(
      ayId,
      {
        key: 'T4',
        confirm: true,
        confirmPublishedOverride: true,
        confirmedAcademicYearId: ayId,
      },
      adminUserId,
      'corr-deliberate-t4'
    );
    expect(t4.key).toBe('T4');

    // Verify audit log captured the deliberate override
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'ACADEMIC_TERM_ADDED',
        resource_id: t4.id,
      }
    });
    expect(auditLog).toBeDefined();
    expect((auditLog?.new_state as any)?.published_results_overridden).toBe(true);
  });

  it('11. Concurrency safety: race condition on additions and removals handled cleanly (Task 2)', async () => {
    // Attempt two simultaneous term additions of T4
    const results = await Promise.allSettled([
      addAcademicTerm(ayId, { key: 'T4', confirm: true }, adminUserId),
      addAcademicTerm(ayId, { key: 'T4', confirm: true }, itAdminUserId),
    ]);

    // Exactly one should succeed, while the other is rejected (duplicate term or max terms)
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Terms in DB must still be exactly 4 terms in sequence
    const terms = await prisma.term.findMany({
      where: { academic_year_id: ayId },
      orderBy: { key: 'asc' }
    });
    expect(terms.map(t => t.key)).toEqual(['T1', 'T2', 'T3', 'T4']);
  });

  it('12. Unsupported 1-term or 2-term academic year configurations are rejected (Task 4)', async () => {
    // Attempting to create an AY with 2 terms must throw UNSUPPORTED_TERM_CONFIGURATION
    await expect(
      createAcademicYear(
        {
          name: 'SY 2029-2030 Invalid 2T',
          startDate: '2029-08-01T00:00:00.000Z',
          endDate: '2030-05-31T00:00:00.000Z',
          isCurrent: false,
          termKeys: ['T1', 'T2'] as any,
        },
        adminUserId
      )
    ).rejects.toThrow(/must be configured with either 3 terms/);
  });
});
