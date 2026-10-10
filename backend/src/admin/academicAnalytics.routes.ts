import { Router, Request, Response, NextFunction } from 'express';
import { requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { getAcademicAnalytics } from './academicAnalytics.service.js';

const router = Router();

/**
 * @route GET /api/admin/analytics/academics
 * @desc Get all Principal Academic Analytics Data
 * @access Private (Requires dashboard:read or similar admin view permission)
 */
router.get(
  '/',
  requirePermissions('grade:read_all'), // Strict least-privilege for school-wide grading analytics
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getAcademicAnalytics();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
