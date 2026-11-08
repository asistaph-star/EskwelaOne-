import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { authMiddleware, requirePermissions, requireAnyPermission, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { saveSf9AdviserComment } from './grading/index.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/academic/sf9/comments/enrollments/:enrollmentId
 * Retrieves saved narrative report-card comments (T1, T2, T3) for an enrollment.
 */
router.get(['/enrollments/:enrollmentId', '/students/:studentId'], requirePermissions('academic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let enrollment: any = null;
    let enrollmentId = req.params.enrollmentId as string;

    if (enrollmentId) {
      enrollment = await (prisma as any).enrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          student: { include: { user: true } },
          section: true,
        },
      });
    } else {
      const studentId = req.params.studentId as string;
      enrollment = await (prisma as any).enrollment.findFirst({
        where: { student_id: studentId, status: 'Enrolled' },
        include: {
          student: { include: { user: true } },
          section: true,
        },
        orderBy: { created_at: 'desc' },
      });
      if (enrollment) {
        enrollmentId = enrollment.id;
      }
    }

    if (!enrollment) {
      throw new AppError(404, 'NOT_FOUND', `Enrollment for requested student/enrollment ID not found`);
    }

    const comments = await (prisma as any).sf9AdviserComment.findMany({
      where: { enrollment_id: enrollmentId },
      include: {
        recorded_by: true,
        published_by: true,
      },
      orderBy: { term: 'asc' },
    });

    const structured: Record<string, any> = {
      T1: null,
      T2: null,
      T3: null,
    };

    for (const c of comments) {
      structured[c.term] = {
        id: c.id,
        term: c.term,
        commentText: c.comment,
        status: c.status,
        version: c.version,
        adviserName: c.recorded_by ? `${c.recorded_by.first_name} ${c.recorded_by.last_name}` : null,
        publishedAt: c.published_at ? c.published_at.toISOString() : null,
        publishedBy: c.published_by ? `${c.published_by.first_name} ${c.published_by.last_name}` : null,
        correctionReason: c.correction_reason,
        updatedAt: c.updated_at.toISOString(),
      };
    }

    res.json({
      success: true,
      data: {
        enrollmentId,
        studentId: enrollment.student_id,
        studentName: `${enrollment.student?.last_name || enrollment.student?.user?.last_name || ''}, ${enrollment.student?.first_name || enrollment.student?.user?.first_name || ''}`.trim(),
        sectionId: enrollment.section_id,
        sectionName: enrollment.section.name,
        comments: structured,
      },
    });
  } catch (err) {
    next(err);
  }
});

const saveCommentSchema = z.object({
  term: z.enum(['T1', 'T2', 'T3']),
  commentText: z.string().max(300),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional().default('DRAFT'),
  allowPublishedCorrection: z.boolean().optional().default(false),
  correctionReason: z.string().optional().nullable(),
});

/**
 * POST /api/academic/sf9/comments/enrollments/:enrollmentId
 * Saves or publishes an adviser comment for a term.
 * Restricted to the designated Section Class Adviser (or Admin/Principal/Registrar override).
 * Protected against silent overwrite when comment status is PUBLISHED.
 */
router.post(['/enrollments/:enrollmentId', '/students/:studentId'], requireAnyPermission('academic:write', 'grade:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let enrollment: any = null;
    let enrollmentId = req.params.enrollmentId as string;
    const parsed = saveCommentSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    if (enrollmentId) {
      enrollment = await (prisma as any).enrollment.findUnique({
        where: { id: enrollmentId },
      });
    } else {
      const studentId = req.params.studentId as string;
      enrollment = await (prisma as any).enrollment.findFirst({
        where: { student_id: studentId, status: 'Enrolled' },
        orderBy: { created_at: 'desc' },
      });
      if (enrollment) {
        enrollmentId = enrollment.id;
      }
    }

    if (!enrollment) throw new AppError(404, 'NOT_FOUND', `Enrollment for requested student/enrollment ID not found`);

    const result = await saveSf9AdviserComment(prisma as any, {
      enrollmentId,
      studentId: enrollment.student_id,
      sectionId: enrollment.section_id,
      academicYearId: enrollment.academic_year_id,
      term: parsed.term as any,
      comment: parsed.commentText,
      status: parsed.status as any,
      allowPublishedCorrection: parsed.allowPublishedCorrection,
      correctionReason: parsed.correctionReason,
      actor: {
        userId: authUser.id,
        role: (authUser.roles[0] || 'Teacher') as any,
      },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
