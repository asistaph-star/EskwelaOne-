import { Router, Request, Response, NextFunction } from 'express';
import { requirePermissions, AuthenticatedUser } from '../../common/middleware/auth.js';
import { ClinicRecordsService } from './clinicRecords.service.js';
import { createClinicRecordSchema } from './clinicRecords.schema.js';

const router = Router();

/**
 * GET /api/student-services/clinic
 * Returns global clinic records (recent 100). Nurse dashboard.
 */
router.get('/', requirePermissions('clinic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await ClinicRecordsService.getRecentRecords();
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/student-services/clinic
 */
router.post('/', requirePermissions('clinic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createClinicRecordSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    const record = await ClinicRecordsService.createRecord(input, actorId, correlationId);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/student-services/clinic/:studentId
 * Strict isolation: Clinic records must not be exposed to general staff.
 * Note: When mounting, ensure this route is mounted AFTER /clinic/inventory
 * to prevent :studentId from capturing the "inventory" literal.
 */
router.get('/:studentId', requirePermissions('clinic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as AuthenticatedUser;
    const records = await ClinicRecordsService.getRecordsForStudent(req.params.studentId as string, user.id, user.roles);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

export default router;
