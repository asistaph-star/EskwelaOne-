import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../../common/middleware/auth.js';
import { createGuidanceSchema } from './guidance.schema.js';
import { GuidanceService } from './guidance.service.js';

const router = Router();
router.use(authMiddleware);

router.get('/', requirePermissions('guidance:read'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await GuidanceService.getGuidanceRecords();
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

router.get('/:studentId', requirePermissions('guidance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await GuidanceService.getGuidanceRecordsByStudentId(req.params.studentId as string);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermissions('guidance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createGuidanceSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const record = await GuidanceService.createGuidanceRecord(input, authUser.id, correlationId);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requirePermissions('guidance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const { status } = req.body;
    const recordId = req.params.id as string;
    const correlationId = (req as any).correlationId;

    const record = await GuidanceService.updateGuidanceRecordStatus(recordId, status, authUser.id, authUser.roles, correlationId);
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

export default router;
