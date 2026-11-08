import { Router, Request, Response, NextFunction } from 'express';
import { 
  upsertGrade, 
  getGradesForSectionAndSubject,
  upsertGradeSchema,
  publishGradebook,
  unpublishGradebook,
  requestGradeConsideration,
  getGradeConsiderations,
  approveGradeConsideration,
  rejectGradeConsideration,
} from './gradebook.service.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { getLedger, saveLedger, ledgerSchema } from './ledger.service.js';
import { AppError } from '../common/middleware/errorHandler.js';

const router = Router();

router.use(authMiddleware);

router.get('/ledger', requirePermissions('grade:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.query;
    if (!classId) return res.status(400).json({ success: false, message: 'Missing classId' });
    const actorId = ((req as any).user).id;
    const data = await getLedger(classId as string, actorId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/ledger', requirePermissions('grade:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId, terms } = req.body;
    if (!classId || !terms) return res.status(400).json({ success: false, message: 'Missing classId or terms' });
    const actorId = ((req as any).user).id;
    const correlationId = (req as any).correlationId;
    await saveLedger(classId, terms, actorId, correlationId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/gradebooks/grades
 * Retrieve all grades and enrollments for a specific section, subject, term, and school year.
 */
router.get('/grades', requirePermissions('grade:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const { sectionId, subjectId, term, schoolYear } = req.query;

    if (!sectionId || !subjectId || !term || !schoolYear) {
      return res.status(400).json({ success: false, message: 'Missing required query parameters.' });
    }
    
    const gradesData = await getGradesForSectionAndSubject(
      sectionId as string, 
      subjectId as string, 
      term as 'T1'|'T2'|'T3'|'T4', 
      schoolYear as string, 
      authUser.id
    );
    res.json({ success: true, data: gradesData });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/gradebooks/entries
 * Create or update a grade entry.
 */
router.post('/entries', requirePermissions('grade:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = upsertGradeSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const entry = await upsertGrade(input, actorId, correlationId);
    res.status(200).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/gradebooks/:id/status
 * Updates gradebook status (e.g. Published / Draft) and coordinates snapshots.
 */
router.patch('/:id/status', requirePermissions('grade:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gradebookId = req.params.id as string;
    const { status, expected_version, correction_reason, reason } = req.body;
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    if (status === 'Published') {
      const result = await publishGradebook({
        gradebookId,
        actorUserId: authUser.id,
        actorRole: authUser.roles[0] || 'Teacher',
        expectedVersion: expected_version !== undefined ? Number(expected_version) : undefined,
        correctionReason: correction_reason || reason,
        correlationId,
      });
      return res.json({ success: true, data: result });
    } else if (status === 'Draft') {
      const result = await unpublishGradebook(
        gradebookId,
        authUser.id,
        authUser.roles[0] || 'Teacher',
        correction_reason || reason || 'Returned to draft by user',
        correlationId
      );
      return res.json({ success: true, data: result });
    } else {
      return res.status(400).json({ success: false, message: `Unsupported status '${status}'` });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/gradebooks/:id/publish
 * Explicit gradebook publication and grade snapshot locking.
 */
router.post('/:id/publish', requirePermissions('grade:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gradebookId = req.params.id as string;
    const { expectedVersion, correctionReason } = req.body || {};
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const result = await publishGradebook({
      gradebookId,
      actorUserId: authUser.id,
      actorRole: authUser.roles[0] || 'Teacher',
      expectedVersion: expectedVersion !== undefined ? Number(expectedVersion) : undefined,
      correctionReason,
      correlationId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Grade Consideration / Authorized Adjustment Routes ─────────

/**
 * POST /api/gradebooks/considerations
 * Assigned subject teacher requests a justified grade consideration under DepEd Order No. 015, s. 2026.
 */
router.post('/considerations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    if (!authUser.roles.includes('Teacher')) {
      throw new AppError(403, 'FORBIDDEN', 'Only assigned teachers are authorized to request grade considerations.');
    }

    const result = await requestGradeConsideration(req.body, authUser.id, correlationId);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/gradebooks/considerations
 * Retrieve grade considerations. Teachers see their own; Principals/Admins see school-wide.
 */
router.get('/considerations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const { status, subjectId } = req.query;

    const isAuthorized = authUser.roles.some(r => ['Teacher', 'Principal', 'Admin', 'Registrar'].includes(r));
    if (!isAuthorized) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied: Teacher or administrative role required.');
    }

    const result = await getGradeConsiderations({
      actorUserId: authUser.id,
      actorRoles: authUser.roles,
      status: status as string,
      subjectId: subjectId as string,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/gradebooks/considerations/:id/approve
 * Authorized academic approver (School Principal / Admin) approves a grade consideration.
 */
router.patch('/considerations/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;
    const requestId = req.params.id as string;

    const result = await approveGradeConsideration(requestId, authUser.id, authUser.roles, correlationId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/gradebooks/considerations/:id/reject
 * Authorized academic approver (School Principal / Admin) rejects a grade consideration.
 */
router.patch('/considerations/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;
    const requestId = req.params.id as string;
    const { rejectionReason, reason } = req.body || {};

    const result = await rejectGradeConsideration(
      requestId,
      authUser.id,
      authUser.roles,
      rejectionReason || reason,
      correlationId
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
