import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/middleware/errorHandler.js';

import inventoryRoutes from './inventory.routes.js';
import leavesRoutes from './leaves.routes.js';
import rankingRoutes from './ranking.routes.js';

const router = Router();
router.use(authMiddleware);

router.use('/inventory', inventoryRoutes);
router.use('/leaves', leavesRoutes);
router.use('/rankings', rankingRoutes);

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
    const announcements = await prisma.announcement.findMany({
      orderBy: { created_at: 'desc' },
      include: { author: { select: { id: true, first_name: true, last_name: true } } }
    });
    res.json({ success: true, data: announcements });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/announcements
 */
router.post('/announcements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAnnouncementSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const authUser = (req as any).user as AuthenticatedUser;

    const announcement = await prisma.announcement.create({
      data: {
        id: generateId(),
        title: input.title,
        body: input.body,
        audience: input.audience,
        author_id: authUser.id,
      },
      include: { author: { select: { id: true, first_name: true, last_name: true } } }
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

// ─── Events ───────────────────────────────────────────

const eventBaseObject = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  audience: z.enum(['all', 'teachers', 'students']).nullable().optional(),
  date: z.string().datetime(),
  end_date: z.string().datetime().nullable().optional()
});

const eventBaseSchema = eventBaseObject.refine(data => {
  if (data.end_date) {
    return new Date(data.end_date) >= new Date(data.date);
  }
  return true;
}, {
  message: "end_date must be after or equal to date",
  path: ["end_date"]
});

/**
 * GET /api/admin/events
 */
router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const isPrincipalOrAdmin = authUser.roles.includes('Principal') || authUser.roles.includes('Admin');
    const isTeacher = authUser.roles.includes('Teacher');
    const isStudent = authUser.roles.includes('Student');

    let whereClause: any = {};

    if (!isPrincipalOrAdmin) {
      if (isTeacher) {
        whereClause = {
          OR: [
            { audience: 'all' },
            { audience: 'teachers' },
            { created_by_id: authUser.id }
          ]
        };
      } else if (isStudent) {
        whereClause = {
          OR: [
            { audience: 'all' },
            { audience: 'students' },
            { created_by_id: authUser.id }
          ]
        };
      } else {
        whereClause = { created_by_id: authUser.id };
      }
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    });
    // Teacher Calendar and Principal Calendar expect raw array wrapped in data
    res.json({ success: true, data: events }); 
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/events
 */
router.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = eventBaseSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    
    const isPrincipalOrAdmin = authUser.roles.includes('Principal') || authUser.roles.includes('Admin');
    const isStudent = authUser.roles.includes('Student');
    
    if (isStudent && !isPrincipalOrAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'Students cannot create events.');
    }
    
    if (!isPrincipalOrAdmin && input.audience === 'all') {
      throw new AppError(403, 'FORBIDDEN', 'Only administrators can create school-wide events.');
    }

    const event = await prisma.event.create({
      data: {
        id: generateId(),
        title: input.title,
        type: input.type,
        audience: input.audience || null,
        date: new Date(input.date),
        end_date: input.end_date ? new Date(input.end_date) : null,
        created_by_id: authUser.id,
      }
    });

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/events/:id
 */
router.patch('/events/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = eventBaseObject.partial().parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const isPrincipalOrAdmin = authUser.roles.includes('Principal') || authUser.roles.includes('Admin');
    const isStudent = authUser.roles.includes('Student');

    if (isStudent && !isPrincipalOrAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'Students cannot modify events.');
    }

    const id = String(req.params.id);
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new AppError(404, 'NOT_FOUND', 'Event not found');

    if (!isPrincipalOrAdmin && event.created_by_id !== authUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to modify this event.');
    }
    
    if (!isPrincipalOrAdmin && input.audience === 'all') {
      throw new AppError(403, 'FORBIDDEN', 'Only administrators can create school-wide events.');
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        title: input.title !== undefined ? input.title : undefined,
        type: input.type !== undefined ? input.type : undefined,
        audience: input.audience !== undefined ? input.audience : undefined,
        date: input.date !== undefined ? new Date(input.date) : undefined,
        end_date: input.end_date !== undefined ? (input.end_date ? new Date(input.end_date) : null) : undefined,
      }
    });
    res.json({ success: true, data: updatedEvent });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/events/:id
 */
router.delete('/events/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const isPrincipalOrAdmin = authUser.roles.includes('Principal') || authUser.roles.includes('Admin');
    const isStudent = authUser.roles.includes('Student');

    if (isStudent && !isPrincipalOrAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'Students cannot delete events.');
    }

    const id = String(req.params.id);
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new AppError(404, 'NOT_FOUND', 'Event not found');

    if (!isPrincipalOrAdmin && event.created_by_id !== authUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this event.');
    }

    await prisma.event.delete({ where: { id } });
    res.json({ success: true, data: { success: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/enrollment-applications
 */
router.get('/enrollment-applications', requirePermissions('enrollment:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apps = await prisma.enrollmentApplication.findMany({
      orderBy: { created_at: 'desc' }
    });
    
    const mapped = apps.map(app => ({
      id: app.id,
      name: `${app.first_name} ${app.last_name}`,
      gradeLevel: `Grade ${app.grade_level}`,
      type: app.type,
      dateApplied: app.date_applied.toISOString().split('T')[0],
      status: app.status,
      documents: {
        birthCert: app.birth_cert,
        form138: app.form138,
        goodMoral: app.good_moral,
        medical: app.medical
      }
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

export default router;
