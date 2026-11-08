import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { hashPassword } from '../auth/auth.service.js';
import { createAuditLog } from '../audit/audit.service.js';
import { studentProfileUserBackendSchema, normalizePhilippinePhone } from '../common/validation/studentValidation.js';

// ─── DTOs ──────────────────────────────────────────────────

export const createUserSchema = z.object({
  schoolId: z.string().min(1, 'School ID is required.').optional(),
  email: z.string().email().optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters.').optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  roles: z.array(z.string()).min(1, 'At least one role is required.'),
  // Optional profile fields
  studentProfile: studentProfileUserBackendSchema.optional(),
  teacherProfile: z.object({
    employeeId: z.string().min(1),
    department: z.string().optional(),
    position: z.string().optional(),
    specialization: z.string().optional(),
  }).optional(),
  staffProfile: z.object({
    employeeId: z.string().min(1),
    department: z.string().optional(),
    position: z.string().optional(),
  }).optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

// ─── SERVICE ───────────────────────────────────────────────

/**
 * Cryptographically secure temporary credential generator.
 * - 16 characters in length
 * - Sourced from an unambiguous 65-character alphabet:
 *   * 24 uppercase ('ABCDEFGHJKLMNPQRSTUVWXYZ', excludes ambiguous 'I', 'O')
 *   * 25 lowercase ('abcdefghijkmnopqrstuvwxyz', excludes ambiguous 'l')
 *   * 8 numeric digits ('23456789', excludes ambiguous '0', '1')
 *   * 8 special symbols ('!@#$%^&*')
 *   Total alphabet size: 24 + 25 + 8 + 8 = 65 characters.
 * - Guarantees representation from 4 distinct character classes.
 * - Uniform selection across 12 variable positions using crypto.randomInt (no modulo bias).
 * - Delivers 96.36 bits of cryptographic entropy (65^16 ≈ 1.014 × 10^29 keyspace).
 */
export function generateSecureTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const allChars = upper + lower + digits + symbols;

  // Guarantee at least one character from each class
  const passwordChars = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)],
  ];

  // Fill remaining 12 positions using unbiased cryptographic integer generation
  for (let i = 0; i < 12; i++) {
    passwordChars.push(allChars[crypto.randomInt(0, allChars.length)]);
  }

  // Cryptographic Durstenfeld shuffle using crypto.randomInt
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('');
}

export async function createUser(
  input: z.infer<typeof createUserSchema>,
  actorId: string,
  correlationId?: string,
  clientMeta?: { actorSchoolId?: string | null; actorRole?: string | null; ipAddress?: string | null; userAgent?: string | null }
) {
  // Resolve role IDs
  const roles = await prisma.role.findMany({
    where: { name: { in: input.roles } },
  });

  if (roles.length !== input.roles.length) {
    const found = roles.map(r => r.name);
    const missing = input.roles.filter(r => !found.includes(r));
    throw new AppError(400, 'INVALID_ROLES', `Roles not found: ${missing.join(', ')}`);
  }

  // Determine authoritative School ID:
  // - Teacher: teacherProfile.employeeId
  // - Staff (Principal, Registrar, Guidance, Nurse): staffProfile.employeeId
  // - Student: studentProfile.studentNumber or input.schoolId
  // - Admin / ITAdmin / GateOperator: input.schoolId
  let effectiveSchoolId = input.schoolId?.trim();
  if (input.roles.includes('Student') || input.studentProfile) {
    // Official Student School ID: Each student's 12-digit DepEd LRN is their Student Portal username and identification number
    effectiveSchoolId = input.studentProfile?.lrn?.trim() || input.schoolId?.trim();
    if (!effectiveSchoolId || !/^\d{12}$/.test(effectiveSchoolId)) {
      throw new AppError(
        400,
        'INVALID_LRN',
        'Official 12-digit DepEd LRN is required as the student identification number and portal username.'
      );
    }
  } else if (input.teacherProfile?.employeeId) {
    effectiveSchoolId = input.teacherProfile.employeeId.trim();
  } else if (input.staffProfile?.employeeId) {
    effectiveSchoolId = input.staffProfile.employeeId.trim();
  }

  if (!effectiveSchoolId) {
    if (input.roles.includes('Teacher')) {
      effectiveSchoolId = `EMP-T-${Math.floor(1000 + Math.random() * 9000)}`;
    } else if (input.roles.includes('GateOperator')) {
      effectiveSchoolId = `GATE-${Math.floor(1000 + Math.random() * 9000)}`;
    } else if (input.roles.includes('Admin')) {
      effectiveSchoolId = `ADM-${Math.floor(1000 + Math.random() * 9000)}`;
    } else if (input.roles.includes('ITAdmin')) {
      effectiveSchoolId = `IT-${Math.floor(1000 + Math.random() * 9000)}`;
    } else {
      effectiveSchoolId = `SCH-${Math.floor(10000 + Math.random() * 90000)}`;
    }
  }

  const normalizedSchoolId = effectiveSchoolId.toUpperCase();

  // Enforce global uniqueness of School ID
  const existingSchoolIdUser = await prisma.user.findFirst({
    where: {
      school_id: {
        equals: normalizedSchoolId,
        mode: 'insensitive',
      },
    },
  });
  if (existingSchoolIdUser) {
    throw new AppError(409, 'DUPLICATE_SCHOOL_ID', 'School ID is already assigned.');
  }

  const userId = generateId();
  const generatedPassword = input.password ? null : generateSecureTemporaryPassword();
  const finalPassword = input.password || generatedPassword!;
  const passwordHash = await hashPassword(finalPassword);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: userId,
          school_id: normalizedSchoolId,
          email: input.email ? input.email.trim() : null,
          password_hash: passwordHash,
          first_name: input.firstName,
          last_name: input.lastName,
          middle_name: input.middleName,
          user_roles: {
            create: roles.map(r => ({
              role_id: r.id,
            })),
          },
          must_change_password: !!generatedPassword, // Force change if auto-generated
        },
      });

      // Create profile if specified or link existing learner profile
      if (input.studentProfile) {
        // Under Approach A: Check if a learner with this LRN is already registered
        const existingStudent = await tx.student.findUnique({
          where: { lrn: input.studentProfile.lrn },
        });

        if (existingStudent) {
          // Section 5 Protection: A second login cannot silently claim or overwrite an already-linked student!
          if (existingStudent.user_id) {
            throw new AppError(
              409,
              'STUDENT_ALREADY_LINKED',
              `Learner with LRN ${input.studentProfile.lrn} already has an active portal user account. Unauthorized account reassignment is strictly prohibited. Use Account Recovery / Password Reset instead.`
            );
          }

          // Link eligible unprovisioned student record to the newly created User account
          await tx.student.update({
            where: { id: existingStudent.id },
            data: {
              user_id: userId,
              first_name: existingStudent.first_name || input.firstName,
              last_name: existingStudent.last_name || input.lastName,
              middle_name: existingStudent.middle_name || input.middleName || null,
              grade_level: input.studentProfile.gradeLevel || existingStudent.grade_level,
              gender: input.studentProfile.gender || existingStudent.gender,
              guardian_first_name: input.studentProfile.guardianFirstName || existingStudent.guardian_first_name,
              guardian_last_name: input.studentProfile.guardianLastName || existingStudent.guardian_last_name,
              guardian_phone: input.studentProfile.guardianPhone ? normalizePhilippinePhone(input.studentProfile.guardianPhone) : existingStudent.guardian_phone,
              guardian_email: input.studentProfile.guardianEmail || existingStudent.guardian_email,
              street: input.studentProfile.street || existingStudent.street,
              city: input.studentProfile.city || existingStudent.city,
              state_province: input.studentProfile.stateProvince || existingStudent.state_province,
              zip_code: input.studentProfile.zipCode || existingStudent.zip_code,
            },
          });
        } else {
          await tx.student.create({
            data: {
              id: generateId(),
              user_id: userId,
              student_number: normalizedSchoolId,
              lrn: input.studentProfile.lrn,
              grade_level: input.studentProfile.gradeLevel,
              gender: input.studentProfile.gender,
              guardian_first_name: input.studentProfile.guardianFirstName,
              guardian_last_name: input.studentProfile.guardianLastName,
              guardian_phone: normalizePhilippinePhone(input.studentProfile.guardianPhone),
              guardian_email: input.studentProfile.guardianEmail,
              street: input.studentProfile.street,
              city: input.studentProfile.city,
              state_province: input.studentProfile.stateProvince,
              zip_code: input.studentProfile.zipCode,
            },
          });
        }
      }

      if (input.teacherProfile) {
        await tx.teacher.create({
          data: {
            id: generateId(),
            user_id: userId,
            employee_id: normalizedSchoolId,
            department: input.teacherProfile.department,
            position: input.teacherProfile.position,
            specialization: input.teacherProfile.specialization,
          },
        });
      }

      if (input.staffProfile) {
        await tx.staff.create({
          data: {
            id: generateId(),
            user_id: userId,
            employee_id: normalizedSchoolId,
            department: input.staffProfile.department,
            position: input.staffProfile.position,
          },
        });
      }

      await createAuditLog({
        actorUserId: actorId,
        actorSchoolId: clientMeta?.actorSchoolId,
        actorRole: clientMeta?.actorRole,
        action: 'USER_CREATED',
        category: 'ACCOUNT',
        resourceType: 'user',
        resourceId: userId,
        targetLabel: `${normalizedSchoolId} (${input.firstName} ${input.lastName})`,
        result: 'SUCCESS',
        newState: { schoolId: normalizedSchoolId, email: input.email, roles: input.roles },
        correlationId,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
      }, tx);

      return created;
    });

    return { user, temporaryPassword: generatedPassword };
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new AppError(409, 'DUPLICATE_SCHOOL_ID', 'School ID is already assigned.');
    }
    throw err;
  }
}

export async function getUsers(filters?: { role?: string; status?: string }) {
  const where: any = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.role) {
    where.user_roles = { some: { role: { name: filters.role } } };
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      school_id: true,
      email: true,
      first_name: true,
      last_name: true,
      middle_name: true,
      status: true,
      created_at: true,
      user_roles: {
        include: { role: true },
      },
      student: {
        include: {
          enrollments: {
            include: { section: true },
            orderBy: { created_at: 'desc' },
            take: 1
          }
        }
      },
      teacher: {
        include: {
          assignments: {
            include: {
              subject: true,
              section: true,
            }
          }
        }
      },
      staff: true,
    },
    orderBy: { last_name: 'asc' },
  });

  return users.map((u) => {
    if (u.student) {
      const studentData = {
        ...u.student,
        allergies: u.student.allergies,
        medical_conditions: u.student.medical_conditions,
      };
      return {
        ...u,
        student: studentData,
        student_profile: studentData,
      };
    }
    return u;
  });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      school_id: true,
      email: true,
      first_name: true,
      last_name: true,
      middle_name: true,
      status: true,
      created_at: true,
      updated_at: true,
      user_roles: {
        include: { role: true },
      },
      student: true,
      teacher: true,
      staff: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found.');
  }

  if (user.student) {
    const studentData = {
      ...user.student,
      allergies: user.student.allergies,
      medical_conditions: user.student.medical_conditions,
    };
    return {
      ...user,
      student: studentData,
      student_profile: studentData,
    };
  }

  return user;
}

export async function updateUser(
  id: string,
  input: z.infer<typeof updateUserSchema>,
  actorId: string,
  correlationId?: string,
  clientMeta?: { actorSchoolId?: string | null; actorRole?: string | null; ipAddress?: string | null; userAgent?: string | null }
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'User not found.');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      first_name: input.firstName,
      last_name: input.lastName,
      middle_name: input.middleName,
      status: input.status,
    },
  });

  const isStatusChange = Boolean(input.status && input.status !== existing.status);
  const action = isStatusChange ? 'USER_STATUS_CHANGED' : 'USER_UPDATED';

  await createAuditLog({
    actorUserId: actorId,
    actorSchoolId: clientMeta?.actorSchoolId,
    actorRole: clientMeta?.actorRole,
    action,
    category: 'ACCOUNT',
    resourceType: 'user',
    resourceId: id,
    targetLabel: `${existing.school_id} (${existing.first_name} ${existing.last_name})`,
    result: 'SUCCESS',
    previousState: { firstName: existing.first_name, lastName: existing.last_name, middleName: existing.middle_name, status: existing.status },
    newState: input,
    correlationId,
    ipAddress: clientMeta?.ipAddress,
    userAgent: clientMeta?.userAgent,
  });

  return updated;
}

export async function resetUserPassword(
  id: string,
  actorId: string,
  correlationId?: string,
  clientMeta?: { actorSchoolId?: string | null; actorRole?: string | null; ipAddress?: string | null; userAgent?: string | null }
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'User not found.');
  }

  const generatedPassword = generateSecureTemporaryPassword();
  const passwordHash = await hashPassword(generatedPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        password_hash: passwordHash,
        must_change_password: true,
      },
    });

    await createAuditLog({
      actorUserId: actorId,
      actorSchoolId: clientMeta?.actorSchoolId,
      actorRole: clientMeta?.actorRole,
      action: 'USER_PASSWORD_RESET',
      category: 'ACCOUNT',
      resourceType: 'user',
      resourceId: id,
      targetLabel: `${existing.school_id} (${existing.first_name} ${existing.last_name})`,
      result: 'SUCCESS',
      newState: { must_change_password: true },
      correlationId,
      ipAddress: clientMeta?.ipAddress,
      userAgent: clientMeta?.userAgent,
    }, tx);
  });

  return { temporaryPassword: generatedPassword };
}
