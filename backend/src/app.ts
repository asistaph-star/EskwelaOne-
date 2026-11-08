import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config/env.js';
import { correlationIdMiddleware } from './common/middleware/correlationId.js';
import { errorHandler } from './common/middleware/errorHandler.js';
import authRoutes from './auth/auth.routes.js';
import userRoutes from './users/user.routes.js';
import academicRoutes from './academic/academic.routes.js';
import enrollmentRoutes from './enrollments/enrollment.routes.js';
import gradebookRoutes from './gradebooks/gradebook.routes.js';
import attendanceRoutes from './attendance/attendance.routes.js';
import documentRoutes from './documents/document.routes.js';
import studentServicesRoutes from './student-services/studentServices.routes.js';
import adminRoutes from './admin/admin.routes.js';
import mediaRoutes from './admin/media.routes.js';
import principalRoutes from './principal/principal.routes.js';
import aiRoutes from './ai/ai.routes.js';
import studentSupportRoutes from './modules/student-support/studentSupport.routes.js';
import settingsRoutes from './settings/settings.routes.js';
import auditRoutes from './audit/audit.routes.js';
import securityOverviewRoutes from './security/securityOverview.routes.js';
import systemHealthRoutes from './health/systemHealth.routes.js';
import rolesPermissionsRoutes from './security/rolesPermissions.routes.js';
import backupStatusRoutes from './backup/backupStatus.routes.js';

import { initMediaStorage, getBrandingStoragePath } from './config/storage.config.js';
import { securityHeaders } from './common/middleware/securityHeaders.js';

// Initialize required directories
initMediaStorage();

const app = express();

// ─── Security Headers ───────────────────────────────────────
app.use(securityHeaders);

// ─── Global Middleware ──────────────────────────────────────
app.use(cors({
  origin: [config.corsOrigin, 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(correlationIdMiddleware);

// ─── Storage Access Boundary (Phase H.0 Hardening) ──────────
// Only public school branding assets (/storage/branding/*) are publicly served.
// Private storage directories (/storage/documents/*, /storage/leaves/*, /storage/chatgpt/*)
// are strictly blocked from direct static access and must go through authenticated API routes.
const PUBLIC_BRANDING_DIR = getBrandingStoragePath();
app.use(
  '/storage/branding',
  (req, res, next) => {
    let rawUrl = '';
    try {
      rawUrl = decodeURIComponent(req.url || '');
    } catch {
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Malformed branding asset path.' },
      });
      return;
    }

    const segments = (req.path || '').split('/').filter(Boolean);
    if (
      rawUrl.includes('..') ||
      rawUrl.includes('\\') ||
      rawUrl.includes('\0') ||
      segments.length !== 1 ||
      segments[0].startsWith('.')
    ) {
      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Invalid branding asset path.' },
      });
      return;
    }
    next();
  },
  express.static(PUBLIC_BRANDING_DIR, {
    dotfiles: 'deny',
    index: false,
    fallthrough: true,
  }),
  (_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Branding asset not found.' },
    });
  }
);

app.use('/storage', (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Direct access to private storage is forbidden.',
    },
  });
});

app.use('/backups', (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Direct access to server backup archives is forbidden.',
    },
  });
});

app.use('/quarantine', (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Direct access to server quarantine archives is forbidden.',
    },
  });
});

// ─── Health Check & Root Status ──────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'DigiSkwela Backend API is running.',
    environment: config.nodeEnv,
    health: '/api/health',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

// ─── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/gradebooks', gradebookRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/student-services', studentServicesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/principal', principalRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/student-support', studentSupportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin/audit-logs', auditRoutes);
app.use('/api/admin/security-overview', securityOverviewRoutes);
app.use('/api/admin/system-health', systemHealthRoutes);
app.use('/api/admin/roles-permissions', rolesPermissionsRoutes);
app.use('/api/admin/backup-status', backupStatusRoutes);

// ─── 404 Handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist.' },
  });
});

// ─── Global Error Handler ───────────────────────────────────
app.use(errorHandler);

export default app;
