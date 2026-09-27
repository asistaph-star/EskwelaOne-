import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const notifs = await prisma.notification.findMany({
      where: { recipient_id: authUser.id },
      orderBy: { created_at: 'desc' }
    });
    
    // Map to camelCase for frontend
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

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = req.body;
    const notif = await prisma.notification.create({
      data: {
        id: input.id || generateId(),
        recipient_id: input.recipientId,
        title: input.title,
        body: input.body,
        icon_type: input.iconType || 'alert',
        is_read: input.isRead || false,
      }
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
    res.status(201).json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const { id } = req.params;
    const input = req.body;
    
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    }
    if (existing.recipient_id !== authUser.id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only update your own notifications' } });
    }

    const notif = await prisma.notification.update({
      where: { id },
      data: { is_read: input.isRead }
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
