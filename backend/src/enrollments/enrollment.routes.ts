import { Router, Request, Response, NextFunction } from 'express';
import { transferStudent, getStudentEnrollmentHistory, transferStudentSchema, createInitialEnrollment, initialEnrollmentSchema } from './enrollment.service.js';
import { enrollNextYearStudent, enrollNextYearSchema } from '../academic/studentPromotion.service.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import prisma from '../config/database.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { classifyAcademicYearLifecycle } from '../common/utils/calendarValidation.js';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/enrollments
 * Perform an initial student enrollment.
 * Requires admin/registrar level write permissions for enrollments.
 */
router.post('/', requirePermissions('enrollment:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = initialEnrollmentSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    const result = await createInitialEnrollment(input, actorId, correlationId);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/enrollments/transfer
 * Perform a mid-year student transfer.
 * Requires admin/registrar level write permissions for enrollments.
 */
router.post('/transfer', requirePermissions('enrollment:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = transferStudentSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    const result = await transferStudent(input, actorId, correlationId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/enrollments/promote
 * Perform a next-year student promotion enrollment.
 * Requires admin/registrar level write permissions for enrollments.
 */
router.post('/promote', requirePermissions('enrollment:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = enrollNextYearSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const authUser = (req as any).user as AuthenticatedUser;

    const result = await enrollNextYearStudent(input, authUser, correlationId);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/enrollments/student/:studentId/history/:academicYearId
 * Retrieve the enrollment history (and historical grades) for a student in a specific year.
 */
router.get('/student/:studentId/history/:academicYearId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const academicYearId = req.params.academicYearId as string;
    const authUser = (req as any).user as AuthenticatedUser;
    
    const isStudent = authUser.roles.includes('Student');
    const hasEnrollmentRead = authUser.permissions.includes('enrollment:read');
    const hasAcademicRead = authUser.permissions.includes('academic:read');

    if (!hasEnrollmentRead && !(isStudent && hasAcademicRead)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions to view student enrollment history.');
    }
    
    // Ownership check: Students can strictly only view their own history
    if (isStudent) {
      const student = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!student || student.id !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own enrollment history.');
      }
    }
    
    const history = await getStudentEnrollmentHistory(studentId, academicYearId);
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/enrollments/student/:studentId/years
 * Retrieve all academic years the student has enrollment records for,
 * including section and grade level metadata for multi-year navigation.
 */
router.get('/student/:studentId/years', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const authUser = (req as any).user as AuthenticatedUser;

    const isStudent = authUser.roles.includes('Student');
    const hasEnrollmentRead = authUser.permissions.includes('enrollment:read');
    const hasAcademicRead = authUser.permissions.includes('academic:read');

    if (!hasEnrollmentRead && !(isStudent && hasAcademicRead)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions to view student academic years.');
    }

    // Resolve student record (supports student.id and student.user_id)
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: studentId },
          { user_id: studentId }
        ]
      }
    });

    if (!student) {
      throw new AppError(404, 'NOT_FOUND', 'Student not found.');
    }

    // Ownership check: Students can strictly only view their own academic years
    if (isStudent && student.user_id !== authUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only view your own academic years.');
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { student_id: student.id },
      include: {
        academic_year: true,
        section: true,
      },
      orderBy: {
        academic_year: {
          start_date: 'desc'
        }
      }
    });

    const years = enrollments.map(enr => ({
      enrollmentId: enr.id,
      academicYearId: enr.academic_year_id,
      academicYearName: enr.academic_year.name,
      isCurrent: enr.academic_year.is_current,
      lifecycle: classifyAcademicYearLifecycle(enr.academic_year),
      startDate: enr.academic_year.start_date,
      endDate: enr.academic_year.end_date,
      sectionId: enr.section_id,
      sectionName: enr.section.name,
      gradeLevel: enr.section.grade_level,
      enrollmentStatus: enr.status,
    }));

    res.json({ success: true, data: years });
  } catch (err) {
    next(err);
  }
});

export default router;
