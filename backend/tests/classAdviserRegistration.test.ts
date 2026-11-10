/**
 * DIGISKWELA — Class Adviser Registration & Advisory Management Regression Tests
 * File: backend/tests/classAdviserRegistration.test.ts
 *
 * Verifies Phase I.1 backend functionality against PostgreSQL 17 `digiskwela_test`:
 * - Class Adviser role authorization (Section Adviser vs Subject Teacher vs Unauthorized Teacher)
 * - Search-first learner registry (LRN and Name matching)
 * - Existing learner enrollment into advisory section
 * - Duplicate enrollment rejection (400 DUPLICATE_ENROLLMENT)
 * - Section transfer conflict detection under DepEd DO 017, s. 2025 (409 TRANSFER_CONFLICT)
 * - New learner registration validation & global LRN uniqueness enforcement (409 DUPLICATE_LRN)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/config/database.js';
import {
  searchLearnersRegistry,
  enrollExistingLearner,
  validateNewLearnerRegistration,
  registerNewLearner,
  getUnprovisionedLearners,
} from '../src/academic/advisory/advisory.service.js';
import { createUser } from '../src/users/user.service.js';

const P = 'car_';
const AY_ID = `${P}ay_2026_2027`;
const SEC_1_ID = `${P}sec_rizal10`;
const SEC_2_ID = `${P}sec_bonifacio10`;

const T1_USER_ID = `${P}usr_t1`;
const T1_TEACHER_ID = `${P}tch_t1`;

const T2_USER_ID = `${P}usr_t2`;
const T2_TEACHER_ID = `${P}tch_t2`;

const T3_USER_ID = `${P}usr_t3`;
const T3_TEACHER_ID = `${P}tch_t3`; // Subject teacher with no advisory section

const S1_USER_ID = `${P}usr_s1`;
const S1_STUDENT_ID = `${P}std_01`;
const S1_ENR_ID = `${P}enr_01`;
const S1_LRN = '112233445501';

const S2_USER_ID = `${P}usr_s2`;
const S2_STUDENT_ID = `${P}std_02`;
const S2_LRN = '112233445502'; // Not yet enrolled in any active section

const S3_USER_ID = `${P}usr_s3`;
const S3_STUDENT_ID = `${P}std_03`;
const S3_ENR_ID = `${P}enr_03`;
const S3_LRN = '112233445503'; // Enrolled in Section 2

let createdNewStudentId: string | undefined;
let provisionedNewUserId: string | undefined;

describe('DIGISKWELA — CLASS ADVISER REGISTRATION & ENROLLMENT TESTS', () => {
  beforeAll(async () => {
    // 1. Clean up residual test data
    const existingNewStudents = await prisma.student.findMany({ 
      where: { 
        OR: [
          { lrn: '112233445588' }, 
          { lrn: '998877665544' },
          { first_name: 'Crispin', last_name: 'Sisa' },
          { first_name: 'Basilio', last_name: 'Sisa' },
          { id: { startsWith: P } },
        ] 
      } 
    });
    for (const ns of existingNewStudents) {
      await prisma.studentHealthMetric.deleteMany({ where: { student_id: ns.id } });
      await prisma.enrollment.deleteMany({ where: { student_id: ns.id } });
      const uid = ns.user_id;
      await prisma.student.deleteMany({ where: { id: ns.id } });
      if (uid) {
        await prisma.auditLog.deleteMany({ where: { actor_user_id: uid } });
        await prisma.userRole.deleteMany({ where: { user_id: uid } });
        await prisma.user.deleteMany({ where: { id: uid } });
      }
    }
    const staleUsers = await prisma.user.findMany({
      where: { OR: [{ email: { contains: 's2_portal' } }, { email: { contains: 'crispin_' } }, { school_id: '112233445588' }, { id: { startsWith: P } }] },
      select: { id: true },
    });
    const staleUserIds = staleUsers.map((u) => u.id);
    if (staleUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: staleUserIds } } });
      await prisma.userRole.deleteMany({ where: { user_id: { in: staleUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleUserIds } } });
    }
    await prisma.studentHealthMetric.deleteMany({ where: { student_id: { in: [S1_STUDENT_ID, S2_STUDENT_ID, S3_STUDENT_ID] } } });
    await prisma.enrollment.deleteMany({ where: { student_id: { in: [S1_STUDENT_ID, S2_STUDENT_ID, S3_STUDENT_ID] } } });
    await prisma.student.deleteMany({ where: { id: { in: [S1_STUDENT_ID, S2_STUDENT_ID, S3_STUDENT_ID] } } });
    await prisma.section.deleteMany({ where: { id: { in: [SEC_1_ID, SEC_2_ID] } } });
    await prisma.teacher.deleteMany({ where: { id: { in: [T1_TEACHER_ID, T2_TEACHER_ID, T3_TEACHER_ID] } } });
    await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: [T1_USER_ID, T2_USER_ID, T3_USER_ID] } } });
    await prisma.user.deleteMany({ where: { id: { in: [T1_USER_ID, T2_USER_ID, T3_USER_ID, S1_USER_ID, S2_USER_ID, S3_USER_ID] } } });
    await prisma.academicYear.deleteMany({ where: { id: AY_ID } });

    // 2. Create Academic Year
    await prisma.academicYear.create({
      data: {
        id: AY_ID,
        name: `${P}SY 2026-2027`,
        start_date: new Date('2026-08-24'),
        end_date: new Date('2027-06-25'),
        is_current: true,
      },
    });

    // 3. Create Teachers
    // T1: Class Adviser of Section 1
    await prisma.user.create({
      data: {
        id: T1_USER_ID,
        school_id: `${P}EMP001`,
        email: `${P}t1@calulut.edu.ph`,
        password_hash: '$2b$10$dummyHashForTestingPurposesOnly1234567890',
        first_name: 'Maria',
        last_name: 'Clara',
        status: 'active',
      },
    });
    await prisma.teacher.create({
      data: {
        id: T1_TEACHER_ID,
        user_id: T1_USER_ID,
        employee_id: `${P}EMP001`,
      },
    });

    // T2: Class Adviser of Section 2
    await prisma.user.create({
      data: {
        id: T2_USER_ID,
        school_id: `${P}EMP002`,
        email: `${P}t2@calulut.edu.ph`,
        password_hash: '$2b$10$dummyHashForTestingPurposesOnly1234567890',
        first_name: 'Crisostomo',
        last_name: 'Ibarra',
        status: 'active',
      },
    });
    await prisma.teacher.create({
      data: {
        id: T2_TEACHER_ID,
        user_id: T2_USER_ID,
        employee_id: `${P}EMP002`,
      },
    });

    // T3: Pure Subject Teacher (No Advisory)
    await prisma.user.create({
      data: {
        id: T3_USER_ID,
        school_id: `${P}EMP003`,
        email: `${P}t3@calulut.edu.ph`,
        password_hash: '$2b$10$dummyHashForTestingPurposesOnly1234567890',
        first_name: 'Elias',
        last_name: 'Salome',
        status: 'active',
      },
    });
    await prisma.teacher.create({
      data: {
        id: T3_TEACHER_ID,
        user_id: T3_USER_ID,
        employee_id: `${P}EMP003`,
      },
    });

    // 4. Create Sections
    await prisma.section.create({
      data: {
        id: SEC_1_ID,
        name: 'Grade 10 - Rizal',
        grade_level: 10,
        academic_year_id: AY_ID,
        adviser_teacher_id: T1_TEACHER_ID,
      },
    });
    await prisma.section.create({
      data: {
        id: SEC_2_ID,
        name: 'Grade 10 - Bonifacio',
        grade_level: 10,
        academic_year_id: AY_ID,
        adviser_teacher_id: T2_TEACHER_ID,
      },
    });

    // 5. Create Students with field encryption
    // S1: Enrolled in Section 1
    await prisma.user.create({
      data: {
        id: S1_USER_ID,
        school_id: S1_LRN,
        email: `${P}s1@student.edu.ph`,
        password_hash: '$2b$10$dummyHashForTestingPurposesOnly1234567890',
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        status: 'active',
      },
    });
    await prisma.student.create({
      data: {
        id: S1_STUDENT_ID,
        user_id: S1_USER_ID,
        student_number: `${P}STD001`,
        lrn: S1_LRN,
        grade_level: 10,
      },
    });
    await prisma.enrollment.create({
      data: {
        id: S1_ENR_ID,
        student_id: S1_STUDENT_ID,
        section_id: SEC_1_ID,
        academic_year_id: AY_ID,
        status: 'Enrolled',
      },
    });

    // S2: In registry, but NOT enrolled in any section
    await prisma.user.create({
      data: {
        id: S2_USER_ID,
        school_id: S2_LRN,
        email: `${P}s2@student.edu.ph`,
        password_hash: '$2b$10$dummyHashForTestingPurposesOnly1234567890',
        first_name: 'Maria',
        last_name: 'Santos',
        status: 'active',
      },
    });
    await prisma.student.create({
      data: {
        id: S2_STUDENT_ID,
        user_id: S2_USER_ID,
        student_number: `${P}STD002`,
        lrn: S2_LRN,
        grade_level: 10,
      },
    });

    // S3: Enrolled in Section 2
    await prisma.user.create({
      data: {
        id: S3_USER_ID,
        school_id: S3_LRN,
        email: `${P}s3@student.edu.ph`,
        password_hash: '$2b$10$dummyHashForTestingPurposesOnly1234567890',
        first_name: 'Andres',
        last_name: 'Bonifacio',
        status: 'active',
      },
    });
    await prisma.student.create({
      data: {
        id: S3_STUDENT_ID,
        user_id: S3_USER_ID,
        student_number: `${P}STD003`,
        lrn: S3_LRN,
        grade_level: 10,
      },
    });
    await prisma.enrollment.create({
      data: {
        id: S3_ENR_ID,
        student_id: S3_STUDENT_ID,
        section_id: SEC_2_ID,
        academic_year_id: AY_ID,
        status: 'Enrolled',
      },
    });
  });

  afterAll(async () => {
    // Teardown test data in reverse foreign key order
    const cleanupStudentIds = [S1_STUDENT_ID, S2_STUDENT_ID, S3_STUDENT_ID, createdNewStudentId].filter(Boolean) as string[];
    await prisma.studentHealthMetric.deleteMany({ where: { student_id: { in: cleanupStudentIds } } });
    await prisma.enrollment.deleteMany({ where: { student_id: { in: cleanupStudentIds } } });
    await prisma.student.deleteMany({ where: { id: { in: cleanupStudentIds } } });
    await prisma.section.deleteMany({ where: { id: { in: [SEC_1_ID, SEC_2_ID] } } });
    await prisma.teacher.deleteMany({ where: { id: { in: [T1_TEACHER_ID, T2_TEACHER_ID, T3_TEACHER_ID] } } });
    const cleanupUserIds = [T1_USER_ID, T2_USER_ID, T3_USER_ID, S1_USER_ID, S2_USER_ID, S3_USER_ID, provisionedNewUserId].filter(Boolean) as string[];
    await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: cleanupUserIds } } });
    await prisma.userRole.deleteMany({ where: { user_id: { in: cleanupUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await prisma.academicYear.deleteMany({ where: { id: AY_ID } });
  });

  // --- REGISTRY SEARCH TESTS ---

  it('CAR-01: Registry search by 12-digit LRN locates existing student', async () => {
    const results = await searchLearnersRegistry(S1_LRN, T1_USER_ID);
    expect(results).toHaveLength(1);
    expect(results[0].lrn).toBe(S1_LRN);
    expect(results[0].firstName).toBe('Juan');
    expect(results[0].lastName).toBe('Dela Cruz');
    expect(results[0].hasPortalAccount).toBe(true);
    expect(results[0].currentEnrollment.isEnrolled).toBe(true);
    expect(results[0].currentEnrollment.sectionName).toBe('Grade 10 - Rizal');
  });

  it('CAR-02: Registry search by name locates unenrolled student', async () => {
    const results = await searchLearnersRegistry('Santos', T1_USER_ID);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const found = results.find((r) => r.studentId === S2_STUDENT_ID);
    expect(found).toBeDefined();
    expect(found?.lrn).toBe(S2_LRN);
    expect(found?.currentEnrollment.isEnrolled).toBe(false);
  });

  it('CAR-03: Registry search with unknown LRN returns empty array', async () => {
    const results = await searchLearnersRegistry('999999999999', T1_USER_ID);
    expect(results).toHaveLength(0);
  });

  // --- ADVISER AUTHORIZATION & ENROLLMENT TESTS ---

  it('CAR-04: Authorized Class Adviser can enroll unenrolled learner into assigned section', async () => {
    const result = await enrollExistingLearner(
      {
        sectionId: SEC_1_ID,
        studentId: S2_STUDENT_ID,
        academicYearId: AY_ID,
      },
      T1_USER_ID
    );

    expect(result.success).toBe(true);
    expect(result.sectionName).toBe('Grade 10 - Rizal');
    expect(result.lrn).toBe(S2_LRN);

    // Verify persisted enrollment
    const persistedEnr = await prisma.enrollment.findFirst({
      where: {
        student_id: S2_STUDENT_ID,
        section_id: SEC_1_ID,
        status: 'Enrolled',
      },
    });
    expect(persistedEnr).toBeDefined();
  });

  it('CAR-05: Non-adviser Subject Teacher is strictly blocked from enrolling (403)', async () => {
    await expect(
      enrollExistingLearner(
        {
          sectionId: SEC_1_ID,
          studentId: S2_STUDENT_ID,
        },
        T3_USER_ID // Subject teacher without advisory role
      )
    ).rejects.toThrow(/ADVISER_AUTHORIZATION_REQUIRED|Only the designated Class Adviser/);
  });

  it('CAR-06: Teacher of Section 2 cannot enroll into Section 1 (403)', async () => {
    await expect(
      enrollExistingLearner(
        {
          sectionId: SEC_1_ID,
          studentId: S2_STUDENT_ID,
        },
        T2_USER_ID // Assigned to Section 2, not Section 1
      )
    ).rejects.toThrow(/ADVISER_AUTHORIZATION_REQUIRED|Only the designated Class Adviser/);
  });

  it('CAR-07: Duplicate enrollment in the same section is rejected (400)', async () => {
    await expect(
      enrollExistingLearner(
        {
          sectionId: SEC_1_ID,
          studentId: S1_STUDENT_ID, // S1 is already enrolled in Section 1
        },
        T1_USER_ID
      )
    ).rejects.toThrow(/DUPLICATE_ENROLLMENT|already actively enrolled in Section/);
  });

  it('CAR-08: Transfer conflict detected when learner is active in another section (409)', async () => {
    await expect(
      enrollExistingLearner(
        {
          sectionId: SEC_1_ID,
          studentId: S3_STUDENT_ID, // S3 is actively enrolled in Section 2 (Grade 10 - Bonifacio)
        },
        T1_USER_ID
      )
    ).rejects.toThrow(/TRANSFER_CONFLICT|Enrollment Conflict|DepEd Order No\. 017/);
  });

  // --- NEW LEARNER REGISTRATION VALIDATION TESTS ---

  it('CAR-09: Valid new learner registration passes pre-validation', async () => {
    const validation = await validateNewLearnerRegistration(
      {
        sectionId: SEC_1_ID,
        lrn: '998877665544',
        firstName: 'Basilio',
        lastName: 'Sisa',
        gender: 'Male',
        dateOfBirth: '2010-05-15',
      },
      T1_USER_ID
    );

    expect(validation.valid).toBe(true);
    expect(validation.cleanLrn).toBe('998877665544');
    expect(validation.section.name).toBe('Grade 10 - Rizal');
  });

  it('CAR-10: New learner registration with duplicate LRN is rejected (409)', async () => {
    await expect(
      validateNewLearnerRegistration(
        {
          sectionId: SEC_1_ID,
          lrn: S1_LRN, // Already assigned to Juan Dela Cruz
          firstName: 'Another',
          lastName: 'Student',
          gender: 'Female',
          dateOfBirth: '2010-07-20',
        },
        T1_USER_ID
      )
    ).rejects.toThrow(/DUPLICATE_LRN|already registered with LRN/);
  });

  // --- APPROACH A: STUDENT PORTAL ACCOUNT PROVISIONING TESTS ---

  it('CAR-11: Admin provisions portal account for pre-existing learner record without duplicate LRN collision', async () => {
    // S2 was created earlier with S2_LRN ('112233445502')
    // Set user_id to null to represent an unprovisioned learner awaiting account creation
    await prisma.student.update({ where: { id: S2_STUDENT_ID }, data: { user_id: null } });

    // Admin provisions a Student portal login for S2
    const portalEmail = `${P}s2_portal_${Date.now()}@calulut.edu.ph`;
    const provisionResult = await createUser(
      {
        email: portalEmail,
        firstName: 'Maria',
        lastName: 'Santos',
        roles: ['Student'],
        studentProfile: {
          lrn: S2_LRN,
          gradeLevel: 10,
          gender: 'Female',
        },
      },
      T1_USER_ID
    );

    expect(provisionResult.user).toBeDefined();
    expect(provisionResult.temporaryPassword).toBeDefined();

    // Verify existing student record was updated with the new user_id
    const updatedStudent = await prisma.student.findUnique({
      where: { lrn: S2_LRN },
      include: { user: true },
    });
    expect(updatedStudent?.id).toBe(S2_STUDENT_ID);
    expect(updatedStudent?.user_id).toBe(provisionResult.user.id);
    expect(updatedStudent?.user.email).toBe(portalEmail);

    // Clean up created user in test
    await prisma.student.update({ where: { id: S2_STUDENT_ID }, data: { user_id: S2_USER_ID } });
    await prisma.userRole.deleteMany({ where: { user_id: provisionResult.user.id } });
    await prisma.user.deleteMany({ where: { id: provisionResult.user.id } });
  });

  // --- PHASE I.2: COMPLETE REGISTRATION TO PORTAL WORKFLOW ---

  const NEW_LRN = '112233445588';

  it('CAR-12: Full atomic learner registration by Class Adviser (creates Student with user_id = null and active Enrollment)', async () => {
    const regResult = await registerNewLearner(
      {
        sectionId: SEC_1_ID,
        lrn: NEW_LRN,
        firstName: 'Crispin',
        lastName: 'Sisa',
        middleName: 'Alvarez',
        suffix: 'Jr',
        gender: 'Male',
        dateOfBirth: '2010-09-12',
        street: '123 Purok 4',
        city: 'City of San Fernando',
        stateProvince: 'Pampanga',
        zipCode: '2000',
        guardianFirstName: 'Sisa',
        guardianLastName: 'Alvarez',
        guardianPhone: '09171234567',
      },
      T1_USER_ID
    );

    expect(regResult.success).toBe(true);
    expect(regResult.lrn).toBe(NEW_LRN);
    expect(regResult.firstName).toBe('Crispin');
    expect(regResult.lastName).toBe('Sisa');
    expect(regResult.hasPortalAccount).toBe(false);

    createdNewStudentId = regResult.studentId;

    // Verify DB state: Student exists WITHOUT User (user_id IS NULL)
    const dbStudent = await prisma.student.findUnique({
      where: { lrn: NEW_LRN },
      include: { user: true, enrollments: true },
    });
    expect(dbStudent).toBeDefined();
    expect(dbStudent?.user_id).toBeNull();
    expect(dbStudent?.first_name).toBe('Crispin');
    expect(dbStudent?.last_name).toBe('Sisa');
    expect(dbStudent?.middle_name).toBe('Alvarez');
    expect(dbStudent?.suffix).toBe('Jr');

    // Verify active Enrollment in adviser's section
    expect(dbStudent?.enrollments).toHaveLength(1);
    expect(dbStudent?.enrollments[0].section_id).toBe(SEC_1_ID);
    expect(dbStudent?.enrollments[0].status).toBe('Enrolled');
  });

  it('CAR-13: Unprovisioned learners endpoint identifies newly registered learner awaiting portal credentials', async () => {
    const unprovisioned = await getUnprovisionedLearners(T1_USER_ID);
    const found = unprovisioned.find((l) => l.lrn === NEW_LRN);

    expect(found).toBeDefined();
    expect(found?.firstName).toBe('Crispin');
    expect(found?.lastName).toBe('Sisa');
    expect(found?.sectionName).toBe('Grade 10 - Rizal');
    expect(found?.hasPortalAccount).toBe(false);
  });

  it('CAR-14: Admin provisions Student Portal account, seamlessly linking to existing Student record', async () => {
    const portalEmail = `${P}crispin_${Date.now()}@student.calulut.edu.ph`;
    const provisionResult = await createUser(
      {
        email: portalEmail,
        firstName: 'Crispin',
        lastName: 'Sisa',
        middleName: 'Alvarez',
        roles: ['Student'],
        studentProfile: {
          lrn: NEW_LRN,
          gradeLevel: 10,
          gender: 'Male',
        },
      },
      T1_USER_ID
    );

    expect(provisionResult.user).toBeDefined();
    expect(provisionResult.temporaryPassword).toBeDefined();
    provisionedNewUserId = provisionResult.user.id;

    // Verify: SAME Student record now linked to User (no second Student created)
    const studentsWithLrn = await prisma.student.findMany({
      where: { lrn: NEW_LRN },
    });
    expect(studentsWithLrn).toHaveLength(1);
    expect(studentsWithLrn[0].id).toBe(createdNewStudentId);
    expect(studentsWithLrn[0].user_id).toBe(provisionedNewUserId);
    expect(studentsWithLrn[0].first_name).toBe('Crispin');

    // Verify learner no longer appears in unprovisioned list
    const unprovisionedAfter = await getUnprovisionedLearners(T1_USER_ID);
    const stillUnprovisioned = unprovisionedAfter.find((l) => l.lrn === NEW_LRN);
    expect(stillUnprovisioned).toBeUndefined();
  });

  it('CAR-15: Attempt to re-provision or overwrite already-linked student is strictly rejected (409 STUDENT_ALREADY_LINKED)', async () => {
    // Attempting to provision another account with Crispin's LRN must fail
    await expect(
      createUser(
        {
          email: `${P}crispin_duplicate_${Date.now()}@student.calulut.edu.ph`,
          firstName: 'Imposter',
          lastName: 'Crispin',
          roles: ['Student'],
          studentProfile: {
            lrn: NEW_LRN,
            gradeLevel: 10,
            gender: 'Male',
          },
        },
        T1_USER_ID
      )
    ).rejects.toThrow(/STUDENT_ALREADY_LINKED|already has an active portal user account/);

    // Verify the original user link was NOT altered or overwritten
    const student = await prisma.student.findUnique({
      where: { lrn: NEW_LRN },
    });
    expect(student?.user_id).toBe(provisionedNewUserId);
  });

  it('CAR-16: Student Portal profile data retrieval preserves personal details and isolation', async () => {
    // Student logs in and queries their profile
    const studentProfile = await prisma.student.findUnique({
      where: { user_id: provisionedNewUserId },
      include: {
        user: true,
        enrollments: {
          include: { section: true },
        },
      },
    });

    expect(studentProfile).toBeDefined();
    expect(studentProfile?.lrn).toBe(NEW_LRN);
    expect(studentProfile?.first_name).toBe('Crispin');
    expect(studentProfile?.last_name).toBe('Sisa');
    expect(studentProfile?.enrollments[0].section.name).toBe('Grade 10 - Rizal');

    // Clean up created synthetic test records
    if (createdNewStudentId) {
      await prisma.enrollment.deleteMany({ where: { student_id: createdNewStudentId } });
      await prisma.student.deleteMany({ where: { id: createdNewStudentId } });
    }
    if (provisionedNewUserId) {
      await prisma.auditLog.deleteMany({ where: { actor_user_id: provisionedNewUserId } });
      await prisma.userRole.deleteMany({ where: { user_id: provisionedNewUserId } });
      await prisma.user.deleteMany({ where: { id: provisionedNewUserId } });
    }
  });
});
