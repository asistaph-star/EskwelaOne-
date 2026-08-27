import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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

const app = express();

// ─── Global Middleware ──────────────────────────────────────
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(correlationIdMiddleware);

// ─── Health Check ───────────────────────────────────────────
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
