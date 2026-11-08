/**
 * DigiSkwela — Class Adviser Student Registration & Advisory Enrollment Service
 * Module: backend/src/academic/advisory/advisory.service.ts
 *
 * Implements:
 * - DepEd Order No. 017, s. 2025 (Revised Basic Education Enrollment Policy)
 * - DepEd Order No. 011, s. 2018 (School Forms Preparation and Integrity)
 * - Calulut INHS Operating Model (Class Adviser as Primary Student Information Encoder)
 *
 * Enforces:
 * - Strict Class Adviser authorization (only assigned section adviser can enroll/register)
 * - Search-first registry workflow (prevent duplicate identities)
 * - Atomic enrollment transactions
 * - Transfer conflict detection
 * - Approach A compatibility (allows Student to exist prior to Portal User provisioning)
 */

import prisma, { withTransaction } from '../../config/database.js';
import { generateId } from '../../common/utils/uuid.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { createAuditLog } from '../../audit/audit.service.js';
import { normalizePhilippinePhone } from '../../common/validation/studentValidation.js';

export interface SearchLearnerItem {
  studentId: string;
  lrn: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  suffix?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  hasPortalAccount: boolean;
  currentEnrollment: {
    isEnrolled: boolean;
    enrollmentId?: string;
    sectionId?: string;
    sectionName?: string;
    gradeLevel?: number;
    academicYearId?: string;
    status?: string;
  };
}

export interface EnrollExistingLearnerInput {
  sectionId: string;
  studentId: string;
  academicYearId?: string;
}

export interface RegisterNewLearnerInput {
  sectionId: string;
  lrn: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  suffix?: string | null;
  gender: string;
  dateOfBirth: string; // YYYY-MM-DD
  street?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  zipCode?: string | null;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianRelationship?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  medicalConditions?: string | null;
}

/**
 * Validates whether the authenticated user is the designated Class Adviser
 * for the specified section in the active academic year.
 */
export async function assertClassAdviserAuthorization(
  actorUserId: string,
  sectionId: string,
  txClient: any = prisma
) {
  // 1. Resolve Teacher record from User ID
  const teacher = await txClient.teacher.findUnique({
    where: { user_id: actorUserId },
  });

  if (!teacher) {
    throw new AppError(403, 'FORBIDDEN', 'Current user does not have an active Teacher profile.');
  }

  // 2. Resolve Section record and check adviser assignment
  const section = await txClient.section.findUnique({
    where: { id: sectionId },
    include: {
      academic_year: true,
      adviser_teacher: {
        include: { user: true },
      },
    },
  });

  if (!section) {
    throw new AppError(404, 'NOT_FOUND', `Section with ID '${sectionId}' not found.`);
  }

  // Check if caller is the designated Class Adviser
  const isAdviser = section.adviser_teacher_id === teacher.id;
  if (!isAdviser) {
    throw new AppError(
      403,
      'ADVISER_AUTHORIZATION_REQUIRED',
      `Forbidden: Only the designated Class Adviser (${section.adviser_name_snapshot || 'Assigned Adviser'}) can manage learner enrollment for Section ${section.name}. Subject teachers are not authorized to enroll learners.`
    );
  }

  return { teacher, section };
}

/**
 * Searches the authoritative learner registry before registration.
 * Checks LRN, student number, and name across existing records.
 */
export async function searchLearnersRegistry(
  query: string,
  actorUserId: string,
  txClient: any = prisma
): Promise<SearchLearnerItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  // Search by exact or partial LRN, or by first/last name across Student and User
  const students = await txClient.student.findMany({
    where: {
      OR: [
        { lrn: { contains: q, mode: 'insensitive' } },
        { student_number: { contains: q, mode: 'insensitive' } },
        { first_name: { contains: q, mode: 'insensitive' } },
        { last_name: { contains: q, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { first_name: { contains: q, mode: 'insensitive' } },
              { last_name: { contains: q, mode: 'insensitive' } },
              { school_id: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ],
    },
    include: {
      user: true,
      enrollments: {
        include: {
          section: true,
          academic_year: true,
        },
        orderBy: { created_at: 'desc' },
      },
    },
    take: 20,
  });

  return students.map((s: any) => {
    const activeEnr = s.enrollments?.find((e: any) => e.status === 'Enrolled') || s.enrollments?.[0];
    const u = s.user || {};

    return {
      studentId: s.id,
      id: s.id,
      lrn: s.lrn,
      firstName: s.first_name || u.first_name || '',
      lastName: s.last_name || u.last_name || '',
      first_name: s.first_name || u.first_name || '',
      last_name: s.last_name || u.last_name || '',
      middleName: s.middle_name || u.middle_name || null,
      suffix: s.suffix || u.suffix || null,
      gender: s.gender || null,
      dateOfBirth: s.date_of_birth ? s.date_of_birth.toISOString().split('T')[0] : null,
      hasPortalAccount: Boolean(s.user_id && u.id && u.status === 'active'),
      currentEnrollment: {
        isEnrolled: activeEnr?.status === 'Enrolled',
        enrollmentId: activeEnr?.id,
        sectionId: activeEnr?.section_id,
        sectionName: activeEnr?.section?.name,
        gradeLevel: activeEnr?.section?.grade_level || s.grade_level,
        academicYearId: activeEnr?.academic_year_id,
        status: activeEnr?.status,
      },
    };
  });
}

/**
 * Enrolls an existing verified learner into the Class Adviser's section.
 * Enforces duplicate enrollment checks, transfer conflict detection, and transactional integrity.
 */
export async function enrollExistingLearner(
  input: EnrollExistingLearnerInput,
  actorUserId: string,
  correlationId?: string
) {
  return withTransaction(async (tx) => {
    // 1. Authorize Class Adviser
    const { section } = await assertClassAdviserAuthorization(actorUserId, input.sectionId, tx);

    const academicYearId = input.academicYearId || section.academic_year_id;

    // 2. Verify Student exists
    const student = await tx.student.findUnique({
      where: { id: input.studentId },
      include: {
        user: true,
        enrollments: {
          where: { academic_year_id: academicYearId },
          include: { section: true },
        },
      },
    });

    if (!student) {
      throw new AppError(404, 'NOT_FOUND', `Learner record with ID '${input.studentId}' not found.`);
    }

    // 3. Check for Duplicate Enrollment in this section
    const enrolledInThisSection = student.enrollments.find(
      (e: any) => e.section_id === input.sectionId && e.status === 'Enrolled'
    );
    if (enrolledInThisSection) {
      throw new AppError(
        400,
        'DUPLICATE_ENROLLMENT',
        `Learner ${student.user?.last_name || student.lrn} is already actively enrolled in Section ${section.name}.`
      );
    }

    // 4. Check for Conflicting Active Enrollment in Another Section (Transfer Conflict)
    const activeOtherEnrollment = student.enrollments.find(
      (e: any) => e.section_id !== input.sectionId && e.status === 'Enrolled'
    );
    if (activeOtherEnrollment) {
      throw new AppError(
        409,
        'TRANSFER_CONFLICT',
        `Enrollment Conflict: Learner is currently actively enrolled in Section '${activeOtherEnrollment.section?.name}'. Under DepEd Order No. 017, s. 2025, an official mid-year section transfer must be initiated by the Registrar.`
      );
    }

    // 5. Create Enrollment Record
    const enrollmentId = generateId();
    const enrollment = await tx.enrollment.create({
      data: {
        id: enrollmentId,
        student_id: student.id,
        section_id: input.sectionId,
        academic_year_id: academicYearId,
        status: 'Enrolled',
      },
    });

    // 6. Update Student's current_section_id
    await tx.student.update({
      where: { id: student.id },
      data: {
        current_section_id: input.sectionId,
        grade_level: section.grade_level,
      },
    });

    // 7. Audit Log
    await createAuditLog(
      {
        actorUserId,
        action: 'CLASS_ADVISER_STUDENT_ENROLLED',
        resourceType: 'student_enrollment',
        resourceId: enrollmentId,
        newState: {
          studentId: student.id,
          lrn: student.lrn,
          sectionId: input.sectionId,
          sectionName: section.name,
          academicYearId,
        },
        correlationId,
      },
      tx
    );

    return {
      success: true,
      enrollmentId,
      studentId: student.id,
      lrn: student.lrn,
      sectionName: section.name,
      enrolledAt: new Date(),
    };
  });
}

/**
 * Validates new learner registration data according to DepEd Order No. 017, s. 2025.
 * Checks LRN uniqueness and prepares registration payload.
 */
export async function validateNewLearnerRegistration(
  input: RegisterNewLearnerInput,
  actorUserId: string,
  txClient: any = prisma
) {
  // 1. Authorize Class Adviser
  const { section } = await assertClassAdviserAuthorization(actorUserId, input.sectionId, txClient);

  // 2. Validate LRN Format (must be exactly 12 numeric digits)
  const cleanLrn = input.lrn.trim();
  if (!/^\d{12}$/.test(cleanLrn)) {
    throw new AppError(400, 'INVALID_LRN_FORMAT', 'Learner Reference Number (LRN) must consist of exactly 12 numeric digits.');
  }

  // 3. Enforce Global LRN Uniqueness
  const existingWithLrn = await txClient.student.findUnique({
    where: { lrn: cleanLrn },
    include: { user: true },
  });

  if (existingWithLrn) {
    throw new AppError(
      409,
      'DUPLICATE_LRN',
      `Duplicate LRN: An existing learner (${existingWithLrn.last_name || existingWithLrn.user?.last_name || 'Registered Learner'}, ${existingWithLrn.first_name || existingWithLrn.user?.first_name || ''}) is already registered with LRN ${cleanLrn}. Use the Find / Enroll Existing Student option instead.`
    );
  }

  // 4. Validate Required Identity Fields
  if (!input.firstName || input.firstName.trim().length === 0) {
    throw new AppError(400, 'MISSING_FIRST_NAME', 'First name is required for learner registration.');
  }
  if (!input.lastName || input.lastName.trim().length === 0) {
    throw new AppError(400, 'MISSING_LAST_NAME', 'Last name is required for learner registration.');
  }
  if (!input.dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth)) {
    throw new AppError(400, 'INVALID_BIRTHDATE', 'Valid date of birth in YYYY-MM-DD format is required.');
  }
  if (!input.gender || !['Male', 'Female'].includes(input.gender)) {
    throw new AppError(400, 'INVALID_GENDER', "Recorded sex must be 'Male' or 'Female'.");
  }

  return {
    valid: true,
    cleanLrn,
    section,
  };
}

/**
 * Fully registers a new learner into Calulut INHS and immediately enrolls
 * the learner into the caller's assigned advisory section.
 * Operates under Approach A: creates Student with user_id = null.
 */
export async function registerNewLearner(
  input: RegisterNewLearnerInput,
  actorUserId: string,
  correlationId?: string
) {
  return withTransaction(async (tx) => {
    // 1. Authorize Class Adviser
    const { teacher, section } = await assertClassAdviserAuthorization(actorUserId, input.sectionId, tx);

    // 2. Validate LRN Format (12 numeric digits)
    const cleanLrn = input.lrn.trim();
    if (!/^\d{12}$/.test(cleanLrn)) {
      throw new AppError(400, 'INVALID_LRN_FORMAT', 'Learner Reference Number (LRN) must consist of exactly 12 numeric digits.');
    }

    // 3. Enforce Global LRN Uniqueness
    const existingStudent = await tx.student.findUnique({
      where: { lrn: cleanLrn },
      include: { user: true },
    });
    if (existingStudent) {
      throw new AppError(
        409,
        'DUPLICATE_LRN',
        `Duplicate LRN: An existing learner (${existingStudent.last_name || existingStudent.user?.last_name || 'Registered Learner'}, ${existingStudent.first_name || existingStudent.user?.first_name || ''}) is already registered with LRN ${cleanLrn}. Use the Find / Enroll Existing Student option instead.`
      );
    }

    // 4. Validate Required Identity Fields
    const cleanFirstName = input.firstName.trim();
    const cleanLastName = input.lastName.trim();
    if (!cleanFirstName) throw new AppError(400, 'MISSING_FIRST_NAME', 'First name is required.');
    if (!cleanLastName) throw new AppError(400, 'MISSING_LAST_NAME', 'Last name is required.');
    if (!input.dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth)) {
      throw new AppError(400, 'INVALID_BIRTHDATE', 'Valid date of birth in YYYY-MM-DD format is required.');
    }
    if (!input.gender || !['Male', 'Female'].includes(input.gender)) {
      throw new AppError(400, 'INVALID_GENDER', "Recorded sex must be 'Male' or 'Female'.");
    }

    // 5. Persist Student record under Approach A (user_id is null)
    const studentId = generateId();
    const student = await tx.student.create({
      data: {
        id: studentId,
        user_id: null,
        lrn: cleanLrn,
        student_number: cleanLrn,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        middle_name: input.middleName?.trim() || null,
        suffix: input.suffix?.trim() || null,
        grade_level: section.grade_level,
        gender: input.gender,
        date_of_birth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
        current_section_id: section.id,
        street: input.street?.trim() || null,
        city: input.city?.trim() || null,
        state_province: input.stateProvince?.trim() || null,
        zip_code: input.zipCode?.trim() || null,
        guardian_first_name: input.guardianFirstName?.trim() || null,
        guardian_last_name: input.guardianLastName?.trim() || null,
        guardian_phone: normalizePhilippinePhone(input.guardianPhone),
        guardian_email: input.guardianEmail?.trim() || null,
        blood_type: input.bloodType?.trim() || null,
        allergies: input.allergies?.trim() || null,
        medical_conditions: input.medicalConditions?.trim() || null,
      },
    });

    // 6. Create active Enrollment in the adviser's section
    const enrollmentId = generateId();
    await tx.enrollment.create({
      data: {
        id: enrollmentId,
        student_id: studentId,
        section_id: section.id,
        academic_year_id: section.academic_year_id,
        status: 'Enrolled',
      },
    });

    // 7. Audit Logging
    await createAuditLog(
      {
        actorUserId,
        action: 'CLASS_ADVISER_REGISTER_LEARNER',
        category: 'ACADEMIC',
        resourceType: 'student',
        resourceId: studentId,
        targetLabel: `${cleanLastName}, ${cleanFirstName} (LRN: ${cleanLrn})`,
        result: 'SUCCESS',
        newState: {
          studentId,
          enrollmentId,
          sectionId: section.id,
          sectionName: section.name,
          lrn: cleanLrn,
          gradeLevel: section.grade_level,
          hasPortalAccount: false,
        },
        correlationId,
      },
      tx
    );

    return {
      success: true,
      studentId,
      enrollmentId,
      lrn: cleanLrn,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      sectionName: section.name,
      gradeLevel: section.grade_level,
      hasPortalAccount: false,
      registeredAt: new Date(),
    };
  });
}

/**
 * Lists all registered learners in the school who do NOT yet have
 * a Student Portal login account (user_id IS NULL).
 * Used by Admin Account Management for provisioning.
 */
export async function getUnprovisionedLearners(
  actorUserId: string,
  txClient: any = prisma
) {
  const students = await txClient.student.findMany({
    where: {
      user_id: null,
    },
    include: {
      enrollments: {
        include: {
          section: true,
          academic_year: true,
        },
        orderBy: { created_at: 'desc' },
      },
    },
    orderBy: [
      { last_name: 'asc' },
      { first_name: 'asc' },
    ],
  });

  return students.map((s: any) => {
    const activeEnr = s.enrollments?.find((e: any) => e.status === 'Enrolled') || s.enrollments?.[0];
    return {
      studentId: s.id,
      lrn: s.lrn,
      studentNumber: s.student_number,
      firstName: s.first_name || '',
      lastName: s.last_name || '',
      middleName: s.middle_name || null,
      suffix: s.suffix || null,
      gradeLevel: s.grade_level,
      gender: s.gender || null,
      dateOfBirth: s.date_of_birth ? s.date_of_birth.toISOString().split('T')[0] : null,
      sectionId: activeEnr?.section_id || null,
      sectionName: activeEnr?.section?.name || 'Unassigned',
      enrollmentStatus: activeEnr?.status || 'Unenrolled',
      hasPortalAccount: false,
      registeredAt: s.created_at,
    };
  });
}

