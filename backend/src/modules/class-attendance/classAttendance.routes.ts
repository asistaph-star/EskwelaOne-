import { Router, Request, Response, NextFunction } from 'express';
import { requirePermissions, AuthenticatedUser } from '../../common/middleware/auth.js';
import { createClassAttendanceSchema, bulkClassAttendanceSchema } from './classAttendance.schema.js';
import { classAttendanceService } from './classAttendance.service.js';

const router = Router();

/**
 * GET /api/attendance/class/:studentId
 * Allows students to fetch their class attendance records
 */
router.get('/class/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const studentId = req.params.studentId as string;
    const records = await classAttendanceService.getStudentClassAttendance(studentId, authUser);
    res.json({ success: true, data: records });
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
    const authUser = (req as any).user as AuthenticatedUser;
    const actorId = authUser.id;
    
    const entry = await classAttendanceService.recordClassAttendance(input, actorId, authUser, correlationId);
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
    const authUser = (req as any).user as AuthenticatedUser;
    const actorId = authUser.id;

    const records = await classAttendanceService.getClassRecords(classId, actorId, authUser);
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
    const authUser = (req as any).user as AuthenticatedUser;
    const actorId = authUser.id;

    const roster = await classAttendanceService.getClassRoster(classId, actorId, authUser);
    res.json({ success: true, data: roster });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attendance/classes/:classId/records/bulk
 */
router.post('/classes/:classId/records/bulk', requirePermissions('attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.params.classId as string;
    const input = bulkClassAttendanceSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const authUser = (req as any).user as AuthenticatedUser;
    const actorId = authUser.id;

    const results = await classAttendanceService.bulkRecordClassAttendance(classId, input, actorId, authUser, correlationId);
    res.json({ success: true, count: results.length });
  } catch (err) {
    next(err);
  }
});

export default router;
