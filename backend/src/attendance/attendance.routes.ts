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

/**
 * GET /api/attendance/gate/:studentId
 * Allows students or parents to fetch their gate attendance records
 */
router.get('/gate/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const studentId = req.params.studentId as string;
    
    // In a full implementation, check if the authenticated user IS the student, parent, or has read_all permissions
    
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
    
    // Check permissions...
    
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
  studentId: z.string(),
  studentName: z.string(),
  teacherId: z.string(),
  teacherName: z.string(),
  section: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string(),
  documentId: z.string().optional(),
  documentName: z.string().optional(),
  documentType: z.string().optional(),
  documentSize: z.number().optional(),
});

/**
 * POST /api/attendance/excuses
 */
router.post('/excuses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createExcuseSchema.parse(req.body);
    const actorId = ((req as any).user as AuthenticatedUser).id;

    const record = await prisma.excuseLetter.create({
      data: {
        id: generateId(),
        student_id: input.studentId,
        teacher_id: input.teacherId,
        start_date: new Date(input.startDate),
        end_date: new Date(input.endDate),
        reason: input.reason,
        document_id: input.documentId,
        status: 'Pending Review'
      }
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

export default router;
