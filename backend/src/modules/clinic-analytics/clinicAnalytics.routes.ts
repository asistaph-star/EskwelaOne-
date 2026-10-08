import { Router, Request, Response, NextFunction } from 'express';
import { requirePermissions } from '../../common/middleware/auth.js';
import { getClinicAnalytics } from './clinicAnalytics.service.js';

const router = Router();

router.get('/', requirePermissions('clinic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const analytics = await getClinicAnalytics();
    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
});

export default router;
