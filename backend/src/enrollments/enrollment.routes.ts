import { Router, Request, Response, NextFunction } from 'express';
import { transferStudent, getStudentEnrollmentHistory, transferStudentSchema } from './enrollment.service.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';

const router = Router();
router.use(authMiddleware);

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
    
    // Ownership check (if student is requesting their own history vs teacher/admin requesting it)
    const authUser = (req as any).user as AuthenticatedUser;
    
    // In a full implementation, check if the authenticated user IS the student, or has read_all permissions
    // if (authUser.roles.includes('Student') && authUser.id !== studentId) throw FORBIDDEN
    
    const history = await getStudentEnrollmentHistory(studentId, academicYearId);
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

export default router;
