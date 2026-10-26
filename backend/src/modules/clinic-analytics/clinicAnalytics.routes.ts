import { Router, Request, Response, NextFunction } from 'express';
import { requirePermissions, AuthenticatedUser } from '../../common/middleware/auth.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { getClinicAnalytics } from './clinicAnalytics.service.js';

const router = Router();

router.get('/', requirePermissions('clinic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as AuthenticatedUser;
    if (user.roles?.includes('Student')) {
      throw new AppError(403, 'FORBIDDEN', 'Students cannot access clinic analytics.');
    }
    const analytics = await getClinicAnalytics();
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
});

export default router;
