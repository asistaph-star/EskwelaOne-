import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { hashPassword } from '../auth/auth.service.js';
import { createAuditLog } from '../audit/audit.service.js';

// ─── DTOs ──────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.').optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  roles: z.array(z.string()).min(1, 'At least one role is required.'),
  // Optional profile fields
  studentProfile: z.object({
    lrn: z.string().min(1),
    gradeLevel: z.number().int().min(7).max(12),
    gender: z.string().optional(),
    guardianFirstName: z.string().optional(),
    guardianLastName: z.string().optional(),
    guardianPhone: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    stateProvince: z.string().optional(),
    zipCode: z.string().optional(),
  }).optional(),
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
  middleName: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

// ─── SERVICE ───────────────────────────────────────────────

export async function createUser(
  input: z.infer<typeof createUserSchema>,
  actorId: string,
  correlationId?: string,
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

  const userId = generateId();
  const generatedPassword = input.password ? null : crypto.randomBytes(4).toString('hex'); // 8 chars
  const finalPassword = input.password || generatedPassword!;
  const passwordHash = await hashPassword(finalPassword);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        id: userId,
        email: input.email,
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

    // Create profile if specified
    if (input.studentProfile) {
      await tx.student.create({
        data: {
          id: generateId(),
          user_id: userId,
          lrn: input.studentProfile.lrn,
          grade_level: input.studentProfile.gradeLevel,
          gender: input.studentProfile.gender,
          guardian_first_name: input.studentProfile.guardianFirstName,
          guardian_last_name: input.studentProfile.guardianLastName,
          guardian_phone: input.studentProfile.guardianPhone,
          street: input.studentProfile.street,
          city: input.studentProfile.city,
          state_province: input.studentProfile.stateProvince,
          zip_code: input.studentProfile.zipCode,
        },
      });
    }

    if (input.teacherProfile) {
      await tx.teacher.create({
        data: {
          id: generateId(),
          user_id: userId,
          employee_id: input.teacherProfile.employeeId,
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
          employee_id: input.staffProfile.employeeId,
          department: input.staffProfile.department,
          position: input.staffProfile.position,
        },
      });
    }

    await createAuditLog({
      actorUserId: actorId,
      action: 'USER_CREATED',
      resourceType: 'user',
      resourceId: userId,
      newState: { email: input.email, roles: input.roles },
      correlationId,
    }, tx);

    return created;
  });

  return { user, temporaryPassword: generatedPassword };
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
      teacher: true,
      staff: true,
    },
    orderBy: { last_name: 'asc' },
  });

  return users.map((u) => {
    if (u.student) {
      return {
        ...u,
        student: {
          ...u.student,
          allergies: u.student.allergies,
          medical_conditions: u.student.medical_conditions,
        },
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
    return {
      ...user,
      student: {
        ...user.student,
        allergies: user.student.allergies,
        medical_conditions: user.student.medical_conditions,
      },
    };
  }

  return user;
}

export async function updateUser(
  id: string,
  input: z.infer<typeof updateUserSchema>,
  actorId: string,
  correlationId?: string,
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

  await createAuditLog({
    actorUserId: actorId,
    action: 'USER_UPDATED',
    resourceType: 'user',
    resourceId: id,
    previousState: { firstName: existing.first_name, lastName: existing.last_name, status: existing.status },
    newState: input,
    correlationId,
  });

  return updated;
}
