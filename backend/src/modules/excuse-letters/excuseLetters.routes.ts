import { Router, Request, Response, NextFunction } from 'express';
import { createExcuseSchema, patchExcuseStatusSchema } from './excuseLetters.schema.js';
import { excuseLettersService } from './excuseLetters.service.js';
import { AuthenticatedUser } from '../../common/middleware/auth.js';

const router = Router();

/**
 * GET /api/attendance/excuses/teacher/me
 * Allows a teacher to fetch all excuse letters submitted to them
 */
router.get('/teacher/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as AuthenticatedUser;
    const records = await excuseLettersService.getTeacherExcuseLetters(user);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/excuses/:studentId
 */
router.get('/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const studentId = req.params.studentId as string;
    const records = await excuseLettersService.getStudentExcuseLetters(studentId, authUser);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attendance/excuses
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createExcuseSchema.parse(req.body);
    const user = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;
    const record = await excuseLettersService.createExcuseLetter(input, user, correlationId);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/attendance/excuses/:id/status
 * Allows a teacher to approve or reject an excuse letter
 */
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const input = patchExcuseStatusSchema.parse(req.body);
    const user = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;
    const updated = await excuseLettersService.updateExcuseLetterStatus(id, input, user, correlationId);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
