import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import {
  getAuditLogs,
  getAuditLogById,
  getAuditSummaryCounts,
  createAuditLog,
  AUDIT_CATEGORIES,
} from './audit.service.js';

const router = Router();

// All audit routes require authentication
router.use(authMiddleware);

/**
 * Access policy verification helper.
 * - ITAdmin: Full access across all categories.
 * - Admin: Limited to operational categories (ACCOUNT, CONFIGURATION, ACADEMIC, ATTENDANCE, STUDENT_SERVICES).
 * - All other roles: 403 Forbidden.
 */
function verifyAuditAccess(req: Request): { isITAdmin: boolean; isAdmin: boolean; authUser: AuthenticatedUser } {
  const authUser = (req as any).user as AuthenticatedUser;
  const isITAdmin = Boolean(authUser.roles?.includes('ITAdmin'));
  const isAdmin = Boolean(authUser.roles?.includes('Admin'));

  if (!isITAdmin && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied. Audit logs are restricted to administrative personnel.');
  }

  return { isITAdmin, isAdmin, authUser };
}

/**
 * Safe CSV field sanitizer to mitigate spreadsheet formula injection (CWE-1236).
 */
function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // If string begins with =, +, -, @, \t, or \r, prepend a single quote to neutralize formula execution
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/admin/audit-logs
 * Paginated and filtered query of audit records.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isITAdmin, isAdmin } = verifyAuditAccess(req);

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const search = req.query.search as string | undefined;
    let category = req.query.category as string | undefined;
    const action = req.query.action as string | undefined;
    const result = req.query.result as string | undefined;
    const actorRole = req.query.actorRole as string | undefined;
    const actorSchoolId = req.query.actorSchoolId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    // Standard Admin is restricted to operational categories only
    if (isAdmin && !isITAdmin) {
      const allowedCategories = ['ACCOUNT', 'CONFIGURATION', 'ACADEMIC', 'ATTENDANCE', 'STUDENT_SERVICES'];
      if (category && category !== 'ALL') {
        if (!allowedCategories.includes(category)) {
          throw new AppError(403, 'FORBIDDEN', 'Standard Administrators cannot access security or system audit categories.');
        }
      }
    }

    const [auditData, summaryCounts] = await Promise.all([
      getAuditLogs({
        page,
        pageSize,
        search,
        category,
        action,
        result,
        actorRole,
        actorSchoolId,
        startDate,
        endDate,
      }),
      getAuditSummaryCounts(),
    ]);

    // If Standard Admin, filter summary counts to operational only
    const sanitizedSummary = (isAdmin && !isITAdmin)
      ? {
          eventsToday: auditData.pagination.total,
          adminChangesToday: summaryCounts.adminChangesToday,
          failedAuthToday: 0, // Hidden from Standard Admin
          denialsToday: 0,     // Hidden from Standard Admin
        }
      : summaryCounts;

    res.json({
      success: true,
      data: {
        items: auditData.items,
        pagination: auditData.pagination,
        summary: sanitizedSummary,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/audit-logs/export/csv
 * Filtered CSV export of audit logs.
 * Restricted to ITAdmin.
 */
router.get('/export/csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isITAdmin, authUser } = verifyAuditAccess(req);

    if (!isITAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'Audit log export is restricted to IT Administrators.');
    }

    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const action = req.query.action as string | undefined;
    const result = req.query.result as string | undefined;
    const actorRole = req.query.actorRole as string | undefined;
    const actorSchoolId = req.query.actorSchoolId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    // Bounded export limit (max 5000 records)
    const exportData = await getAuditLogs({
      page: 1,
      pageSize: 5000,
      search,
      category,
      action,
      result,
      actorRole,
      actorSchoolId,
      startDate,
      endDate,
    });

    // Record audit event for export action itself
    await createAuditLog({
      actorUserId: authUser.id,
      actorSchoolId: authUser.schoolId,
      actorRole: authUser.roles[0] || 'ITAdmin',
      action: 'AUDIT_LOG_EXPORTED',
      category: 'SYSTEM',
      resourceType: 'audit_log',
      targetLabel: `CSV Export (${exportData.items.length} records)`,
      result: 'SUCCESS',
      correlationId: (req as any).correlationId,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    const headers = [
      'ID',
      'Timestamp (UTC)',
      'Actor User ID',
      'Actor School ID',
      'Actor Role',
      'Action',
      'Category',
      'Target Type',
      'Target ID',
      'Target Label',
      'Result',
      'IP Address',
      'User Agent',
      'Reason',
      'Request ID',
    ];

    const rows = exportData.items.map(item => [
      sanitizeCsvCell(item.id),
      sanitizeCsvCell(item.created_at.toISOString()),
      sanitizeCsvCell(item.actor_user_id || ''),
      sanitizeCsvCell(item.actor_school_id || item.actor?.school_id || ''),
      sanitizeCsvCell(item.actor_role || ''),
      sanitizeCsvCell(item.action),
      sanitizeCsvCell(item.category || ''),
      sanitizeCsvCell(item.resource_type || ''),
      sanitizeCsvCell(item.resource_id || ''),
      sanitizeCsvCell(item.target_label || ''),
      sanitizeCsvCell(item.result),
      sanitizeCsvCell(item.ip_address || ''),
      sanitizeCsvCell(item.user_agent || ''),
      sanitizeCsvCell(item.reason || ''),
      sanitizeCsvCell(item.correlation_id || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${timestampStr}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/audit-logs/:id
 * Retrieve sanitized audit record detail.
 * Detail access is audited to establish accountable oversight.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isITAdmin, isAdmin, authUser } = verifyAuditAccess(req);
    const id = String(req.params.id);

    const log = await getAuditLogById(id);
    if (!log) {
      throw new AppError(404, 'NOT_FOUND', 'Audit log record not found.');
    }

    // Standard Admin cannot view Security or System category details
    if (isAdmin && !isITAdmin) {
      if (log.category === 'SECURITY' || log.category === 'SYSTEM') {
        throw new AppError(403, 'FORBIDDEN', 'Standard Administrators cannot inspect security or system audit log details.');
      }
    }

    // Audit the viewing of this specific audit record (avoiding recursion if viewing self)
    if (log.action !== 'AUDIT_LOG_VIEWED') {
      await createAuditLog({
        actorUserId: authUser.id,
        actorSchoolId: authUser.schoolId,
        actorRole: authUser.roles[0] || 'User',
        action: 'AUDIT_LOG_VIEWED',
        category: 'SYSTEM',
        resourceType: 'audit_log',
        resourceId: log.id,
        targetLabel: `${log.action} (${log.id})`,
        result: 'SUCCESS',
        correlationId: (req as any).correlationId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'] as string | undefined,
      }).catch(() => {});
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (err) {
    next(err);
  }
});

// Explicitly reject any mutating HTTP methods on audit logs to enforce append-only immutability
router.use((req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Audit logs are immutable append-only records. Modifications and deletions are strictly prohibited.',
      },
    });
  }
  next();
});

export default router;
