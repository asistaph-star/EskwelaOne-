import prisma from '../../config/database.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { generateId } from '../../common/utils/uuid.js';
import { createAuditLog } from '../../audit/audit.service.js';

export const classAttendanceService = {
  async getClassRecords(classId: string, actorId: string, authUser: any) {
    const assignment = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: classId },
      include: { teacher: true }
    });

    if (!assignment) {
      throw new AppError(404, 'NOT_FOUND', 'Class not found');
    }

    if (assignment.teacher.user_id !== actorId) {
      if (!authUser.permissions.includes('attendance:read_all')) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view attendance for this class.');
      }
    }

    return prisma.classAttendance.findMany({
      where: { assignment_id: classId },
      include: { enrollment: { include: { student: true } } }
    });
  },

  async getClassRoster(classId: string, actorId: string, authUser: any) {
    const assignment = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: classId },
      include: { teacher: true }
    });

    if (!assignment) {
      throw new AppError(404, 'NOT_FOUND', 'Class not found');
    }

    if (assignment.teacher.user_id !== actorId) {
      if (!authUser.permissions.includes('attendance:read_all')) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view the roster for this class.');
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { 
        section_id: assignment.section_id,
        academic_year_id: assignment.academic_year_id,
        status: 'Enrolled'
      },
      include: { student: { include: { user: true } } },
      orderBy: [
        { student: { user: { last_name: 'asc' } } },
        { student: { user: { first_name: 'asc' } } }
      ]
    });

    return enrollments.map(e => ({
      id: e.id,
      student_id: e.student_id,
      student: {
        id: e.student.id,
        lrn: e.student.lrn,
        first_name: e.student.user.first_name,
        last_name: e.student.user.last_name
      }
    }));
  },

  async recordClassAttendance(input: any, actorId: string, authUser: any, correlationId: string) {
    const assignment = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: input.teacherSubjectAssignmentId },
      include: { teacher: true }
    });

    if (!assignment) {
      throw new AppError(404, 'NOT_FOUND', 'Teacher assignment not found.');
    }

    if (assignment.teacher.user_id !== actorId) {
      if (!authUser.permissions.includes('attendance:write_all')) {
         throw new AppError(403, 'FORBIDDEN', 'You cannot record attendance for a class you do not teach.');
      }
    }

    const validEnrollment = await prisma.enrollment.findFirst({
      where: {
        id: input.studentEnrollmentId,
        section_id: assignment.section_id,
        academic_year_id: assignment.academic_year_id,
        status: 'Enrolled'
      }
    });

    if (!validEnrollment) {
      throw new AppError(400, 'BAD_REQUEST', 'Student enrollment is not valid for this class.');
    }

    const existing = await prisma.classAttendance.findUnique({
      where: {
        assignment_id_enrollment_id_date: {
          assignment_id: input.teacherSubjectAssignmentId,
          enrollment_id: input.studentEnrollmentId,
          date: new Date(input.date),
        }
      }
    });

    let entry;
    if (existing) {
       entry = await prisma.classAttendance.update({
         where: { id: existing.id },
         data: {
           status: input.status,
           remarks: input.remarks,
         }
       });
    } else {
      entry = await prisma.classAttendance.create({
        data: {
          id: generateId(),
          assignment_id: input.teacherSubjectAssignmentId,
          enrollment_id: input.studentEnrollmentId,
          date: new Date(input.date),
          status: input.status,
          remarks: input.remarks,
        }
      });
    }

    await createAuditLog({
      actorUserId: actorId,
      action: existing ? 'CLASS_ATTENDANCE_UPDATED' : 'CLASS_ATTENDANCE_CREATED',
      resourceType: 'class_attendance',
      resourceId: entry.id,
      newState: input,
      correlationId,
    });

    return entry;
  },

  async bulkRecordClassAttendance(classId: string, input: any, actorId: string, authUser: any, correlationId: string) {
    const assignment = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: classId },
      include: { teacher: true }
    });

    if (!assignment) {
      throw new AppError(404, 'NOT_FOUND', 'Class not found.');
    }

    if (assignment.teacher.user_id !== actorId) {
      if (!authUser.permissions.includes('attendance:write_all')) {
         throw new AppError(403, 'FORBIDDEN', 'You cannot record attendance for a class you do not teach.');
      }
    }

    const validEnrollments = await prisma.enrollment.findMany({
      where: {
        section_id: assignment.section_id,
        academic_year_id: assignment.academic_year_id,
        status: 'Enrolled'
      },
      select: { id: true }
    });
    const validIds = new Set(validEnrollments.map(e => e.id));
    
    for (const rec of input.records) {
      if (!validIds.has(rec.studentEnrollmentId)) {
        throw new AppError(400, 'BAD_REQUEST', `Student enrollment ${rec.studentEnrollmentId} is not valid for this class.`);
      }
    }

    const results = await prisma.$transaction(async (tx) => {
      const updated = [];
      for (const rec of input.records) {
        const dateObj = new Date(rec.date);
        const existing = await tx.classAttendance.findUnique({
          where: {
            assignment_id_enrollment_id_date: {
              assignment_id: classId,
              enrollment_id: rec.studentEnrollmentId,
              date: dateObj,
            }
          }
        });
        
        if (existing) {
          updated.push(await tx.classAttendance.update({
            where: { id: existing.id },
            data: { status: rec.status, remarks: rec.remarks }
          }));
        } else {
          updated.push(await tx.classAttendance.create({
            data: {
              id: generateId(),
              assignment_id: classId,
              enrollment_id: rec.studentEnrollmentId,
              date: dateObj,
              status: rec.status,
              remarks: rec.remarks
            }
          }));
        }
      }
      return updated;
    });

    await createAuditLog({
      actorUserId: actorId,
      action: 'CLASS_ATTENDANCE_BULK_UPDATED',
      resourceType: 'class_attendance',
      resourceId: classId,
      newState: { count: results.length },
      correlationId
    });

    return results;
  },

  async getStudentClassAttendance(studentId: string, authUser: any) {
    if (authUser.roles.includes('Student')) {
      const student = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!student || student.id !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own class attendance records.');
      }
    }
    
    return prisma.classAttendance.findMany({
      where: {
        enrollment: {
          student_id: studentId
        }
      },
      include: {
        assignment: {
          include: {
            subject: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 50
    });
  }
};
