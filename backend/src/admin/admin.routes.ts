import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { validateStrictIsoDateTime } from '../common/utils/calendarValidation.js';

import inventoryRoutes from './inventory.routes.js';
import leavesRoutes from './leaves.routes.js';
import rankingRoutes from './ranking.routes.js';
import notificationsRoutes from './notifications.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import academicAnalyticsRoutes from './academicAnalytics.routes.js';
import welfareAlertsRoutes from './welfareAlerts.routes.js';
import executiveSummaryRoutes from './executive-summary/executiveSummary.routes.js';

const router = Router();
router.use(authMiddleware);

router.use('/inventory', inventoryRoutes);
router.use('/leaves', leavesRoutes);
router.use('/ranking', rankingRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/welfare-alerts', welfareAlertsRoutes);
router.use('/ai-summary', executiveSummaryRoutes);
router.use('/', dashboardRoutes);
router.use('/analytics/academics', academicAnalyticsRoutes);

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
router.post('/announcements', requirePermissions('announcement:write'), async (req: Request, res: Response, next: NextFunction) => {
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

const eventBaseSchema = eventBaseObject.superRefine((data, ctx) => {
  const dateRes = validateStrictIsoDateTime(data.date);
  if (!dateRes.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: dateRes.error || 'Invalid start date/time',
      path: ['date'],
    });
  }
  if (data.end_date) {
    const endDateRes = validateStrictIsoDateTime(data.end_date);
    if (!endDateRes.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: endDateRes.error || 'Invalid end date/time',
        path: ['end_date'],
      });
    } else if (dateRes.valid && new Date(data.end_date) < new Date(data.date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_date must be after or equal to date',
        path: ['end_date'],
      });
    }
  }
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
 * Helper to map Prisma EnrollmentApplication to frontend Applicant contract
 */
function mapEnrollmentApp(app: any) {
  return {
    id: app.id,
    name: `${app.first_name || ''}${app.last_name ? ' ' + app.last_name : ''}`.trim(),
    gradeLevel: `Grade ${app.grade_level}`,
    type: app.type,
    dateApplied: app.date_applied instanceof Date ? app.date_applied.toISOString().split('T')[0] : String(app.date_applied).split('T')[0],
    status: app.status,
    documents: {
      birthCert: Boolean(app.birth_cert),
      form138: Boolean(app.form138),
      goodMoral: Boolean(app.good_moral),
      medical: Boolean(app.medical)
    }
  };
}

const createEnrollmentAppSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Applicant name is required'),
  gradeLevel: z.union([z.string(), z.number()]),
  type: z.enum(['New Student', 'Transferee', 'Returning']).default('New Student'),
  status: z.enum(['Pending Review', 'Missing Documents', 'Enrolled', 'Rejected']).default('Pending Review'),
  documents: z.object({
    birthCert: z.boolean().optional(),
    form138: z.boolean().optional(),
    goodMoral: z.boolean().optional(),
    medical: z.boolean().optional(),
  }).optional(),
});

const updateEnrollmentAppSchema = z.object({
  name: z.string().optional(),
  gradeLevel: z.union([z.string(), z.number()]).optional(),
  type: z.enum(['New Student', 'Transferee', 'Returning']).optional(),
  status: z.enum(['Pending Review', 'Missing Documents', 'Enrolled', 'Rejected']).optional(),
  documents: z.object({
    birthCert: z.boolean().optional(),
    form138: z.boolean().optional(),
    goodMoral: z.boolean().optional(),
    medical: z.boolean().optional(),
  }).optional(),
});

/**
 * GET /api/admin/enrollment-stats
 * Real-time enrollment and admission statistics for Registrar and Admin.
 */
router.get('/enrollment-stats', requirePermissions('enrollment:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentYear = await prisma.academicYear.findFirst({
      where: { is_current: true },
      select: { id: true }
    });

    let totalEnrolled = 0;
    if (currentYear) {
      totalEnrolled = await prisma.enrollment.count({
        where: {
          academic_year_id: currentYear.id,
          status: 'Enrolled'
        }
      });
    }

    const pendingAdmissions = await prisma.enrollmentApplication.count({
      where: { status: 'Pending Review' }
    });

    const missingDocuments = await prisma.enrollmentApplication.count({
      where: {
        OR: [
          { status: 'Missing Documents' },
          { birth_cert: false },
          { form138: false },
          { good_moral: false },
          { medical: false }
        ]
      }
    });

    res.json({
      success: true,
      data: {
        totalEnrolled,
        targetEnrollment: null,
        pendingAdmissions,
        missingDocuments
      }
    });
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
    
    res.json({ success: true, data: apps.map(mapEnrollmentApp) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/enrollment-applications
 */
router.post('/enrollment-applications', requirePermissions('enrollment:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createEnrollmentAppSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const nameParts = input.name.trim().split(/\s+/);
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    let parsedGradeLevel = 7;
    if (typeof input.gradeLevel === 'number') {
      parsedGradeLevel = input.gradeLevel;
    } else {
      const match = String(input.gradeLevel).match(/\d+/);
      if (match) parsedGradeLevel = parseInt(match[0], 10);
    }

    const app = await prisma.enrollmentApplication.create({
      data: {
        id: input.id || generateId(),
        first_name: firstName,
        last_name: lastName,
        grade_level: parsedGradeLevel,
        type: input.type,
        status: input.status,
        birth_cert: input.documents?.birthCert ?? false,
        form138: input.documents?.form138 ?? false,
        good_moral: input.documents?.goodMoral ?? false,
        medical: input.documents?.medical ?? false,
      }
    });

    await createAuditLog({
      actorUserId: authUser.id,
      action: 'ENROLLMENT_APPLICATION_CREATED',
      resourceType: 'enrollment_application',
      resourceId: app.id,
      newState: { id: app.id, name: input.name, gradeLevel: parsedGradeLevel, type: app.type, status: app.status },
      correlationId,
    });

    res.status(201).json({ success: true, data: mapEnrollmentApp(app) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/enrollment-applications/:id
 */
router.patch('/enrollment-applications/:id', requirePermissions('enrollment:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const input = updateEnrollmentAppSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const existing = await prisma.enrollmentApplication.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Enrollment application not found.');
    }

    const updateData: any = {};
    if (input.name !== undefined) {
      const nameParts = input.name.trim().split(/\s+/);
      updateData.first_name = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
      updateData.last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    }
    if (input.gradeLevel !== undefined) {
      if (typeof input.gradeLevel === 'number') {
        updateData.grade_level = input.gradeLevel;
      } else {
        const match = String(input.gradeLevel).match(/\d+/);
        if (match) updateData.grade_level = parseInt(match[0], 10);
      }
    }
    if (input.type !== undefined) updateData.type = input.type;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.documents?.birthCert !== undefined) updateData.birth_cert = input.documents.birthCert;
    if (input.documents?.form138 !== undefined) updateData.form138 = input.documents.form138;
    if (input.documents?.goodMoral !== undefined) updateData.good_moral = input.documents.goodMoral;
    if (input.documents?.medical !== undefined) updateData.medical = input.documents.medical;

    const updated = await prisma.enrollmentApplication.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      actorUserId: authUser.id,
      action: 'ENROLLMENT_APPLICATION_UPDATED',
      resourceType: 'enrollment_application',
      resourceId: updated.id,
      previousState: existing,
      newState: updated,
      correlationId,
    });

    res.json({ success: true, data: mapEnrollmentApp(updated) });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/enrollment-applications/:id
 */
router.delete('/enrollment-applications/:id', requirePermissions('enrollment:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const existing = await prisma.enrollmentApplication.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Enrollment application not found.');
    }

    await prisma.enrollmentApplication.delete({ where: { id } });

    await createAuditLog({
      actorUserId: authUser.id,
      action: 'ENROLLMENT_APPLICATION_DELETED',
      resourceType: 'enrollment_application',
      resourceId: id,
      previousState: existing,
      correlationId,
    });

    res.json({ success: true, data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
