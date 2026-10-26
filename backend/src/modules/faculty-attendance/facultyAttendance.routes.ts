import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../../common/middleware/auth.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { facultyAttendanceService } from './facultyAttendance.service.js';
import { emitFacultyAttendanceChanged } from '../../attendance/attendanceBroadcaster.service.js';
import {
  timeInInputSchema,
  timeOutInputSchema,
  adminCorrectionSchema,
  queryFacultyAttendanceSchema,
} from './facultyAttendance.types.js';

const router = Router();
router.use(authMiddleware);

// ─── Middleware: Guard Teacher Role for Self-Service ──────────────────────────
function requireTeacherRole(req: Request, _res: Response, next: NextFunction): void {
  const user = (req as any).user as AuthenticatedUser;
  if (!user || !user.roles.includes('Teacher')) {
    next(new AppError(403, 'FORBIDDEN', 'Teacher self-service access requires the Teacher role.'));
    return;
  }
  next();
}

/**
 * POST /api/attendance/faculty/time-in
 * Teacher self-service daily Time In.
 */
router.post('/time-in', requireTeacherRole, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = timeInInputSchema.parse(req.body || {});
    const user = (req as any).user as AuthenticatedUser;
    const result = await facultyAttendanceService.recordTimeIn(user.id, input.remarks);
    emitFacultyAttendanceChanged();
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attendance/faculty/time-out
 * Teacher self-service daily Time Out.
 */
router.post('/time-out', requireTeacherRole, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = timeOutInputSchema.parse(req.body || {});
    const user = (req as any).user as AuthenticatedUser;
    const result = await facultyAttendanceService.recordTimeOut(user.id, input.remarks);
    emitFacultyAttendanceChanged();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/faculty/me
 * Fetches punch card status for the authenticated teacher.
 */
router.get('/me', requireTeacherRole, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as AuthenticatedUser;
    const queryDate = req.query.date as string | undefined;
    const result = await facultyAttendanceService.getTeacherStatusToday(user.id, queryDate);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/faculty/summary
 * Executive summary for Principal Dashboard (PRIN-003).
 */
router.get('/summary', requirePermissions('faculty_attendance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryDate = req.query.date as string | undefined;
    const summary = await facultyAttendanceService.getSummary(queryDate);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/faculty
 * Full operational table for Principal Teacher Management (PRIN-014).
 */
router.get('/', requirePermissions('faculty_attendance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = queryFacultyAttendanceSchema.parse(req.query);
    const result = await facultyAttendanceService.getList(query);
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/attendance/faculty/:id
 * Administrative correction (Admin / ITAdmin Only).
 */
router.patch('/:id', requirePermissions('faculty_attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = adminCorrectionSchema.parse(req.body);
    const user = (req as any).user as AuthenticatedUser;
    const id = req.params.id as string;
    const correlationId = (req as any).correlationId;
    const updated = await facultyAttendanceService.adminCorrection(id, input, user.id, correlationId);
    emitFacultyAttendanceChanged();
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
