import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/middleware/errorHandler.js';
const router = Router();
router.use(authMiddleware);

const parseTime = (timeStr?: string) => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  const hh = parts[0].padStart(2, '0');
  const mm = parts[1].padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  return new Date(`1970-01-01T${hh}:${mm}:${ss}.000Z`);
};

// ─── DTOs ──────────────────────────────────────────────────

const createGateAttendanceSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  timeIn: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be HH:mm or HH:mm:ss').optional(),
  timeOut: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be HH:mm or HH:mm:ss').optional(),
  status: z.enum(['Present', 'Absent', 'Late Arrival', 'Early Dismissal']),
});

const createClassAttendanceSchema = z.object({
  teacherSubjectAssignmentId: z.string().min(1),
  studentEnrollmentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  status: z.enum(['P', 'A', 'L', 'E']), // Present, Absent, Late, Excused
  remarks: z.string().optional(),
});

// ─── Routes ─────────────────────────────────────────────────

/**
 * POST /api/attendance/gate
 */
router.post('/gate', requirePermissions('attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createGateAttendanceSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    // Check if entry already exists for this date
    const existing = await prisma.gateAttendance.findUnique({
      where: {
        student_id_date: {
          student_id: input.studentId,
          date: new Date(input.date),
        }
      }
    });

    let entry;
    if (existing) {
      entry = await prisma.gateAttendance.update({
        where: { id: existing.id },
        data: {
          time_in: input.timeIn ? parseTime(input.timeIn) : existing.time_in,
          time_out: input.timeOut ? parseTime(input.timeOut) : existing.time_out,
          status: input.status,
        },
      });
      await createAuditLog({
        actorUserId: actorId,
        action: 'GATE_ATTENDANCE_UPDATED',
        resourceType: 'gate_attendance',
        resourceId: entry.id,
        newState: input,
        correlationId,
      });
    } else {
      entry = await prisma.gateAttendance.create({
        data: {
          id: generateId(),
          student_id: input.studentId,
          date: new Date(input.date),
          time_in: parseTime(input.timeIn),
          time_out: parseTime(input.timeOut),
          status: input.status,
        },
      });
      await createAuditLog({
        actorUserId: actorId,
        action: 'GATE_ATTENDANCE_CREATED',
        resourceType: 'gate_attendance',
        resourceId: entry.id,
        newState: input,
        correlationId,
      });
    }

    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/classes/:classId/records
 * Fetch all attendance records for a specific class (assignment) in the current academic year.
 */
router.get('/classes/:classId/records', requirePermissions('attendance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.params.classId as string;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    // 1. Enforce ownership: Does this teacher actually own this class assignment?
    const assignment = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: classId },
      include: { teacher: true }
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (assignment.teacher.user_id !== actorId) {
      const authUser = (req as any).user as AuthenticatedUser;
      if (!authUser.permissions.includes('attendance:read_all')) {
        return res.status(403).json({ success: false, message: 'You do not have permission to view attendance for this class.' });
      }
    }

    // 2. Fetch the records
    const records = await prisma.classAttendance.findMany({
      where: { assignment_id: classId },
      include: { enrollment: { include: { student: true } } }
    });

    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/classes/:classId/roster
 * Fetch all enrolled students for a specific class (assignment).
 */
router.get('/classes/:classId/roster', requirePermissions('attendance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.params.classId as string;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    // 1. Enforce ownership
    const assignment = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: classId },
      include: { teacher: true }
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (assignment.teacher.user_id !== actorId) {
      const authUser = (req as any).user as AuthenticatedUser;
      if (!authUser.permissions.includes('attendance:read_all')) {
        return res.status(403).json({ success: false, message: 'You do not have permission to view the roster for this class.' });
      }
    }

    // 2. Fetch enrollments for the section tied to this assignment
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

    const mapped = enrollments.map(e => ({
      id: e.id,
      student_id: e.student_id,
      student: {
        id: e.student.id,
        lrn: e.student.lrn,
        first_name: e.student.user.first_name,
        last_name: e.student.user.last_name
      }
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attendance/class
 */
router.post('/class', requirePermissions('attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createClassAttendanceSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    // LAYER 2: Ensure the teacher owns the assignment they are recording attendance for
    const assignment = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: input.teacherSubjectAssignmentId },
      include: { teacher: true }
    });

    if (!assignment) {
      throw new AppError(404, 'NOT_FOUND', 'Teacher assignment not found.');
    }

    if (assignment.teacher.user_id !== actorId) {
      // Check if they are an admin with override rights
      const authUser = (req as any).user as AuthenticatedUser;
      if (!authUser.permissions.includes('attendance:write_all')) {
         throw new AppError(403, 'FORBIDDEN', 'You cannot record attendance for a class you do not teach.');
      }
    }

    // LAYER 3: Verify the student belongs to that class through a valid enrollment
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

    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

const bulkClassAttendanceSchema = z.object({
  records: z.array(z.object({
    studentEnrollmentId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    status: z.enum(['P', 'A', 'L', 'E']),
    remarks: z.string().optional(),
  }))
});

/**
 * POST /api/attendance/classes/:classId/records/bulk
 */
router.post('/classes/:classId/records/bulk', requirePermissions('attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.params.classId as string;
    const input = bulkClassAttendanceSchema.parse(req.body);
    const actorId = ((req as any).user as AuthenticatedUser).id;

    // 1. Ownership check
    const assignment = await prisma.teacherSubjectAssignment.findUnique({
      where: { id: classId },
      include: { teacher: true }
    });

    if (!assignment) {
      throw new AppError(404, 'NOT_FOUND', 'Class not found.');
    }

    if ((assignment as any).teacher.user_id !== actorId) {
      const authUser = (req as any).user as AuthenticatedUser;
      if (!authUser.permissions.includes('attendance:write_all')) {
         throw new AppError(403, 'FORBIDDEN', 'You cannot record attendance for a class you do not teach.');
      }
    }

    // 1.5. Validate all enrollments belong to this class
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

    // 2. Perform upserts in a transaction
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
      newState: { count: results.length }
    });

    res.json({ success: true, count: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/gate/:studentId
 * Allows students or parents to fetch their gate attendance records
 */
router.get('/gate/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const studentId = req.params.studentId as string;
    
    if (authUser.roles.includes('Student')) {
      const student = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!student || student.id !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own gate attendance records.');
      }
    }
    
    const records = await prisma.gateAttendance.findMany({
      where: { student_id: studentId },
      orderBy: { date: 'desc' },
      take: 30 // Get last 30 days
    });
    
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/class/:studentId
 * Allows students to fetch their class attendance records
 */
router.get('/class/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const studentId = req.params.studentId as string;
    
    if (authUser.roles.includes('Student')) {
      const student = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!student || student.id !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own class attendance records.');
      }
    }
    
    const records = await prisma.classAttendance.findMany({
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
    
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

// ─── EXCUSE LETTERS ───────────────────────────────────────────

/**
 * GET /api/attendance/excuses/:studentId
 */
router.get('/excuses/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const studentId = req.params.studentId as string;

    if (authUser.roles.includes('Student')) {
      const student = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!student || student.id !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own excuse letters.');
      }
    }

    const records = await prisma.excuseLetter.findMany({
      where: { student_id: req.params.studentId as string },
      orderBy: { submitted_date: 'desc' }
    });
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

const createExcuseSchema = z.object({
  teacherId: z.string().min(1, 'Teacher selection is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string().min(5, 'Reason must be at least 5 characters long').max(1000),
  documentId: z.string().optional(),
});

/**
 * POST /api/attendance/excuses
 */
router.post('/excuses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createExcuseSchema.parse(req.body);
    const user = (req as any).user as AuthenticatedUser;

    const student = await prisma.student.findUnique({
      where: { user_id: user.id }
    });

    if (!student) {
      throw new AppError(403, 'FORBIDDEN', 'Unauthorized: Only students can submit excuse letters.');
    }

    const currentAcademicYear = await prisma.academicYear.findFirst({ where: { is_current: true }});
    if (!currentAcademicYear) throw new AppError(400, 'BAD_REQUEST', 'No active academic year found.');

    // Validate that the requested teacher is actually assigned to a section the student is enrolled in
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

    const correlationId = (req as any).correlationId;
    await createAuditLog({
      actorUserId: user.id,
      action: 'EXCUSE_LETTER_CREATED',
      resourceType: 'excuse_letter',
      resourceId: record.id,
      newState: { teacherId: input.teacherId, startDate: input.startDate, endDate: input.endDate },
      correlationId,
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/excuses/teacher/me
 * Allows a teacher to fetch all excuse letters submitted to them
 */
router.get('/excuses/teacher/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as AuthenticatedUser;
    
    const teacher = await prisma.teacher.findUnique({
      where: { user_id: user.id }
    });

    if (!teacher) {
      throw new AppError(403, 'FORBIDDEN', 'Unauthorized: Only teachers can access this route.');
    }

    const records = await prisma.excuseLetter.findMany({
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
    
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

const patchExcuseStatusSchema = z.object({
  status: z.enum(['Pending Review', 'Approved', 'Rejected']),
  teacherNote: z.string().optional()
});

/**
 * PATCH /api/attendance/excuses/:id/status
 * Allows a teacher to approve or reject an excuse letter
 */
router.patch('/excuses/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const input = patchExcuseStatusSchema.parse(req.body);
    const user = (req as any).user as AuthenticatedUser;
    
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
    
    const correlationId = (req as any).correlationId;
    await createAuditLog({
      actorUserId: user.id,
      action: 'EXCUSE_LETTER_STATUS_UPDATED',
      resourceType: 'excuse_letter',
      resourceId: id,
      newState: { status: input.status, teacherNote: input.teacherNote },
      correlationId,
    });
    
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
