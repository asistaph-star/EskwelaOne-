import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { generateId } from '../common/utils/uuid.js';
import {
  getOrCreateSchoolSettings,
  getPublicSchoolSettings,
  updateSchoolSettings,
  resetSchoolSettings,
} from './settings.service.js';
import { updateSchoolSettingsSchema } from './settings.schema.js';
import { createAuditLog } from '../audit/audit.service.js';

const router = Router();

// Ensure storage/branding directory exists
const BRANDING_DIR = path.join(process.cwd(), 'storage', 'branding');
if (!fs.existsSync(BRANDING_DIR)) {
  fs.mkdirSync(BRANDING_DIR, { recursive: true });
}

// Bounded multer memory storage for branding asset uploads (max 10MB)
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── PUBLIC ENDPOINTS ──────────────────────────────────────────────────────────

/**
 * GET /api/settings/school/public
 * Unauthenticated endpoint providing non-sensitive branding presentation fields for login/portal shell.
 */
router.get('/school/public', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const publicSettings = await getPublicSchoolSettings();
    res.json({ success: true, data: publicSettings });
  } catch (err) {
    next(err);
  }
});

// ─── AUTHENTICATED ENDPOINTS ──────────────────────────────────────────────────

/**
 * GET /api/settings/school
 * Authenticated endpoint to inspect full school settings.
 * Accessible to ITAdmin and standard Admin.
 */
router.get('/school', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const canRead =
      authUser.roles?.includes('ITAdmin') ||
      authUser.roles?.includes('Admin') ||
      authUser.permissions?.includes('system_settings:read');

    if (!canRead) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view school settings.');
    }

    const settings = await getOrCreateSchoolSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/settings/school
 * Authenticated and strictly authorized endpoint to update school customization.
 * Strictly limited to ITAdmin.
 */
router.patch('/school', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const canWrite =
      authUser.roles?.includes('ITAdmin') ||
      authUser.permissions?.includes('system_settings:write');

    if (!canWrite) {
      createAuditLog({
        actorUserId: authUser.id,
        actorSchoolId: authUser.schoolId,
        actorRole: authUser.roles[0] || 'User',
        action: 'AUTH_FORBIDDEN',
        category: 'SECURITY',
        resourceType: 'school_settings',
        resourceId: 'default',
        targetLabel: 'School Customization Settings',
        result: 'DENIED',
        reason: 'Unauthorized modification attempt on school settings',
        correlationId: (req as any).correlationId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'] as string | undefined,
      }).catch(() => {});
      throw new AppError(403, 'FORBIDDEN', 'Only IT Administrators are authorized to modify school customization settings.');
    }

    const validatedInput = updateSchoolSettingsSchema.parse(req.body);
    const correlationId = (req as any).correlationId;

    const updated = await updateSchoolSettings(validatedInput, authUser.id, correlationId, {
      actorSchoolId: authUser.schoolId,
      actorRole: authUser.roles[0] || 'User',
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json({ success: true, data: updated, message: 'School settings updated successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/settings/school/reset
 * Restores default visual branding & presentation settings.
 * White-label safe: Preserves institutional identity.
 * Strictly limited to ITAdmin.
 */
router.post('/school/reset', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const canWrite =
      authUser.roles?.includes('ITAdmin') ||
      authUser.permissions?.includes('system_settings:write');

    if (!canWrite) {
      createAuditLog({
        actorUserId: authUser.id,
        actorSchoolId: authUser.schoolId,
        actorRole: authUser.roles[0] || 'User',
        action: 'AUTH_FORBIDDEN',
        category: 'SECURITY',
        resourceType: 'school_settings',
        resourceId: 'default',
        targetLabel: 'School Visual Branding',
        result: 'DENIED',
        reason: 'Unauthorized reset attempt on school branding',
        correlationId: (req as any).correlationId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'] as string | undefined,
      }).catch(() => {});
      throw new AppError(403, 'FORBIDDEN', 'Only IT Administrators are authorized to restore default branding settings.');
    }

    const correlationId = (req as any).correlationId;
    const reset = await resetSchoolSettings(authUser.id, correlationId, {
      actorSchoolId: authUser.schoolId,
      actorRole: authUser.roles[0] || 'User',
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
    res.json({ success: true, data: reset, message: 'Default branding settings restored successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/settings/school/upload
 * Uploads a school branding asset (logo, favicon, or login background).
 * Strictly limited to ITAdmin.
 */
router.post(
  '/school/upload',
  authMiddleware,
  assetUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = (req as any).user as AuthenticatedUser;
      const canWrite =
        authUser.roles?.includes('ITAdmin') ||
        authUser.permissions?.includes('system_settings:write');

      if (!canWrite) {
        throw new AppError(403, 'FORBIDDEN', 'Only IT Administrators are authorized to upload school branding assets.');
      }

      const file = req.file;
      if (!file) {
        throw new AppError(400, 'BAD_REQUEST', 'No asset file provided.');
      }

      const assetType = (req.body.assetType || req.body.type || 'logo').toLowerCase();
      if (!['logo', 'favicon', 'background'].includes(assetType)) {
        throw new AppError(400, 'BAD_REQUEST', 'Invalid assetType. Allowed values: logo, favicon, background.');
      }

      // Validate magic bytes
      const detectedType = await fileTypeFromBuffer(file.buffer);
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
      const allowedFaviconMimes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/jpeg'];

      const allowedMimes = assetType === 'favicon' ? allowedFaviconMimes : allowedImageMimes;

      // Note: Some valid .ico files may not be detected by file-type if legacy bitmap; check mime/ext fallback
      const mime = detectedType ? detectedType.mime : file.mimetype;
      const isAllowed = allowedMimes.includes(mime) || (assetType === 'favicon' && file.originalname.endsWith('.ico'));

      if (!isAllowed) {
        throw new AppError(
          400,
          'BAD_REQUEST',
          `Invalid file format for ${assetType}. Allowed formats: ${allowedMimes.join(', ')}.`
        );
      }

      const ext = detectedType?.ext || (assetType === 'favicon' ? 'ico' : 'png');
      const filename = `branding_${assetType}_${generateId()}.${ext}`;
      const filePath = path.join(BRANDING_DIR, filename);

      fs.writeFileSync(filePath, file.buffer);

      const publicUrl = `/storage/branding/${filename}`;

      await createAuditLog({
        actorUserId: authUser.id,
        actorSchoolId: authUser.schoolId,
        actorRole: authUser.roles[0] || 'User',
        action: 'BRANDING_ASSET_UPLOADED',
        category: 'CONFIGURATION',
        resourceType: 'school_settings',
        resourceId: 'default',
        targetLabel: `Branding Asset: ${assetType} (${file.originalname})`,
        result: 'SUCCESS',
        newState: {
          assetType,
          filename,
          sizeBytes: file.size,
          url: publicUrl,
        },
        correlationId: (req as any).correlationId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'] as string | undefined,
      });

      res.status(201).json({
        success: true,
        data: {
          url: publicUrl,
          assetType,
          sizeBytes: file.size,
          filename,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
