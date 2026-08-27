import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import prisma from '../config/database.js';

const router = Router();
router.use(authMiddleware);

// ─── Academic Years ──────────────────────────────────────────

/**
 * GET /api/academic/years
 */
router.get('/years', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const years = await prisma.academicYear.findMany({
      orderBy: { start_date: 'desc' },
    });
    res.json({ success: true, data: years });
  } catch (err) {
    next(err);
  }
});

// ─── Terms ───────────────────────────────────────────────────

/**
 * GET /api/academic/years/:yearId/terms
 */
router.get('/years/:yearId/terms', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const terms = await prisma.term.findMany({
      where: { academic_year_id: req.params.yearId as string },
      orderBy: { key: 'asc' }, // T1, T2, T3, T4
    });
    res.json({ success: true, data: terms });
  } catch (err) {
    next(err);
  }
});

// ─── Subjects ────────────────────────────────────────────────

/**
 * GET /api/academic/subjects
 */
router.get('/subjects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
});

// ─── Sections ────────────────────────────────────────────────

/**
 * GET /api/academic/years/:yearId/sections
 */
router.get('/years/:yearId/sections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sections = await prisma.section.findMany({
      where: { academic_year_id: req.params.yearId as string },
      orderBy: [
        { grade_level: 'asc' },
        { name: 'asc' },
      ],
    });
    res.json({ success: true, data: sections });
  } catch (err) {
    next(err);
  }
});

// ─── Teacher Assignments ─────────────────────────────────────

/**
 * GET /api/academic/years/:yearId/assignments/me
 * Get assignments for the currently logged in teacher.
 */
router.get('/years/:yearId/assignments/me', requirePermissions('assignment:read_own'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    
    // We need the teacher ID, not the user ID
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { teacher: true },
    });

    if (!user || !user.teacher) {
      return res.status(403).json({ success: false, error: { code: 'NOT_A_TEACHER', message: 'Current user does not have a teacher profile.' } });
    }

    const assignments = await prisma.teacherSubjectAssignment.findMany({
      where: {
        academic_year_id: req.params.yearId as string,
        teacher_id: user.teacher.id,
      },
      include: {
        subject: true,
        section: true,
      }
    });

    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
});

// ─── Enrollments ─────────────────────────────────────────────

/**
 * GET /api/academic/sections/:sectionId/enrollments
 */
router.get('/sections/:sectionId/enrollments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { section_id: req.params.sectionId as string },
      include: {
        student: {
          include: {
            user: true
          }
        }
      }
    });

    res.json({ success: true, data: enrollments });
  } catch (err) {
    next(err);
  }
});

export default router;
