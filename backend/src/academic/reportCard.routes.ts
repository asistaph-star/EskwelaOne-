import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { getReportCardData } from './reportCard.service.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/academic/report-card/:studentId
 * Retrieves the SF9/Report Card data for the specified student.
 */
router.get('/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    // We assume the frontend wants the report card for the current/active academic year.
    // For this implementation, we will pass the year from a query param, or resolve it 
    // to the student's current enrollment. Let's pass it down to the service to resolve.
    const data = await getReportCardData(studentId, actorId);
    
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
