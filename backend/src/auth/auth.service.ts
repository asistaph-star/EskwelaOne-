import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { config } from '../config/env.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';

const SALT_ROUNDS = 12;

export const loginSchema = z.object({
  schoolId: z.string().min(1, 'School ID is required.').optional(),
  email: z.string().optional(),
  password: z.string().min(1, 'Password is required.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Authenticate a user with School ID + password.
 * Returns a JWT token and user info on success.
 * 
 * Never reveals whether the School ID exists to prevent enumeration.
 * EMAIL MUST NOT BE ACCEPTED AS A LOGIN IDENTIFIER.
 */
export async function login(
  input: LoginInput,
  correlationId?: string,
  clientMeta?: { ipAddress?: string | null; userAgent?: string | null }
) {
  // Reject email or missing schoolId
  if (input.email || !input.schoolId) {
    await createAuditLog({
      action: 'LOGIN_FAILURE',
      category: 'AUTHENTICATION',
      resourceType: 'auth',
      targetLabel: input.email ? '[EMAIL_REJECTED]' : input.schoolId || 'unspecified',
      result: 'FAILURE',
      reason: input.email ? 'Email login attempted but rejected' : 'Missing schoolId',
      correlationId,
      ipAddress: clientMeta?.ipAddress,
      userAgent: clientMeta?.userAgent,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  const trimmedSchoolId = input.schoolId.trim();

  const user = await prisma.user.findFirst({
    where: {
      school_id: {
        equals: trimmedSchoolId,
        mode: 'insensitive',
      },
    },
    include: {
      user_roles: {
        include: {
          role: {
            include: {
              role_permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
      student: true,
      teacher: true,
      staff: true,
    },
  });

  if (!user) {
    await createAuditLog({
      action: 'LOGIN_FAILURE',
      category: 'AUTHENTICATION',
      resourceType: 'auth',
      actorSchoolId: trimmedSchoolId,
      targetLabel: trimmedSchoolId,
      result: 'FAILURE',
      reason: 'Unknown school_id',
      correlationId,
      ipAddress: clientMeta?.ipAddress,
      userAgent: clientMeta?.userAgent,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  if (user.status !== 'active') {
    await createAuditLog({
      actorUserId: user.id,
      actorSchoolId: user.school_id,
      actorRole: user.user_roles[0]?.role?.name || null,
      action: 'LOGIN_FAILURE',
      category: 'AUTHENTICATION',
      resourceType: 'auth',
      targetLabel: user.school_id,
      result: 'FAILURE',
      reason: 'Account inactive',
      correlationId,
      ipAddress: clientMeta?.ipAddress,
      userAgent: clientMeta?.userAgent,
    });
    throw new AppError(401, 'ACCOUNT_INACTIVE', 'Your account has been deactivated. Please contact the administrator.');
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    await createAuditLog({
      actorUserId: user.id,
      actorSchoolId: user.school_id,
      actorRole: user.user_roles[0]?.role?.name || null,
      action: 'LOGIN_FAILURE',
      category: 'AUTHENTICATION',
      resourceType: 'auth',
      targetLabel: user.school_id,
      result: 'FAILURE',
      reason: 'Invalid password',
      correlationId,
      ipAddress: clientMeta?.ipAddress,
      userAgent: clientMeta?.userAgent,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  // Build permissions set
  const permissions = new Set<string>();
  const roles: string[] = [];
  for (const ur of user.user_roles) {
    roles.push(ur.role.name);
    for (const rp of ur.role.role_permissions) {
      permissions.add(rp.permission.key);
    }
  }

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as any },
  );

  await createAuditLog({
    actorUserId: user.id,
    actorSchoolId: user.school_id,
    actorRole: roles[0] || 'User',
    action: 'LOGIN_SUCCESS',
    category: 'AUTHENTICATION',
    resourceType: 'auth',
    targetLabel: `${user.school_id} (${user.first_name} ${user.last_name})`,
    result: 'SUCCESS',
    correlationId,
    ipAddress: clientMeta?.ipAddress,
    userAgent: clientMeta?.userAgent,
  });

  return {
    token,
    user: {
      id: user.id,
      schoolId: user.school_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      middleName: user.middle_name,
      roles,
      permissions: Array.from(permissions),
      mustChangePassword: user.must_change_password,
      studentProfile: user.student ? {
        id: user.student.id,
        studentNumber: user.student.student_number,
        lrn: user.student.lrn,
        gradeLevel: user.student.grade_level,
      } : null,
      teacherProfile: user.teacher ? {
        id: user.teacher.id,
        employeeId: user.teacher.employee_id,
        position: user.teacher.position,
      } : null,
      staffProfile: user.staff ? {
        id: user.staff.id,
        employeeId: user.staff.employee_id,
        position: user.staff.position,
      } : null,
    },
  };
}

/**
 * Hash a password for storage.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Get the current authenticated user's full profile.
 */
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      user_roles: {
        include: {
          role: {
            include: {
              role_permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
      student: true,
      teacher: true,
      staff: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found.');
  }

  const permissions = new Set<string>();
  const roles: string[] = [];
  for (const ur of user.user_roles) {
    roles.push(ur.role.name);
    for (const rp of ur.role.role_permissions) {
      permissions.add(rp.permission.key);
    }
  }

  return {
    id: user.id,
    schoolId: user.school_id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    middleName: user.middle_name,
    status: user.status,
    roles,
    permissions: Array.from(permissions),
    mustChangePassword: user.must_change_password,
    studentProfile: user.student ? {
      id: user.student.id,
      studentNumber: user.student.student_number,
      lrn: user.student.lrn,
      gradeLevel: user.student.grade_level,
      gender: user.student.gender,
    } : null,
    teacherProfile: user.teacher ? {
      id: user.teacher.id,
      employeeId: user.teacher.employee_id,
      position: user.teacher.position,
      department: user.teacher.department,
      specialization: user.teacher.specialization,
    } : null,
    staffProfile: user.staff ? {
      id: user.staff.id,
      employeeId: user.staff.employee_id,
      position: user.staff.position,
      department: user.staff.department,
    } : null,
  };
}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
  confirmPassword: z.string().min(1, 'Please confirm your new password.'),
});

export async function changePassword(
  userId: string,
  input: z.infer<typeof changePasswordSchema>,
  correlationId?: string,
  clientMeta?: { ipAddress?: string | null; userAgent?: string | null; actorSchoolId?: string | null; actorRole?: string | null }
) {
  if (input.newPassword !== input.confirmPassword) {
    throw new AppError(400, 'PASSWORD_MISMATCH', 'Passwords do not match.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found.');
  }

  const isValid = await bcrypt.compare(input.currentPassword, user.password_hash);
  if (!isValid) {
    await createAuditLog({
      actorUserId: user.id,
      actorSchoolId: clientMeta?.actorSchoolId || user.school_id,
      actorRole: clientMeta?.actorRole,
      action: 'PASSWORD_CHANGE_FAILED',
      category: 'AUTHENTICATION',
      resourceType: 'auth',
      resourceId: userId,
      targetLabel: user.school_id,
      result: 'FAILURE',
      reason: 'Current password incorrect',
      correlationId,
      ipAddress: clientMeta?.ipAddress,
      userAgent: clientMeta?.userAgent,
    });
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
  }

  const newHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        password_hash: newHash,
        must_change_password: false,
      },
    });

    await createAuditLog({
      actorUserId: userId,
      actorSchoolId: clientMeta?.actorSchoolId || user.school_id,
      actorRole: clientMeta?.actorRole,
      action: 'PASSWORD_CHANGED',
      category: 'AUTHENTICATION',
      resourceType: 'auth',
      resourceId: userId,
      targetLabel: user.school_id,
      result: 'SUCCESS',
      newState: { must_change_password: false },
      correlationId,
      ipAddress: clientMeta?.ipAddress,
      userAgent: clientMeta?.userAgent,
    }, tx);
  });

  return { success: true, message: 'Password changed successfully.' };
}

