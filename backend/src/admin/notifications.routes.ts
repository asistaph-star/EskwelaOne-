import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';

const router = Router();
router.use(authMiddleware);

// Permitted notification icon types matching the UI design system
export const ALLOWED_ICON_TYPES = ['alert', 'megaphone', 'calendar', 'document', 'check'] as const;

export const createNotificationSchema = z.object({
  recipientId: z.string({
    required_error: 'recipientId is required',
    invalid_type_error: 'recipientId must be a string'
  }).uuid({
    message: 'recipientId must be a valid UUID'
  }),
  title: z.string({
    required_error: 'title is required',
    invalid_type_error: 'title must be a string'
  })
    .trim()
    .min(1, 'Title cannot be empty')
    .max(120, 'Title cannot exceed 120 characters'),
  body: z.string({
    required_error: 'body is required',
    invalid_type_error: 'body must be a string'
  })
    .trim()
    .min(1, 'Body cannot be empty')
    .max(1000, 'Body cannot exceed 1000 characters'),
  iconType: z.enum(ALLOWED_ICON_TYPES, {
    errorMap: () => ({ message: `iconType must be one of: ${ALLOWED_ICON_TYPES.join(', ')}` })
  }).optional().default('alert'),
});

export const patchNotificationSchema = z.object({
  isRead: z.boolean({
    required_error: 'isRead is required',
    invalid_type_error: 'isRead must be a boolean'
  }),
});

/**
 * Helper to determine if an authenticated user possesses administrative notification privileges.
 */
export function isAdministrativeUser(user: AuthenticatedUser): boolean {
  const ADMIN_ROLES = ['Admin', 'SuperAdmin', 'Principal', 'ITAdmin', 'Registrar'];
  const hasAdminRole = user.roles?.some(r => ADMIN_ROLES.includes(r));
  const hasAdminPerm = user.permissions?.includes('announcement:write') ||
                       user.permissions?.includes('user:write');
  return Boolean(hasAdminRole || hasAdminPerm);
}

/**
 * GET /api/admin/notifications
 * Retrieves notifications specifically addressed to the authenticated user.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const notifs = await prisma.notification.findMany({
      where: { recipient_id: authUser.id },
      orderBy: { created_at: 'desc' }
    });
    
    const mapped = notifs.map(n => ({
      id: n.id,
      recipientId: n.recipient_id,
      title: n.title,
      body: n.body,
      iconType: n.icon_type,
      isRead: n.is_read,
      timestamp: n.created_at.toISOString(),
    }));
    
    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/notifications
 * Creates a notification with strict schema validation, role-based authorization,
 * recipient existence verification, and duplicate throttling.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId || generateId();

    // 1. Strict Payload Schema Validation
    const validated = createNotificationSchema.parse(req.body);

    // 2. Role-Based Authorization
    const isAdmin = isAdministrativeUser(authUser);
    const isStudent = authUser.roles?.includes('Student') && !isAdmin;

    // Rule 1: Ordinary Students cannot create notifications under any circumstances
    if (isStudent) {
      throw new AppError(403, 'FORBIDDEN', 'Students are not authorized to create notifications.');
    }

    // Rule 2: Non-administrative staff and teachers can ONLY create self-notifications
    if (!isAdmin && validated.recipientId !== authUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'Non-administrative users are not authorized to send notifications to other users.');
    }

    // 3. Recipient Existence & Status Verification
    const recipient = await prisma.user.findUnique({
      where: { id: validated.recipientId },
      select: { id: true, status: true, first_name: true, last_name: true, school_id: true }
    });

    if (!recipient) {
      throw new AppError(404, 'RECIPIENT_NOT_FOUND', 'The specified notification recipient does not exist.');
    }

    if (recipient.status !== 'active') {
      throw new AppError(422, 'RECIPIENT_INACTIVE', 'Cannot send notifications to an inactive or deactivated user account.');
    }

    // 4. Duplicate Suppression (10-second window to prevent accidental double-clicks or spam)
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const existingRecent = await prisma.notification.findFirst({
      where: {
        recipient_id: validated.recipientId,
        title: validated.title,
        body: validated.body,
        created_at: { gte: tenSecondsAgo }
      }
    });

    if (existingRecent) {
      throw new AppError(409, 'DUPLICATE_NOTIFICATION', 'An identical notification was recently dispatched to this recipient. Please wait before resending.');
    }

    // 5. Authoritative Persistence (Server generates ID and forces is_read: false)
    const notifId = generateId();
    const notif = await prisma.notification.create({
      data: {
        id: notifId,
        recipient_id: validated.recipientId,
        title: validated.title,
        body: validated.body,
        icon_type: validated.iconType,
        is_read: false,
      }
    });

    // 6. Security Audit Logging (For administrative notifications sent to other users)
    if (isAdmin && validated.recipientId !== authUser.id) {
      await createAuditLog({
        actorUserId: authUser.id,
        actorSchoolId: authUser.schoolId,
        actorRole: authUser.roles[0] || 'Admin',
        action: 'NOTIFICATION_CREATE',
        category: 'ADMIN',
        resourceType: 'Notification',
        resourceId: notif.id,
        targetLabel: `${recipient.first_name} ${recipient.last_name} (${recipient.school_id})`,
        result: 'SUCCESS',
        correlationId,
        newState: {
          title: validated.title,
          recipientId: validated.recipientId,
          iconType: validated.iconType,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined
      });
    }

    const mapped = {
      id: notif.id,
      recipientId: notif.recipient_id,
      title: notif.title,
      body: notif.body,
      iconType: notif.icon_type,
      isRead: notif.is_read,
      timestamp: notif.created_at.toISOString(),
    };

    res.status(201).json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/notifications/:id
 * Marks a notification as read. Enforces that only the designated recipient can update it.
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const id = String(req.params.id);

    // Validate payload schema
    const validated = patchNotificationSchema.parse(req.body);
    
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    }

    // Recipient ownership check
    if (existing.recipient_id !== authUser.id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only update your own notifications' } });
    }

    const notif = await prisma.notification.update({
      where: { id },
      data: { is_read: validated.isRead }
    });
    
    const mapped = {
      id: notif.id,
      recipientId: notif.recipient_id,
      title: notif.title,
      body: notif.body,
      iconType: notif.icon_type,
      isRead: notif.is_read,
      timestamp: notif.created_at.toISOString(),
    };

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

export default router;
