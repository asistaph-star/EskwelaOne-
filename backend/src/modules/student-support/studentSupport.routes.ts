import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../../common/middleware/auth.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { createAuditLog } from '../../audit/audit.service.js';
import { studentSupportRateLimiter } from './studentSupport.limiter.js';
import { 
  teacherStudentSupportQuerySchema, 
  principalStudentSupportQuerySchema 
} from './studentSupport.schema.js';
import { 
  getTeacherStudentSupportIndicators, 
  getPrincipalStudentSupportAggregate 
} from './studentSupport.service.js';

const router = Router();

// Enforce authentication on all student-support routes
router.use(authMiddleware);

/**
 * GET /api/student-support/teacher/indicators
 * 
 * Retrieves factual student support indicators for the authenticated Teacher's own assigned classes.
 * Strictly forbidden to Principal and Student.
 */
router.get(
  '/teacher/indicators',
  requirePermissions('assignment:read_own', 'grade:read', 'attendance:read'),
  studentSupportRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = (req as any).user as AuthenticatedUser;

      // Role check: Strictly Teacher only
      if (!authUser.roles.includes('Teacher')) {
        throw new AppError(403, 'FORBIDDEN', 'Access to teacher student support indicators is restricted to teachers.');
      }

      // Enforce date-range semantics: both or neither, and start <= end
      const { startDate, endDate } = req.query;
      if ((startDate && !endDate) || (!startDate && endDate)) {
        throw new AppError(400, 'BAD_REQUEST', 'Both startDate and endDate must be provided together, or both omitted to use the default 30-day window.');
      }
      if (startDate && endDate && String(startDate) > String(endDate)) {
        throw new AppError(400, 'BAD_REQUEST', 'startDate must be on or before endDate.');
      }

      const query = teacherStudentSupportQuerySchema.parse(req.query);
      const correlationId = (req as any).correlationId;

      const data = await getTeacherStudentSupportIndicators(authUser.id, query);

      await createAuditLog({
        actorUserId: authUser.id,
        action: 'STUDENT_SUPPORT_INDICATORS_ACCESSED',
        resourceType: 'student_support',
        newState: {
          sectionId: query.sectionId,
          subjectId: query.subjectId,
          term: query.term,
          attendanceWindow: data.metadata.attendanceWindow,
          studentsReturnedCount: data.students.length,
        },
        correlationId,
      });

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/student-support/principal/aggregate
 * 
 * Retrieves school-wide aggregate student support counts by section and grade level.
 * Strictly forbidden to Teachers and Students.
 * Returns counts ONLY — never returns individual student names, IDs, LRN, or records.
 */
router.get(
  '/principal/aggregate',
  requirePermissions('grade:read_all', 'attendance:read'),
  studentSupportRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = (req as any).user as AuthenticatedUser;

      // Role check: Strictly Principal only. Forbidden to Teacher, Student, Admin, ITAdmin.
      if (!authUser.roles.includes('Principal')) {
        throw new AppError(403, 'FORBIDDEN', 'Access to principal student support aggregate is restricted to the Principal role.');
      }

      // Enforce date-range semantics: both or neither, and start <= end
      const { startDate, endDate } = req.query;
      if ((startDate && !endDate) || (!startDate && endDate)) {
        throw new AppError(400, 'BAD_REQUEST', 'Both startDate and endDate must be provided together, or both omitted to use the default 30-day window.');
      }
      if (startDate && endDate && String(startDate) > String(endDate)) {
        throw new AppError(400, 'BAD_REQUEST', 'startDate must be on or before endDate.');
      }

      const query = principalStudentSupportQuerySchema.parse(req.query);
      const correlationId = (req as any).correlationId;

      const data = await getPrincipalStudentSupportAggregate(query);

      await createAuditLog({
        actorUserId: authUser.id,
        action: 'STUDENT_SUPPORT_AGGREGATE_ACCESSED',
        resourceType: 'student_support_aggregate',
        newState: {
          gradeLevel: query.gradeLevel,
          sectionId: query.sectionId,
          term: query.term,
          attendanceWindow: data.metadata.attendanceWindow,
          sectionsEvaluatedCount: data.aggregates.length,
        },
        correlationId,
      });

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
