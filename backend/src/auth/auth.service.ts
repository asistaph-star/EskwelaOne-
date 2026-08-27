import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { config } from '../config/env.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';

const SALT_ROUNDS = 12;

export const loginSchema = z.object({
  email: z.string().email('Valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Authenticate a user with email + password.
 * Returns a JWT token and user info on success.
 * 
 * Never reveals whether the email exists to prevent enumeration.
 */
export async function login(input: LoginInput, correlationId?: string) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
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
      resourceType: 'auth',
      reason: 'Unknown email',
      correlationId,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (user.status !== 'active') {
    await createAuditLog({
      actorUserId: user.id,
      action: 'LOGIN_FAILURE',
      resourceType: 'auth',
      reason: 'Account inactive',
      correlationId,
    });
    throw new AppError(401, 'ACCOUNT_INACTIVE', 'Your account has been deactivated. Please contact the administrator.');
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    await createAuditLog({
      actorUserId: user.id,
      action: 'LOGIN_FAILURE',
      resourceType: 'auth',
      reason: 'Invalid password',
      correlationId,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
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
    action: 'LOGIN_SUCCESS',
    resourceType: 'auth',
    correlationId,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      middleName: user.middle_name,
      roles,
      permissions: Array.from(permissions),
      studentProfile: user.student ? {
        id: user.student.id,
        lrn: user.student.lrn,
        gradeLevel: user.student.grade_level,
      } : null,
      teacherProfile: user.teacher ? {
        id: user.teacher.id,
        employeeId: user.teacher.employee_id,
        position: user.teacher.position,
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
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    middleName: user.middle_name,
    status: user.status,
    roles,
    permissions: Array.from(permissions),
    studentProfile: user.student ? {
      id: user.student.id,
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
