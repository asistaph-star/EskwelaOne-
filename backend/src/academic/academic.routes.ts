import { Router, Request, Response, NextFunction } from 'express';
import reportCardRoutes from './reportCard.routes.js';
import sf10Routes from './sf10.routes.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import prisma from '../config/database.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { 
  createAcademicYearSchema, 
  createSubjectSchema, 
  createSectionSchema, 
  createTeacherAssignmentSchema,
  createAcademicYear,
  createSubject,
  createSection,
  createTeacherAssignment
} from './academic.service.js';

const router = Router();
router.use('/report-card', reportCardRoutes);
router.use('/sf10', sf10Routes);
router.use(authMiddleware);

// ─── Academic Years ──────────────────────────────────────────

/**
 * POST /api/academic/years
 * Requires academic:write permission.
 */
router.post('/years', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAcademicYearSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const year = await createAcademicYear(input, actorId, correlationId);
    res.status(201).json({ success: true, data: year });
  } catch (err) {
    next(err);
  }
});

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
 * POST /api/academic/subjects
 * Requires academic:write permission.
 */
router.post('/subjects', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createSubjectSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const subject = await createSubject(input, actorId, correlationId);
    res.status(201).json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
});

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
 * POST /api/academic/sections
 * Requires academic:write permission.
 */
router.post('/sections', requirePermissions('academic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createSectionSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const section = await createSection(input, actorId, correlationId);
    res.status(201).json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
});

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
 * POST /api/academic/assignments
 * Requires assignment:write permission.
 */
router.post('/assignments', requirePermissions('assignment:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createTeacherAssignmentSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    
    const assignment = await createTeacherAssignment(input, actorId, correlationId);
    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
});

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

/**
 * GET /api/academic/my-classes
 * Get the current teacher's classes for the active academic year, shaped for the Teacher Portal.
 */
router.get('/my-classes', requirePermissions('assignment:read_own'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    
    // We need the teacher ID
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { teacher: true },
    });

    if (!user || !user.teacher) {
      return res.status(403).json({ success: false, error: { code: 'NOT_A_TEACHER', message: 'Current user does not have a teacher profile.' } });
    }

    // Get the current active academic year
    const currentYear = await prisma.academicYear.findFirst({
      where: { is_current: true }
    });

    if (!currentYear) {
      return res.status(404).json({ success: false, message: 'No active academic year found' });
    }

    const assignments = await prisma.teacherSubjectAssignment.findMany({
      where: {
        academic_year_id: currentYear.id,
        teacher_id: user.teacher.id,
      },
      include: {
        subject: true,
        section: {
          include: {
            _count: {
              select: { enrollments: { where: { status: 'Enrolled' } } }
            }
          }
        },
      }
    });

    // Map to the shape expected by MY_CLASSES frontend
    const mapped = assignments.map((a, i) => {
      // Generate a stable color based on index or ID
      const hues = [220, 160, 345, 45, 280];
      const hue = hues[i % hues.length];
      
      return {
        id: a.id,
        grade: a.section.grade_level,
        section: a.section.name,
        subject: a.subject.name,
        students: a.section._count.enrollments,
        completion: 0, // Mocked until grades completion logic is implemented
        semester: currentYear.name,
        adviser: false, // Schema currently has no concept of section adviser
        imgHue: `hsl(${hue},60%,34%)`
      };
    });

    res.json({ success: true, data: mapped });
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
    const authUser = (req as any).user as AuthenticatedUser;
    const sectionId = req.params.sectionId as string;

    const isGlobalViewer = authUser.roles.some(r => ['Admin', 'Principal', 'Registrar'].includes(r));

    if (!isGlobalViewer) {
      if (authUser.roles.includes('Teacher')) {
        // Must be a teacher assigned to this section
        const assignment = await prisma.teacherSubjectAssignment.findFirst({
          where: {
            section_id: sectionId,
            teacher: { user_id: authUser.id }
          }
        });
        if (!assignment) {
          throw new AppError(403, 'FORBIDDEN', 'You are not assigned to teach this section.');
        }
      } else {
        // Students and any other roles
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view section enrollments.');
      }
    }

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
