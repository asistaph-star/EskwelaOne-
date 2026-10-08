import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { 
  getDocumentRequestsByStudent, 
  listDocumentRequests, 
  createStudentServicesDocRequest 
} from '../modules/document-requests/documentRequests.service.js';
import { createStudentServicesDocRequestSchema } from '../modules/document-requests/documentRequests.schema.js';
import appointmentsRoutes from '../modules/appointments/appointments.routes.js';
import behaviorRoutes from '../modules/behavior/behavior.routes.js';
import guidanceRoutes from '../modules/guidance/guidance.routes.js';
import clinicRecordsRoutes from '../modules/clinic-records/clinicRecords.routes.js';

const router = Router();
router.use(authMiddleware);


router.use('/appointments', appointmentsRoutes);
router.use('/behavior', behaviorRoutes);
router.use('/guidance', guidanceRoutes);

// ─── CLINIC INVENTORY ISOLATION ────────────────────────────
import clinicInventoryRoutes from '../modules/clinic-inventory/clinicInventory.routes.js';
router.use('/clinic/inventory', clinicInventoryRoutes);


// ─── CLINIC ANALYTICS ────────────────────────────────────────

import clinicAnalyticsRoutes from '../modules/clinic-analytics/clinicAnalytics.routes.js';
router.use('/clinic-analytics', clinicAnalyticsRoutes);

// ─── CLINIC RECORDS ISOLATION ─────────────────────────────────
// Mounted after inventory/analytics to prevent route shadowing
router.use('/clinic', clinicRecordsRoutes);

// ─── GUIDANCE ISOLATION ──────────────────────────────────────

// ─── GUIDANCE RECORDS ──────────────────────────────────────────
// Extracted to modules/guidance/guidance.routes.ts

// ─── BEHAVIOR LOGS ───────────────────────────────────────────
// Extracted to modules/behavior/behavior.routes.ts

// ─── DOCUMENT REQUESTS ───────────────────────────────────────────

/**
 * GET /api/student-services/doc-requests/:studentId
 */
router.get('/doc-requests/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const requestedStudentId = req.params.studentId as string;
    
    const records = await getDocumentRequestsByStudent(requestedStudentId, authUser);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});



/**
 * GET /api/student-services/doc-requests
 */
router.get('/doc-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const records = await listDocumentRequests(authUser);
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/student-services/doc-requests
 */
router.post('/doc-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createStudentServicesDocRequestSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const record = await createStudentServicesDocRequest(input, authUser);

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

export default router;
