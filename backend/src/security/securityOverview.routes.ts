import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { getSecurityOverview, SecurityTimeWindow } from './securityOverview.service.js';

const router = Router();

// Authentication required for all endpoints
router.use(authMiddleware);

/**
 * Access policy verification helper.
 * - ITAdmin: Full security and operational metrics.
 * - Admin: Operational metrics only (account state, password resets, status changes).
 * - All other roles: 403 Forbidden.
 */
function verifySecurityOverviewAccess(req: Request): { isITAdmin: boolean; isAdmin: boolean; authUser: AuthenticatedUser } {
  const authUser = (req as any).user as AuthenticatedUser;
  const isITAdmin = Boolean(authUser.roles?.includes('ITAdmin'));
  const isAdmin = Boolean(authUser.roles?.includes('Admin'));

  if (!isITAdmin && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied. Security overview is restricted to administrative personnel.');
  }

  return { isITAdmin, isAdmin, authUser };
}

/**
 * GET /api/admin/security-overview
 * Aggregate security visibility metrics, account state, and recent security events.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isITAdmin } = verifySecurityOverviewAccess(req);
    const rawWindow = req.query.timeWindow as string | undefined;
    const timeWindow: SecurityTimeWindow = rawWindow === '7d' ? '7d' : '24h';

    const data = await getSecurityOverview({
      timeWindow,
      isITAdmin,
    });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// Reject mutation methods on read-only overview endpoint
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next(new AppError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} is not supported on Security Overview.`));
  }
  next();
});

export default router;
