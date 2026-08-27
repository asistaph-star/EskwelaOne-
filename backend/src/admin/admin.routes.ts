import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';

const router = Router();
router.use(authMiddleware);

// ─── Announcements ───────────────────────────────────────────

const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: z.enum(['All', 'Teachers', 'Students', 'Parents', 'Staff']),
});

/**
 * GET /api/admin/announcements
 */
router.get('/announcements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a full implementation, filter by audience based on current user role
    const announcements = await prisma.announcement.findMany({
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, data: announcements });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/announcements
 */
router.post('/announcements', requirePermissions('announcement:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAnnouncementSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const authUser = (req as any).user as AuthenticatedUser;

    const announcement = await prisma.announcement.create({
      data: {
        id: generateId(),
        title: req.body.title,
        body: req.body.content,
        audience: req.body.audience,
        author_id: (req as any).user.id,
      }
    });

    await createAuditLog({
      actorUserId: authUser.id,
      action: 'ANNOUNCEMENT_CREATED',
      resourceType: 'announcement',
      resourceId: announcement.id,
      newState: input,
      correlationId,
    });

    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
});

// ─── Appointments ────────────────────────────────────────────

/**
 * GET /api/admin/appointments/me
 * Gets appointments where the user is either the teacher or the student/parent
 */
router.get('/appointments/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    
    const appointments = await prisma.appointment.findMany({
      where: {
        OR: [
          { teacher_id: authUser.id },
          { student_id: authUser.id }
        ]
      },
      orderBy: { date: 'desc' }
    });
    
    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
});

// ─── Events ────────────────────────────────────────────────
router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await prisma.event.findMany({ orderBy: { date: 'asc' } });
    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
});

router.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.event.create({
      data: {
        id: generateId(),
        ...req.body,
        date: new Date(req.body.date),
        end_date: req.body.end_date ? new Date(req.body.end_date) : null
      }
    });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

// ─── Leave Requests ──────────────────────────────────────────
router.get('/leaves', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawLeaves = await prisma.leaveRequest.findMany({ 
      orderBy: { created_at: 'desc' },
      include: { user: true, approver: true }
    });
    const leaves = rawLeaves.map(l => ({
      ...l,
      userName: `${l.user.first_name} ${l.user.last_name}`,
      approverName: l.approver ? `${l.approver.first_name} ${l.approver.last_name}` : null
    }));
    res.json({ success: true, data: leaves });
  } catch (err) {
    next(err);
  }
});

router.post('/leaves', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.leaveRequest.create({
      data: {
        id: generateId(),
        user_id: (req as any).user.id,
        ...req.body,
        start_date: new Date(req.body.start_date || req.body.startDate),
        end_date: new Date(req.body.end_date || req.body.endDate)
      }
    });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

// ─── Enrollment Applications ───────────────────────────────
router.get('/enrollment-applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apps = await prisma.enrollmentApplication.findMany({ orderBy: { created_at: 'desc' } });
    res.json({ success: true, data: apps });
  } catch (err) {
    next(err);
  }
});

export default router;
