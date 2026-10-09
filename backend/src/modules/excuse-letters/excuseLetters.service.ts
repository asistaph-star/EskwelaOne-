import prisma from '../../config/database.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { generateId } from '../../common/utils/uuid.js';
import { createAuditLog } from '../../audit/audit.service.js';

export const excuseLettersService = {
  async getStudentExcuseLetters(studentId: string, authUser: any) {
    if (authUser.roles.includes('Student')) {
      const student = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!student || student.id !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own excuse letters.');
      }
    }

    return prisma.excuseLetter.findMany({
      where: { student_id: studentId },
      orderBy: { submitted_date: 'desc' }
    });
  },

  async createExcuseLetter(input: any, user: any, correlationId: string) {
    const student = await prisma.student.findUnique({
      where: { user_id: user.id }
    });

    if (!student) {
      throw new AppError(403, 'FORBIDDEN', 'Unauthorized: Only students can submit excuse letters.');
    }

    const currentAcademicYear = await prisma.academicYear.findFirst({ where: { is_current: true }});
    if (!currentAcademicYear) throw new AppError(400, 'BAD_REQUEST', 'No active academic year found.');

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        student_id: student.id,
        academic_year_id: currentAcademicYear.id,
        section: {
          assignments: {
            some: {
              teacher_id: input.teacherId
            }
          }
        }
      }
    });

    if (!enrollment) {
      throw new AppError(403, 'FORBIDDEN', 'Invalid teacher selected. The teacher must be assigned to your current section.');
    }

    if (new Date(input.endDate) < new Date(input.startDate)) {
      throw new AppError(400, 'BAD_REQUEST', 'End date cannot be before start date.');
    }

    const record = await prisma.excuseLetter.create({
      data: {
        id: generateId(),
        student_id: student.id,
        teacher_id: input.teacherId,
        start_date: new Date(input.startDate),
        end_date: new Date(input.endDate),
        reason: input.reason,
        status: 'Pending Review',
        document_id: input.documentId,
      }
    });

    await createAuditLog({
      actorUserId: user.id,
      action: 'EXCUSE_LETTER_CREATED',
      resourceType: 'excuse_letter',
      resourceId: record.id,
      newState: { teacherId: input.teacherId, startDate: input.startDate, endDate: input.endDate },
      correlationId,
    });

    return record;
  },

  async getTeacherExcuseLetters(user: any) {
    const teacher = await prisma.teacher.findUnique({
      where: { user_id: user.id }
    });

    if (!teacher) {
      throw new AppError(403, 'FORBIDDEN', 'Unauthorized: Only teachers can access this route.');
    }

    return prisma.excuseLetter.findMany({
      where: { teacher_id: teacher.id },
      include: {
        student: {
          include: {
            current_section: true,
            user: true
          }
        }
      },
      orderBy: { submitted_date: 'desc' }
    });
  },

  async updateExcuseLetterStatus(id: string, input: any, user: any, correlationId: string) {
    const teacher = await prisma.teacher.findUnique({
      where: { user_id: user.id }
    });

    if (!teacher) {
      throw new AppError(403, 'FORBIDDEN', 'Unauthorized: Only teachers can approve excuse letters.');
    }

    const excuse = await prisma.excuseLetter.findUnique({
      where: { id }
    });

    if (!excuse) {
      throw new AppError(404, 'NOT_FOUND', 'Excuse letter not found.');
    }

    if (excuse.teacher_id !== teacher.id) {
      throw new AppError(403, 'FORBIDDEN', 'Unauthorized: You can only update excuse letters assigned to you.');
    }

    const updated = await prisma.excuseLetter.update({
      where: { id },
      data: {
        status: input.status,
        teacher_note: input.teacherNote || null,
        reviewed_at: new Date()
      }
    });
    
    await createAuditLog({
      actorUserId: user.id,
      action: 'EXCUSE_LETTER_STATUS_UPDATED',
      resourceType: 'excuse_letter',
      resourceId: id,
      newState: { status: input.status, teacherNote: input.teacherNote },
      correlationId,
    });

    return updated;
  }
};
