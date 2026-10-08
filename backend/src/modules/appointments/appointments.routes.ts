import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedUser } from '../../common/middleware/auth.js';
import { createAppointmentSchema } from './appointments.schema.js';
import { AppointmentsService } from './appointments.service.js';

const router = Router();
router.use(authMiddleware);

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const records = await AppointmentsService.getMyOwnAppointments(authUser.id, authUser.roles);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

router.get('/students', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const students = await AppointmentsService.getAppointmentsForAuthorizedStudents(authUser.id, authUser.roles);
    res.json({ success: true, data: students });
  } catch (err) {
    next(err);
  }
});

router.get('/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const records = await AppointmentsService.getAppointmentsByStudentId(req.params.studentId as string, authUser.id, authUser.roles);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAppointmentSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;
    
    const record = await AppointmentsService.createAppointment(input, authUser.id, authUser.roles, correlationId);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const { status } = req.body;
    const correlationId = (req as any).correlationId as string;
    
    const record = await AppointmentsService.updateAppointmentStatus(req.params.id as string, status, authUser.id, authUser.roles, correlationId);
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

export default router;
