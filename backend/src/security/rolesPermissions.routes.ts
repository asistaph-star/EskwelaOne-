import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { getRolesPermissionsMatrix } from './rolesPermissions.service.js';

const router = Router();

// Authentication required for all endpoints
router.use(authMiddleware);

/**
 * Access policy verification helper.
 * - ITAdmin: Full visibility.
 * - Admin: Full operational visibility.
 * - All other roles: 403 Forbidden.
 */
function verifyRolesPermissionsAccess(req: Request): { isITAdmin: boolean; isAdmin: boolean; authUser: AuthenticatedUser } {
  const authUser = (req as any).user as AuthenticatedUser;
  const isITAdmin = Boolean(authUser.roles?.includes('ITAdmin'));
  const isAdmin = Boolean(authUser.roles?.includes('Admin'));

  if (!isITAdmin && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied. Roles & Permissions Matrix is restricted to administrative personnel.');
  }

  return { isITAdmin, isAdmin, authUser };
}

/**
 * GET /api/admin/roles-permissions
 * Retrieve verified system roles, modules, capabilities, and backend authorization matrix.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isITAdmin } = verifyRolesPermissionsAccess(req);
    const data = getRolesPermissionsMatrix(isITAdmin);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// Reject mutation methods on read-only matrix endpoint with 405 Method Not Allowed
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next(new AppError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} is not supported on Roles & Permissions Matrix.`));
  }
  next();
});

export default router;
