/**
 * DigiSkwela — Student Health & Anthropometric Metrics Service
 * Module: backend/src/academic/health/healthMetric.service.ts
 * 
 * Conforms to:
 * - DepEd Order No. 058, s. 2017 (School Form 8 - Health and Nutrition)
 * - Calulut INHS operational guidelines: Class Advisers and assigned MAPEH teachers
 * - WHO 2007 Growth Reference for children and adolescents 5-19 years
 */

import prisma from '../../config/database.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { createAuditLog } from '../../audit/audit.service.js';
import { calculateMeasurementAge } from './ageCalculator.js';
import { classifyWhoBmi, classifyWhoHfa, calculateBmiValue } from './whoBmiCalculator.js';
import { v4 as uuidv4 } from 'uuid';
import { normalizePhilippinePhone } from '../../common/validation/studentValidation.js';
import { GuardianAuthorizationService } from '../../notifications/guardianAuthorization.service.js';

export interface RecordHealthMetricInput {
  studentId: string;
  academicYearId?: string;
  sectionId?: string;
  measurementPeriod: 'BOSY' | 'EOSY' | 'INTERIM';
  measurementDate: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  remarks?: string;
}

export interface UpdateLearnerDemographicsInput {
  dateOfBirth?: string | null; // YYYY-MM-DD
  gender?: 'Male' | 'Female';
}

export interface UpdateLearnerPersonalInfoInput extends UpdateLearnerDemographicsInput {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  suffix?: string | null;
  street?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  zipCode?: string | null;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  medicalConditions?: string | null;
  confirmGuardianContact?: boolean;
  guardianConfirmationMethod?: string;
  guardianConfirmationSource?: string;
}

/**
 * Checks if the caller is authorized to view or encode health metrics for a learner.
 * Authorized encoders:
 * - Class Adviser of the learner's current section
 * - MAPEH Teacher assigned to the learner's section
 * - Admin or Registrar
 * 
 * Note: Calulut INHS context has NO school nurse. Nurse approval is NEVER mandatory.
 */
export async function verifyHealthEncodingPermission(studentId: string, authUserId: string): Promise<{
  student: any;
  currentSection: any;
  currentEnrollment: any;
  callerRole: 'Adviser' | 'MAPEH' | 'Admin' | 'Registrar' | 'Student';
}> {
  const user = await prisma.user.findUnique({
    where: { id: authUserId },
    include: {
      user_roles: { include: { role: true } },
      teacher: true,
      student: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Caller user not found.');
  }

  const roleNames = user.user_roles.map(ur => ur.role.name);
  const isGlobalAdmin = roleNames.includes('Admin') || roleNames.includes('Principal');
  const isRegistrar = roleNames.includes('Registrar');

  // Load student with current section & current enrollment
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      current_section: {
        include: {
          adviser_teacher: true,
        },
      },
      enrollments: {
        where: { status: 'Enrolled' },
        include: {
          section: {
            include: {
              adviser_teacher: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 1,
      },
    },
  });

  if (!student) {
    throw new AppError(404, 'NOT_FOUND', 'Student record not found.');
  }

  const currentEnrollment = student.enrollments[0] || null;
  const section = student.current_section || currentEnrollment?.section || null;

  if (isGlobalAdmin) {
    return { student, currentSection: section, currentEnrollment, callerRole: 'Admin' };
  }
  if (isRegistrar) {
    return { student, currentSection: section, currentEnrollment, callerRole: 'Registrar' };
  }

  if (roleNames.includes('Student')) {
    if (student.user_id === user.id || student.id === user.student?.id) {
      return { student, currentSection: section, currentEnrollment, callerRole: 'Student' };
    }
    throw new AppError(403, 'FORBIDDEN', 'You may only access your own health records.');
  }

  if (!user.teacher) {
    throw new AppError(403, 'FORBIDDEN', 'Only assigned teachers or school administrators may access student health records.');
  }

  // Check 1: Is teacher the designated Section Class Adviser?
  if (section && section.adviser_teacher_id === user.teacher.id) {
    return { student, currentSection: section, currentEnrollment, callerRole: 'Adviser' };
  }

  // Check 2: Is teacher an assigned MAPEH teacher for this section?
  if (section) {
    const mapehAssignment = await prisma.teacherSubjectAssignment.findFirst({
      where: {
        section_id: section.id,
        teacher_id: user.teacher.id,
        subject: {
          OR: [
            { name: { contains: 'MAPEH', mode: 'insensitive' } },
            { name: { contains: 'Physical Education', mode: 'insensitive' } },
            { name: { contains: 'Health', mode: 'insensitive' } },
            { code: { contains: 'MAPEH', mode: 'insensitive' } },
          ],
        },
      },
    });

    if (mapehAssignment) {
      return { student, currentSection: section, currentEnrollment, callerRole: 'MAPEH' };
    }
  }

  throw new AppError(403, 'FORBIDDEN', 'You are not the designated Class Adviser or assigned MAPEH teacher for this learner.');
}

/**
 * Checks if caller can view health metrics (includes the student themselves).
 */
export async function verifyHealthViewingPermission(studentId: string, authUserId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: authUserId },
    include: {
      user_roles: { include: { role: true } },
      student: true,
      teacher: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Caller user not found.');
  }

  // If student is viewing their own record
  if (user.student && user.student.id === studentId) {
    return;
  }

  // Otherwise, require teacher/admin permission
  await verifyHealthEncodingPermission(studentId, authUserId);
}

/**
 * Record a new anthropometric health metric with WHO classification.
 */
export async function recordHealthMetric(
  input: RecordHealthMetricInput,
  authUserId: string,
  correlationId?: string
) {
  const { student, currentSection, currentEnrollment, callerRole } = await verifyHealthEncodingPermission(
    input.studentId,
    authUserId
  );

  if (!currentSection) {
    throw new AppError(400, 'NO_CURRENT_SECTION', 'Learner does not have a current section assignment.');
  }

  const academicYearId = input.academicYearId || currentSection.academic_year_id;
  const sectionId = input.sectionId || currentSection.id;

  // 1. Calculate Age at actual measurement date
  const ageDetail = calculateMeasurementAge(student.date_of_birth, input.measurementDate);
  const ageYears = ageDetail ? ageDetail.years : null;
  const ageMonths = ageDetail ? ageDetail.totalMonths : null;

  // 2. Calculate unrounded BMI and round to 1 decimal for display
  const rawBmi = calculateBmiValue(input.heightCm, input.weightKg);
  const roundedBmi = rawBmi != null ? Math.round(rawBmi * 10) / 10 : null;

  // 3. WHO 2007 Classifications
  let bmiCategory: string | null = null;
  let hfaCategory: string | null = null;
  let assessmentStatus = 'PENDING_INPUTS';

  const isSexValid = student.gender === 'Male' || student.gender === 'Female';
  // Official WHO 2007 Growth Reference strictly covers 61 to 228 completed months (5 yrs 1 mo to 19 yrs 0 mos)
  const isAgeValidForWho = ageMonths != null && ageMonths >= 61 && ageMonths <= 228;

  if (isSexValid && isAgeValidForWho && rawBmi != null) {
    const whoBmiResult = classifyWhoBmi(input.heightCm, input.weightKg, ageMonths, student.gender);
    if (whoBmiResult.status !== 'Pending Verification / Not Calculated') {
      bmiCategory = whoBmiResult.status;
    }

    const whoHfaResult = classifyWhoHfa(input.heightCm, ageMonths, student.gender);
    if (whoHfaResult.status !== 'Pending Verification / Not Calculated') {
      hfaCategory = whoHfaResult.status;
    }

    if (bmiCategory && hfaCategory) {
      assessmentStatus = 'COMPLETED';
    }
  }

  // 4. Versioning & Repeat Measurement History
  // Check if a latest record exists for this student, academic year, and period
  const existingLatest = await prisma.studentHealthMetric.findFirst({
    where: {
      student_id: student.id,
      academic_year_id: academicYearId,
      measurement_period: input.measurementPeriod,
      is_latest: true,
    },
  });

  const nextVersion = existingLatest ? existingLatest.version_number + 1 : 1;
  const correctionOfId = existingLatest ? existingLatest.id : null;

  // 5. In a transaction, mark existing as not latest and insert new record
  const result = await prisma.$transaction(async (tx) => {
    if (existingLatest) {
      await tx.studentHealthMetric.update({
        where: { id: existingLatest.id },
        data: { is_latest: false },
      });
    }

    const newMetric = await tx.studentHealthMetric.create({
      data: {
        id: uuidv4(),
        student_id: student.id,
        academic_year_id: academicYearId,
        section_id: sectionId,
        enrollment_id: currentEnrollment?.id || null,
        measurement_period: input.measurementPeriod,
        measurement_date: new Date(input.measurementDate),
        height_cm: input.heightCm,
        weight_kg: input.weightKg,
        computed_age_years: ageYears,
        computed_age_months: ageMonths,
        computed_bmi: roundedBmi,
        bmi_category: bmiCategory,
        hfa_category: hfaCategory,
        assessment_status: assessmentStatus,
        who_reference_version: 'WHO_2007_GROWTH_REFERENCE',
        calculation_engine_version: 'DIGISKWELA_CALULUT_HEALTH_V1',
        version_number: nextVersion,
        is_latest: true,
        correction_of_metric_id: correctionOfId,
        correction_reason: existingLatest ? `Updated by ${callerRole}` : null,
        remarks: input.remarks || null,
        recorded_by_id: authUserId,
      },
      include: {
        recorded_by: {
          select: { id: true, first_name: true, last_name: true, school_id: true },
        },
      },
    });

    return newMetric;
  });

  // 6. Security Audit Log
  await createAuditLog({
    actorUserId: authUserId,
    actorRole: callerRole,
    action: 'STUDENT_HEALTH_RECORDED',
    category: 'ACADEMIC',
    resourceType: 'health_metric',
    resourceId: result.id,
    targetLabel: `${student.last_name || ''}, ${student.first_name || ''} (${input.measurementPeriod})`,
    result: 'SUCCESS',
    correlationId,
  }).catch(() => {});

  return result;
}

/**
 * Retrieve health measurement history for a learner.
 */
export async function getStudentHealthHistory(studentId: string, authUserId: string) {
  await verifyHealthViewingPermission(studentId, authUserId);

  const history = await prisma.studentHealthMetric.findMany({
    where: { student_id: studentId },
    orderBy: [
      { measurement_date: 'desc' },
      { version_number: 'desc' },
    ],
    include: {
      recorded_by: {
        select: { id: true, first_name: true, last_name: true, school_id: true },
      },
      verified_by: {
        select: { id: true, first_name: true, last_name: true, school_id: true },
      },
    },
  });

  return history;
}

/**
 * Retrieve section-wide health summary for Class Adviser / MAPEH teacher (SF8 Preparation).
 */
export async function getSectionHealthRoster(sectionId: string, authUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: authUserId },
    include: {
      user_roles: { include: { role: true } },
      teacher: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Caller user not found.');
  }

  const roleNames = user.user_roles.map(ur => ur.role.name);
  const isGlobalAdmin = roleNames.includes('Admin') || roleNames.includes('Principal') || roleNames.includes('Registrar');

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      adviser_teacher: true,
      enrollments: {
        where: { status: 'Enrolled' },
        include: {
          student: {
            include: {
              health_metrics: {
                where: { is_latest: true },
                orderBy: { measurement_date: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  if (!section) {
    throw new AppError(404, 'NOT_FOUND', 'Section not found.');
  }

  if (!isGlobalAdmin) {
    if (!user.teacher) {
      throw new AppError(403, 'FORBIDDEN', 'Teacher profile required.');
    }
    const isAdviser = section.adviser_teacher_id === user.teacher.id;
    if (!isAdviser) {
      // Check MAPEH
      const mapeh = await prisma.teacherSubjectAssignment.findFirst({
        where: {
          section_id: sectionId,
          teacher_id: user.teacher.id,
          subject: {
            OR: [
              { name: { contains: 'MAPEH', mode: 'insensitive' } },
              { name: { contains: 'Physical Education', mode: 'insensitive' } },
              { name: { contains: 'Health', mode: 'insensitive' } },
            ],
          },
        },
      });
      if (!mapeh) {
        throw new AppError(403, 'FORBIDDEN', 'You are not the designated Class Adviser or assigned MAPEH teacher for this section.');
      }
    }
  }

  return section;
}

/**
 * Authorized personal information & demographic update by Class Adviser, Admin, or Registrar.
 * MAPEH teachers are strictly forbidden from altering personal/guardian data.
 */
function normalizeGenderValue(val?: string | null): string | null {
  if (!val) return null;
  const s = val.trim().toUpperCase();
  if (s === 'M' || s === 'MALE') return 'Male';
  if (s === 'F' || s === 'FEMALE') return 'Female';
  return s;
}

function normalizeDobValue(val?: string | Date | null): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const trimmed = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return trimmed;
}

export async function updateLearnerPersonalInfo(
  studentId: string,
  input: UpdateLearnerPersonalInfoInput,
  authUserId: string,
  correlationId?: string
) {
  const { student, callerRole } = await verifyHealthEncodingPermission(studentId, authUserId);

  const normRole = (callerRole || '').toUpperCase();

  if (normRole === 'MAPEH') {
    throw new AppError(403, 'FORBIDDEN', 'MAPEH teachers are only authorized to record health measurements, not modify student personal demographics.');
  }

  // Protected DepEd identity fields: Date of Birth and Recorded Sex require Registrar/Admin verification
  // if an authoritative value is already recorded. If currently null, the Class Adviser is completing initial baseline SF1 data.
  const hasExistingDob = student.date_of_birth !== null;
  const hasExistingGender = student.gender !== null;
  const isModifyingExistingDob =
    hasExistingDob &&
    input.dateOfBirth !== undefined &&
    normalizeDobValue(input.dateOfBirth) !== normalizeDobValue(student.date_of_birth);
  const isModifyingExistingGender =
    hasExistingGender &&
    input.gender !== undefined &&
    normalizeGenderValue(input.gender) !== normalizeGenderValue(student.gender);

  if ((normRole === 'ADVISER' || normRole === 'CLASS_ADVISER') && (isModifyingExistingDob || isModifyingExistingGender)) {
    throw new AppError(
      403,
      'PROTECTED_IDENTITY_FIELD',
      'Date of birth and recorded sex are protected DepEd PSA identity records. Official corrections of existing records must be verified and performed by the School Registrar or Administrator.'
    );
  }

  const updateData: Record<string, any> = {};

  if (input.firstName !== undefined) updateData.first_name = input.firstName;
  if (input.middleName !== undefined) updateData.middle_name = input.middleName || null;
  if (input.lastName !== undefined) updateData.last_name = input.lastName;
  if (input.suffix !== undefined) updateData.suffix = input.suffix || null;
  if (input.dateOfBirth && (normRole === 'ADMIN' || normRole === 'REGISTRAR' || !hasExistingDob)) {
    updateData.date_of_birth = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
  }
  if (input.gender && (normRole === 'ADMIN' || normRole === 'REGISTRAR' || !hasExistingGender)) {
    updateData.gender = input.gender;
  }
  if (input.street !== undefined) updateData.street = input.street || null;
  if (input.city !== undefined) updateData.city = input.city || null;
  if (input.stateProvince !== undefined) updateData.state_province = input.stateProvince || null;
  if (input.zipCode !== undefined) updateData.zip_code = input.zipCode || null;
  if (input.guardianFirstName !== undefined) updateData.guardian_first_name = input.guardianFirstName || null;
  if (input.guardianLastName !== undefined) updateData.guardian_last_name = input.guardianLastName || null;
  if (input.guardianPhone !== undefined) updateData.guardian_phone = normalizePhilippinePhone(input.guardianPhone);
  if (input.guardianEmail !== undefined) updateData.guardian_email = input.guardianEmail || null;
  if (input.bloodType !== undefined) updateData.blood_type = input.bloodType || null;
  if (input.allergies !== undefined) updateData.allergies = input.allergies || null;
  if (input.medicalConditions !== undefined) updateData.medical_conditions = input.medicalConditions || null;

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: updateData,
  });

  // If guardian email is modified or revoked, immediately invalidate any queued outbox notifications
  // targeting the previous or revoked address so outdated contacts cannot receive stale notifications
  if (input.guardianEmail !== undefined && input.guardianEmail !== student.guardian_email) {
    await (prisma as any).gateAttendanceNotification.updateMany({
      where: {
        student_id: student.id,
        recipient_role: 'GUARDIAN',
        status: 'PENDING',
        recipient_email: { not: input.guardianEmail || '' },
      },
      data: {
        status: 'SKIPPED',
        error_message: 'Suppressed: Guardian email address was modified or revoked by authorized school personnel after notification was queued',
      },
    }).catch(() => {});

    // Register new contact in PENDING_VERIFICATION or revoke if cleared
    if (input.guardianEmail && input.guardianEmail.trim().length > 0) {
      const guardianFullName = [
        input.guardianFirstName !== undefined ? input.guardianFirstName : updated.guardian_first_name,
        input.guardianLastName !== undefined ? input.guardianLastName : updated.guardian_last_name,
      ].filter(Boolean).join(' ').trim() || `${updated.first_name || ''} Guardian`.trim();

      await GuardianAuthorizationService.registerContact({
        studentId: student.id,
        guardianEmail: input.guardianEmail.trim(),
        guardianName: guardianFullName,
        clientPrisma: prisma,
        authorizedByUserId: authUserId,
        autoAuthorizeForTesting: false,
      }).catch((err) => {
        console.warn('[GUARDIAN_AUTH] Could not register authorization lifecycle record:', err?.message);
      });
    } else {
      await GuardianAuthorizationService.revokeContact(
        prisma,
        student.id,
        student.guardian_email || '',
        'Guardian email removed by school personnel in demographics'
      ).catch(() => {});
    }
  }

  // Support School-Confirmed Guardian Contact during Registration / Enrollment / Personal Info Updates
  const effectiveGuardianEmail = (input.guardianEmail !== undefined ? input.guardianEmail : student.guardian_email)?.trim();
  if (input.confirmGuardianContact && effectiveGuardianEmail) {
    await GuardianAuthorizationService.authorizeManuallyByStaff(
      prisma,
      student.id,
      effectiveGuardianEmail,
      authUserId,
      input.guardianConfirmationSource || 'DepEd SF1 Enrollment Record Verification',
      input.guardianConfirmationMethod || 'SCHOOL_ENROLLMENT_CONFIRMED'
    ).catch((err) => {
      console.warn('[GUARDIAN_AUTH] Could not complete school confirmation during personal info update:', err?.message);
    });
  }

  // If student is linked to a portal User account and name was updated, synchronize User names
  if (student.user_id && (input.firstName !== undefined || input.lastName !== undefined)) {
    await prisma.user.update({
      where: { id: student.user_id },
      data: {
        ...(input.firstName !== undefined ? { first_name: input.firstName } : {}),
        ...(input.lastName !== undefined ? { last_name: input.lastName } : {}),
      },
    }).catch(() => {});
  }

  await createAuditLog({
    actorUserId: authUserId,
    actorRole: callerRole,
    action: 'LEARNER_PERSONAL_INFO_UPDATED',
    category: 'ACADEMIC',
    resourceType: 'student',
    resourceId: student.id,
    targetLabel: `${updated.last_name || ''}, ${updated.first_name || ''}`,
    result: 'SUCCESS',
    correlationId,
  }).catch(() => {});

  return updated;
}

/**
 * Authorized demographic update (birthdate, recorded sex) by Class Adviser.
 */
export async function updateLearnerDemographics(
  studentId: string,
  input: UpdateLearnerDemographicsInput,
  authUserId: string,
  correlationId?: string
) {
  return updateLearnerPersonalInfo(studentId, input, authUserId, correlationId);
}

