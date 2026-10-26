import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { getBackupStatusOverview } from './backup.service.js';

const router = Router();

// Authentication required for all endpoints
router.use(authMiddleware);

/**
 * Access policy verification helper.
 * - ITAdmin: Full visibility with technical backup registry history.
 * - Admin: High-level operational backup status overview.
 * - All other roles: 403 Forbidden.
 */
function verifyBackupAccess(req: Request): { isITAdmin: boolean; isAdmin: boolean; authUser: AuthenticatedUser } {
  const authUser = (req as any).user as AuthenticatedUser;
  const isITAdmin = Boolean(authUser.roles?.includes('ITAdmin'));
  const isAdmin = Boolean(authUser.roles?.includes('Admin'));

  if (!isITAdmin && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied. Backup status is restricted to administrative personnel.');
  }

  return { isITAdmin, isAdmin, authUser };
}

/**
 * GET /api/admin/backup-status
 * Retrieve real, verified operational backup and disaster recovery status.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isITAdmin } = verifyBackupAccess(req);
    const overview = getBackupStatusOverview();

    // If standard Admin, omit sensitive filesystem path details from recent entries
    const safeData = isITAdmin
      ? overview
      : {
          ...overview,
          recentBackups: overview.recentBackups.map(b => ({
            backupId: b.backupId,
            timestamp: b.timestamp,
            overallStatus: b.overallStatus,
            databaseSize: b.databaseSize,
            storageSize: b.storageSize,
            totalSize: b.totalSize,
            verified: b.verified,
            durationMs: b.durationMs,
            backupPath: '[PROTECTED_SERVER_PATH]',
          })),
        };

    res.json({
      success: true,
      data: safeData,
    });
  } catch (err) {
    next(err);
  }
});

// Reject mutation methods on read-only backup status endpoint with 405 Method Not Allowed
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next(new AppError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} is not supported on Backup Status.`));
  }
  next();
});

export default router;
