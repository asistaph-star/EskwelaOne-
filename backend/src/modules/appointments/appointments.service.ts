import prisma from '../../config/database.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { generateId } from '../../common/utils/uuid.js';
import { createAuditLog } from '../../audit/audit.service.js';

const parseTime = (timeStr?: string) => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  const hh = parts[0].padStart(2, '0');
  const mm = parts[1].padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  return new Date(`1970-01-01T${hh}:${mm}:${ss}.000Z`);
};

export const AppointmentsService = {
  async getMyOwnAppointments(authUserId: string, roles: string[]) {
    if (!roles.includes('Teacher') && !roles.includes('Admin') && !roles.includes('Guidance')) {
       throw new AppError(403, 'FORBIDDEN', 'Only teachers, guidance, and admins can access this endpoint.');
    }

    if (roles.includes('Teacher')) {
      const teacher = await prisma.teacher.findUnique({ where: { user_id: authUserId } });
      if (!teacher) throw new AppError(403, 'FORBIDDEN', 'Teacher profile not found.');
      return prisma.appointment.findMany({
        where: { teacher_id: teacher.id },
        include: { student: { include: { user: true } }, teacher: { include: { user: true } } },
        orderBy: { date: 'desc' }
      });
    } else if (roles.includes('Guidance')) {
      const staff = await prisma.staff.findUnique({ where: { user_id: authUserId } });
      if (!staff) throw new AppError(403, 'FORBIDDEN', 'Staff profile not found.');
      return prisma.appointment.findMany({
        where: { staff_id: staff.id },
        include: { student: { include: { user: true } }, staff: { include: { user: true } } },
        orderBy: { date: 'desc' }
      });
    } else {
      throw new AppError(403, 'FORBIDDEN', 'You must have a Teacher or Staff profile.');
    }
  },

  async getAppointmentsForAuthorizedStudents(authUserId: string, roles: string[]) {
    if (!roles.includes('Teacher')) {
       throw new AppError(403, 'FORBIDDEN', 'Only teachers can access this endpoint.');
    }

    return prisma.student.findMany({
      where: {
        current_section: {
          assignments: {
            some: { teacher: { user_id: authUserId } }
          }
        }
      },
      include: {
        user: true,
        current_section: true
      },
      distinct: ['id']
    });
  },

  async getAppointmentsByStudentId(studentId: string, authUserId: string, roles: string[]) {
    if (roles.includes('Student')) {
      const student = await prisma.student.findUnique({ where: { user_id: authUserId } });
      if (!student || student.id !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own appointments.');
      }
    }

    return prisma.appointment.findMany({
      where: { student_id: studentId },
      include: { 
        teacher: { include: { user: true } },
        staff: { include: { user: true } },
        student: { include: { user: true } }
      }, 
      orderBy: { date: 'desc' }
    });
  },

  async createAppointment(input: any, authUserId: string, roles: string[], correlationId?: string) {
    let resolvedStudentId = input.studentId;
    let resolvedTeacherId = input.teacherId;
    let resolvedStaffId = input.staffId;
    let direction = 'parent-to-teacher';

    if (roles.includes('Student')) {
      const student = await prisma.student.findUnique({ where: { user_id: authUserId } });
      if (!student) throw new AppError(403, 'FORBIDDEN', 'Student profile not found.');
      resolvedStudentId = student.id;
      if (!resolvedTeacherId && !resolvedStaffId) throw new AppError(400, 'BAD_REQUEST', 'teacherId or staffId is required.');
      if (resolvedTeacherId && resolvedStaffId) throw new AppError(400, 'BAD_REQUEST', 'Cannot specify both teacherId and staffId.');
      direction = resolvedStaffId ? 'parent-to-counselor' : 'parent-to-teacher';
    } else if (roles.includes('Teacher')) {
      const teacher = await prisma.teacher.findUnique({ where: { user_id: authUserId } });
      if (!teacher) throw new AppError(403, 'FORBIDDEN', 'Teacher profile not found.');
      resolvedTeacherId = teacher.id;
      resolvedStaffId = undefined; // Override client spoofing
      if (!resolvedStudentId) throw new AppError(400, 'BAD_REQUEST', 'studentId is required.');
      direction = 'teacher-to-parent';

      const authorizedStudent = await prisma.student.findFirst({
        where: {
          id: resolvedStudentId,
          current_section: {
            assignments: { some: { teacher_id: teacher.id } }
          }
        }
      });
      if (!authorizedStudent) throw new AppError(403, 'FORBIDDEN', 'Not authorized to create appointment for this student.');
    } else if (roles.includes('Guidance')) {
      const staff = await prisma.staff.findUnique({ where: { user_id: authUserId } });
      if (!staff) throw new AppError(403, 'FORBIDDEN', 'Staff profile not found.');
      resolvedStaffId = staff.id;
      resolvedTeacherId = undefined; // Override client spoofing
      if (!resolvedStudentId) throw new AppError(400, 'BAD_REQUEST', 'studentId is required.');
      direction = 'counselor-to-parent';
    } else {
      if (!resolvedStudentId || (!resolvedTeacherId && !resolvedStaffId) || (resolvedTeacherId && resolvedStaffId)) {
        throw new AppError(400, 'BAD_REQUEST', 'studentId and exactly one of teacherId or staffId are required.');
      }
    }

    const record = await prisma.appointment.create({
      data: {
        id: generateId(),
        student_id: resolvedStudentId!,
        teacher_id: resolvedTeacherId || null,
        staff_id: resolvedStaffId || null,
        date: new Date(input.date),
        time: parseTime(input.time)!,
        purpose: input.purpose,
        parent_email: input.parentEmail,
        direction: direction,
        status: 'Pending'
      }
    });

    await createAuditLog({
      actorUserId: authUserId,
      action: 'APPOINTMENT_CREATED',
      resourceType: 'appointment',
      resourceId: record.id,
      newState: { studentId: resolvedStudentId, teacherId: resolvedTeacherId, staffId: resolvedStaffId, date: input.date, time: input.time },
      correlationId,
    });

    return record;
  },

  async updateAppointmentStatus(recordId: string, status: string, authUserId: string, roles: string[], correlationId?: string) {
    const existing = await prisma.appointment.findUnique({ 
      where: { id: recordId },
      include: { student: true, teacher: true } 
    });
    
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Appointment not found.');
    }

    const isGlobalViewer = roles.some(r => ['Admin', 'Principal'].includes(r));
    if (!isGlobalViewer) {
      if (roles.includes('Teacher')) {
        const teacher = await prisma.teacher.findUnique({ where: { user_id: authUserId } });
        if (!teacher || existing.teacher_id !== teacher.id) {
          throw new AppError(403, 'FORBIDDEN', 'You can only update your own appointments.');
        }
      } else if (roles.includes('Guidance')) {
        const staff = await prisma.staff.findUnique({ where: { user_id: authUserId } });
        if (!staff || existing.staff_id !== staff.id) {
          throw new AppError(403, 'FORBIDDEN', 'You can only update your own appointments.');
        }
      } else if (roles.includes('Student')) {
        const student = await prisma.student.findUnique({ where: { user_id: authUserId } });
        if (!student || existing.student_id !== student.id) {
          throw new AppError(403, 'FORBIDDEN', 'You can only update your own appointments.');
        }
      } else {
        throw new AppError(403, 'FORBIDDEN', 'Unauthorized role.');
      }
    }

    const record = await prisma.appointment.update({
      where: { id: recordId },
      data: { status }
    });

    await createAuditLog({
      actorUserId: authUserId,
      action: 'APPOINTMENT_STATUS_UPDATED',
      resourceType: 'appointment',
      resourceId: record.id,
      previousState: { status: existing.status },
      newState: { status: record.status },
      correlationId,
    });

    return record;
  }
};
