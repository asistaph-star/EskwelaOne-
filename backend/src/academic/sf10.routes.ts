import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { getSF10Data } from './sf10.service.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/academic/sf10/:studentId
 * Retrieves the SF10/Scholastic Record (Form 137) data for the specified student.
 * Returns historical grade data across all academic years.
 * 
 * Authorization: Admin, Principal, Registrar, or Teacher assigned to student's section.
 */
router.get('/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const data = await getSF10Data(studentId, actorId);
    
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
