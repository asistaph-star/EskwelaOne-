import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { getSystemHealth } from './systemHealth.service.js';

const router = Router();

// Authentication required for all endpoints
router.use(authMiddleware);

/**
 * Access policy verification helper.
 * - ITAdmin: Full system status with technical diagnostic latency.
 * - Admin: High-level operational status.
 * - All other roles: 403 Forbidden.
 */
function verifySystemHealthAccess(req: Request): { isITAdmin: boolean; isAdmin: boolean; authUser: AuthenticatedUser } {
  const authUser = (req as any).user as AuthenticatedUser;
  const isITAdmin = Boolean(authUser.roles?.includes('ITAdmin'));
  const isAdmin = Boolean(authUser.roles?.includes('Admin'));

  if (!isITAdmin && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied. System Health is restricted to administrative personnel.');
  }

  return { isITAdmin, isAdmin, authUser };
}

/**
 * GET /api/admin/system-health
 * Retrieve operational status of core application dependencies.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isITAdmin } = verifySystemHealthAccess(req);
    const data = await getSystemHealth(isITAdmin);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// Reject mutation methods on read-only health endpoint
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next(new AppError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} is not supported on System Health.`));
  }
  next();
});

export default router;
