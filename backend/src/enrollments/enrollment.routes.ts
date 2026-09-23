import { Router, Request, Response, NextFunction } from 'express';
import { transferStudent, getStudentEnrollmentHistory, transferStudentSchema, createInitialEnrollment, initialEnrollmentSchema } from './enrollment.service.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import prisma from '../config/database.js';
import { AppError } from '../common/middleware/errorHandler.js';

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
 * GET /api/enrollments/student/:studentId/history/:academicYearId
 * Retrieve the enrollment history (and historical grades) for a student in a specific year.
 */
router.get('/student/:studentId/history/:academicYearId', requirePermissions('enrollment:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const academicYearId = req.params.academicYearId as string;
    
    // Ownership check: Students can only view their own history
    const authUser = (req as any).user as AuthenticatedUser;
    
    if (authUser.roles.includes('Student')) {
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

export default router;
