import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/middleware/errorHandler.js';
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

// Inventory schema
const clinicInventorySchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.number().int().min(0),
  unit: z.string().min(1),
  expiry_date: z.string().datetime().optional().nullable(),
  reorder_level: z.number().int().min(0).optional().nullable()
});

const consumeInventorySchema = z.object({
  quantity: z.number().int().positive(),
  reason: z.string().min(1)
});

/**
 * GET /api/student-services/clinic/inventory
 */
router.get('/clinic/inventory', requirePermissions('clinic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { location: 'Clinic' }, // Authoritative Clinic scope
      include: {
        updates: {
          orderBy: { created_at: 'desc' },
          include: {
            user: { select: { first_name: true, last_name: true, id: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/student-services/clinic/inventory
 */
router.post('/clinic/inventory', requirePermissions('clinic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = clinicInventorySchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    
    // Server-side scope enforcement
    if (!['Medicine', 'Supplies', 'Equipment'].includes(input.category)) {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid clinic category.');
    }

    const itemId = generateId();
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          id: itemId,
          name: input.name,
          category: input.category,
          description: input.description || null,
          quantity: input.quantity,
          unit: input.unit,
          expiry_date: input.expiry_date ? new Date(input.expiry_date) : null,
          reorder_level: input.reorder_level ?? null,
          condition: 'Good',
          location: 'Clinic', // FORCED server-side
          status: 'Good',
        }
      });
      
      await tx.inventoryUpdate.create({
        data: {
          id: generateId(),
          item_id: itemId,
          user_id: authUser.id,
          action: 'Added',
          details: `Initial stock: ${input.quantity} ${input.unit}`
        }
      });
      
      return item;
    });
    
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/student-services/clinic/inventory/:id/use
 */
router.post('/clinic/inventory/:id/use', requirePermissions('clinic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const { quantity, reason } = consumeInventorySchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;

    const result = await prisma.$transaction(async (tx) => {
      // Fetch with row lock (if supported, or rely on Prisma atomicity)
      const existing = await tx.inventoryItem.findUnique({ where: { id } });
      
      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'Item not found');
      }
      
      // Strict Clinic Scope Verification (ID Tampering test)
      if (existing.location !== 'Clinic') {
        throw new AppError(403, 'FORBIDDEN', 'Access denied to non-clinic inventory.');
      }
      
      if (existing.quantity < quantity) {
        throw new AppError(400, 'BAD_REQUEST', 'Insufficient stock.');
      }

      // Atomically decrement
      const updatedItem = await tx.inventoryItem.update({
        where: { id },
        data: { quantity: { decrement: quantity } }
      });
      
      await tx.inventoryUpdate.create({
        data: {
          id: generateId(),
          item_id: id,
          user_id: authUser.id,
          action: 'Stock Consumed',
          details: `Used ${quantity} ${existing.unit}. Reason: ${reason}`
        }
      });
      
      return updatedItem;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

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
    const rawRecords = await prisma.documentRequest.findMany({
      where: { student_id: req.params.studentId as string },
      include: { principal: true },
      orderBy: { submitted_date: 'desc' }
    });
    const records = rawRecords.map(r => ({
      ...r,
      principalName: r.principal ? `${r.principal.first_name} ${r.principal.last_name}` : r.principal_id
    }));
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

const createDocRequestSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  section: z.string(),
  documentType: z.string(),
  purpose: z.string(),
  teacherId: z.string().optional(),
});

/**
 * GET /api/student-services/doc-requests
 */
router.get('/doc-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    let whereClause = {};
    
    if (authUser.roles.includes('Student')) {
      const studentProfile = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!studentProfile) return res.json({ success: true, data: [] });
      whereClause = { student_id: studentProfile.id };
    } else if (authUser.roles.includes('Teacher')) {
      const teacherProfile = await prisma.teacher.findUnique({ where: { user_id: authUser.id } });
      if (!teacherProfile) return res.json({ success: true, data: [] });
      whereClause = { teacher_id: teacherProfile.id };
    } else if (!authUser.roles.some(r => ['Admin', 'Principal', 'Registrar'].includes(r))) {
      // Unrecognized role for doc requests
      return res.json({ success: true, data: [] });
    }

    const rawRecords = await prisma.documentRequest.findMany({
      where: whereClause,
      include: {
        student: { include: { user: true, current_section: true } },
        teacher: { include: { user: true } },
        principal: true,
        attached_document: true,
      },
      orderBy: { created_at: 'desc' }
    });

    const records = rawRecords.map(r => ({
      ...r,
      id: r.id,
      studentId: r.student_id,
      studentName: r.student ? `${r.student.user.first_name} ${r.student.user.last_name}` : 'Unknown',
      section: r.student?.current_section ? r.student.current_section.name : 'Unknown',
      documentType: r.document_type,
      purpose: r.purpose,
      status: r.status,
      currentStage: r.current_stage,
      submittedDate: r.submitted_date.toISOString(),
      
      teacherId: r.teacher_id,
      teacherName: r.teacher ? `${r.teacher.user.first_name} ${r.teacher.user.last_name}` : undefined,
      teacherApprovedDate: r.teacher_approved_date?.toISOString(),
      teacherRemarks: r.teacher_remarks,
      
      principalId: r.principal_id,
      principalName: r.principal ? `${r.principal.first_name} ${r.principal.last_name}` : undefined,
      principalApprovedDate: r.principal_approved_date?.toISOString(),
      principalRemarks: r.principal_remarks,
      
      readyDate: r.ready_date?.toISOString(),
      attachedDocumentId: r.attached_document_id
    }));
    
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
    const input = createDocRequestSchema.parse(req.body);

    const record = await prisma.documentRequest.create({
      data: {
        id: generateId(),
        student_id: input.studentId,
        document_type: input.documentType,
        purpose: input.purpose,
        status: 'Submitted',
        current_stage: 1,
        teacher_id: input.teacherId
      }
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

export default router;
