import { Router, Request, Response, NextFunction } from 'express';
import { requirePermissions, AuthenticatedUser } from '../../common/middleware/auth.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { buildSchoolFactSheet } from './factSheet.service.js';
import { ExecutiveSummarySynthesizer } from './synthesizer.service.js';

const router = Router();
const synthesizer = new ExecutiveSummarySynthesizer();

/**
 * GET /api/principal/ai-summary or /api/admin/ai-summary
 * 
 * Executive summary endpoint for Principal and administrative leadership.
 * 
 * Security & Access Control:
 * - Requires 'user:read' and 'leave:approve' (or administrative oversight role).
 * - Strictly denies unauthorized roles (Student, Nurse, Guidance, Teacher without oversight).
 * - Emits grounded executive summary derived ONLY from live PostgreSQL data.
 */
router.get('/', requirePermissions('user:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as AuthenticatedUser;
    
    // Explicit RBAC verification: Only leadership roles with administrative oversight
    const allowedRoles = ['Principal', 'Admin', 'ITAdmin'];
    const hasRole = user.roles && user.roles.some((r: string) => allowedRoles.includes(r));
    const hasOversightPermission = user.permissions && user.permissions.includes('leave:approve');

    if (!hasRole && !hasOversightPermission) {
      throw new AppError(403, 'FORBIDDEN', 'Access restricted to school leadership with administrative oversight.');
    }

    // 1. Build typed, authorized SchoolFactSheet from PostgreSQL
    const factSheet = await buildSchoolFactSheet();

    // 2. Synthesize grounded summary
    const response = await synthesizer.synthesize(factSheet);

    res.json({
      success: true,
      data: response
    });
  } catch (err) {
    next(err);
  }
});

export default router;
