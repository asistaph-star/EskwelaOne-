import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../../common/middleware/auth.js';
import { createBehaviorSchema } from './behavior.schema.js';
import { BehaviorService } from './behavior.service.js';

const router = Router();
router.use(authMiddleware);

router.get('/', requirePermissions('behavior:read'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await BehaviorService.getBehaviorLogs();
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', requirePermissions('behavior:read'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await BehaviorService.getBehaviorSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

router.get('/:studentId', requirePermissions('behavior:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await BehaviorService.getBehaviorLogsByStudentId(req.params.studentId as string);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

router.post('/', requirePermissions('behavior:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createBehaviorSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const record = await BehaviorService.createBehaviorLog(input, authUser.id, correlationId);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requirePermissions('behavior:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const { status } = req.body;
    const recordId = req.params.id as string;

    const record = await BehaviorService.updateBehaviorLogStatus(recordId, status, authUser.id, authUser.roles);
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

export default router;
