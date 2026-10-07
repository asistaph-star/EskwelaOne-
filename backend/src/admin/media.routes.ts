import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/middleware/errorHandler.js';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import fs from 'fs';

import { getMediaStoragePath } from '../config/storage.config.js';

const STORAGE_DIR = getMediaStoragePath();

// Separate upload limits for media: allow up to 50MB (useful for short MP4 videos).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

const router = Router();

// ----- PUBLIC / GATE KIOSK ROUTES ----- //

/**
 * GET /api/media/gate/playlist
 * Returns the currently active campus media playlist.
 */
router.get('/gate/playlist', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const hasAccess = authUser.roles.includes('GateOperator') || authUser.roles.includes('Admin') || authUser.roles.includes('ITAdmin') || authUser.permissions.includes('campus_media:read');
    if (!hasAccess) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to read the campus media playlist.');
    }

    const media = await prisma.campusMedia.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      include: { document: true }
    });

    const playlist = media.map(m => ({
      id: m.id,
      title: m.title,
      type: m.media_type,
      durationMs: m.duration_ms,
      order: m.sort_order,
      // Provide a direct serve URL (requires auth cookie)
      url: `/api/media/gate/serve/${m.document_id}`
    }));

    res.json({ success: true, data: playlist });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/media/gate/serve/:documentId
 * Securely serves the actual MP4/JPEG/PNG file for the media player.
 * Uses HTTP Range natively for videos.
 */
router.get('/gate/serve/:documentId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documentId = String(req.params.documentId);
    const authUser = (req as any).user as AuthenticatedUser;
    
    const hasAccess = authUser.roles.includes('GateOperator') || authUser.roles.includes('Admin') || authUser.roles.includes('ITAdmin') || authUser.permissions.includes('campus_media:read');
    if (!hasAccess) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view campus media.');
    }

    const media = await prisma.campusMedia.findUnique({
      where: { document_id: documentId },
      include: { document: true }
    });

    if (!media) {
      throw new AppError(404, 'NOT_FOUND', 'Media not found.');
    }

    const filePath = path.join(STORAGE_DIR, media.document.storage_key);
    if (!fs.existsSync(filePath)) {
      throw new AppError(404, 'NOT_FOUND', 'File not found on disk.');
    }

    res.setHeader('Content-Type', media.document.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${media.document.filename}"`);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});


// ----- ADMIN ROUTES ----- //
const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(requirePermissions('campus_media:manage'));

/**
 * GET /api/media/admin
 * List all media (active and inactive) for the management UI.
 */
adminRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const media = await prisma.campusMedia.findMany({
      orderBy: { sort_order: 'asc' },
      include: { document: true }
    });
    res.json({ success: true, data: media });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/media/admin/upload
 * Validates and uploads a new media file (image/video).
 */
adminRouter.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'BAD_REQUEST', 'No file provided.');

    const title = req.body.title || 'Untitled Media';
    let durationMs = parseInt(req.body.durationMs, 10);
    if (isNaN(durationMs)) durationMs = 8000; // default 8s for images

    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const fileType = await fileTypeFromBuffer(file.buffer);
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4'];
    
    if (!fileType || (!allowedImageTypes.includes(fileType.mime) && !allowedVideoTypes.includes(fileType.mime))) {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid file type. Only JPEG, PNG, WebP, and MP4 are allowed.');
    }

    const mediaType = allowedVideoTypes.includes(fileType.mime) ? 'video' : 'image';

    const storageKey = `media_${generateId()}${fileType.ext ? '.' + fileType.ext : ''}`;
    const filePath = path.join(STORAGE_DIR, storageKey);
    fs.writeFileSync(filePath, file.buffer);

    const campusMedia = await prisma.$transaction(async (tx) => {
      const documentRecord = await tx.document.create({
        data: {
          id: generateId(),
          storage_key: storageKey,
          filename: file.originalname,
          mime_type: fileType.mime,
          size_bytes: file.size,
          uploaded_by: authUser.id,
        }
      });

      const maxOrderResult = await tx.campusMedia.aggregate({
        _max: { sort_order: true }
      });
      const nextOrder = (maxOrderResult._max.sort_order ?? 0) + 1;

      return await tx.campusMedia.create({
        data: {
          id: generateId(),
          title,
          media_type: mediaType,
          is_active: true,
          sort_order: nextOrder,
          duration_ms: mediaType === 'image' ? durationMs : null,
          document_id: documentRecord.id,
          created_by_id: authUser.id
        },
        include: { document: true }
      });
    });

    await createAuditLog({
      actorUserId: authUser.id,
      action: 'CAMPUS_MEDIA_CREATED',
      resourceType: 'campus_media',
      resourceId: campusMedia.id,
      newState: { title: campusMedia.title, type: campusMedia.media_type },
      correlationId,
    });

    res.status(201).json({ success: true, data: campusMedia });
  } catch (err) {
    next(err);
  }
});

const updateMediaSchema = z.object({
  title: z.string().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().optional(),
  duration_ms: z.number().nullable().optional()
});

const reorderMediaSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      sortOrder: z.number().int().min(1)
    })
  )
});

/**
 * PATCH /api/media/admin/reorder
 * Reorder multiple media items at once (atomic transaction).
 */
adminRouter.patch('/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = reorderMediaSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    // Reject duplicates
    const uniqueIds = new Set(items.map(i => i.id));
    if (uniqueIds.size !== items.length) {
      throw new AppError(400, 'BAD_REQUEST', 'Duplicate media IDs provided.');
    }

    const ids = items.map(i => i.id);
    const existing = await prisma.campusMedia.findMany({
      where: { id: { in: ids } }
    });

    if (existing.length !== ids.length) {
      throw new AppError(400, 'BAD_REQUEST', 'One or more media items not found.');
    }

    // Sort by provided sortOrder, then normalize to 1, 2, 3...
    const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < sortedItems.length; i++) {
        await tx.campusMedia.update({
          where: { id: sortedItems[i].id },
          data: { sort_order: i + 1 }
        });
      }
    });

    await createAuditLog({
      actorUserId: authUser.id,
      action: 'CAMPUS_MEDIA_REORDERED',
      resourceType: 'campus_media',
      resourceId: 'batch',
      correlationId,
    });

    res.json({ success: true, message: 'Media reordered successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/media/admin/:id
 * Update media properties (active state, order, title, etc).
 */
adminRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const input = updateMediaSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const existing = await prisma.campusMedia.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Media not found.');

    const updated = await prisma.campusMedia.update({
      where: { id },
      data: input
    });

    await createAuditLog({
      actorUserId: authUser.id,
      action: 'CAMPUS_MEDIA_UPDATED',
      resourceType: 'campus_media',
      resourceId: updated.id,
      newState: input,
      correlationId,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/media/admin/:id
 * Safely deletes the CampusMedia row, the associated Document row, and the physical file.
 */
adminRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const authUser = (req as any).user as AuthenticatedUser;
    const correlationId = (req as any).correlationId;

    const media = await prisma.campusMedia.findUnique({
      where: { id },
      include: { document: true }
    });

    if (!media) {
      throw new AppError(404, 'NOT_FOUND', 'Media not found.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.campusMedia.delete({ where: { id } });
      await tx.document.delete({ where: { id: media.document_id } });

      // Normalize remaining order
      const remaining = await tx.campusMedia.findMany({
        orderBy: { sort_order: 'asc' }
      });
      for (let i = 0; i < remaining.length; i++) {
        await tx.campusMedia.update({
          where: { id: remaining[i].id },
          data: { sort_order: i + 1 }
        });
      }
    });

    const filePath = path.join(STORAGE_DIR, media.document.storage_key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await createAuditLog({
      actorUserId: authUser.id,
      action: 'CAMPUS_MEDIA_DELETED',
      resourceType: 'campus_media',
      resourceId: media.id,
      correlationId,
    });

    res.json({ success: true, message: 'Media deleted safely.' });
  } catch (err) {
    next(err);
  }
});

router.use('/admin', adminRouter);

export default router;
