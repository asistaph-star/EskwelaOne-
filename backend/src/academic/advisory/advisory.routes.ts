/**
 * DigiSkwela — Class Adviser Advisory Endpoints
 * Module: backend/src/academic/advisory/advisory.routes.ts
 *
 * REST API for:
 * - Pre-registration learner search
 * - Class Adviser section enrollment of existing learners
 * - Class Adviser learner registration & verification
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../../common/middleware/auth.js';
import {
  searchLearnersRegistry,
  enrollExistingLearner,
  validateNewLearnerRegistration,
  registerNewLearner,
  getUnprovisionedLearners,
} from './advisory.service.js';
import { registerLearnerBackendSchema } from '../../common/validation/studentValidation.js';

const router = Router();
router.use(authMiddleware);

const enrollExistingSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  academicYearId: z.string().optional(),
});

const registerLearnerSchema = registerLearnerBackendSchema;

/**
 * GET /api/academic/advisory/search?q=...
 * Searches existing learner records by LRN, student number, or name before offering registration.
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.q as string) || (req.query.query as string) || '';
    const authUser = (req as any).user as AuthenticatedUser;

    const results = await searchLearnersRegistry(query, authUser.id);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/advisory/sections/:sectionId/enroll-existing
 * Enrolls an existing verified learner into the caller's assigned advisory section.
 */
router.post('/sections/:sectionId/enroll-existing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const input = enrollExistingSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const result = await enrollExistingLearner(
      {
        sectionId,
        studentId: input.studentId,
        academicYearId: input.academicYearId,
      },
      authUser.id,
      correlationId
    );

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/advisory/sections/:sectionId/validate-registration
 * Pre-validates new learner registration details and checks LRN uniqueness.
 */
router.post('/sections/:sectionId/validate-registration', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const input = registerLearnerSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const validation = await validateNewLearnerRegistration(
      {
        sectionId,
        ...input,
      },
      authUser.id
    );

    res.json({
      success: true,
      data: {
        valid: true,
        lrn: validation.cleanLrn,
        sectionName: validation.section.name,
        gradeLevel: validation.section.grade_level,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/advisory/sections/:sectionId/register
 * Fully registers a new learner and enrolls into the Class Adviser's section.
 * Creates Student under Approach A (user_id is null).
 */
router.post('/sections/:sectionId/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectionId = req.params.sectionId as string;
    const input = registerLearnerSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const result = await registerNewLearner(
      {
        sectionId,
        ...input,
      },
      authUser.id,
      correlationId
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/advisory/unprovisioned-learners
 * Retrieves all registered students who do not yet have a Student Portal User account.
 */
router.get('/unprovisioned-learners', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const list = await getUnprovisionedLearners(authUser.id);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

export default router;

