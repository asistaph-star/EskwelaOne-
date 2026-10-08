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
    let whereClause: any = { student_id: requestedStudentId };

    if (authUser.roles.includes('Student')) {
      const studentProfile = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!studentProfile || studentProfile.id !== requestedStudentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own document requests.');
      }
    } else if (authUser.roles.includes('Teacher')) {
      const teacherProfile = await prisma.teacher.findUnique({ where: { user_id: authUser.id } });
      if (!teacherProfile) throw new AppError(403, 'FORBIDDEN', 'Teacher profile not found.');
      whereClause.teacher_id = teacherProfile.id;
    } else if (!authUser.roles.some(r => ['Admin', 'Principal', 'Registrar'].includes(r))) {
      throw new AppError(403, 'FORBIDDEN', 'Unauthorized role.');
    }

    const rawRecords = await prisma.documentRequest.findMany({
      where: whereClause,
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
    const authUser = (req as any).user as AuthenticatedUser;

    if (authUser.roles.includes('Student')) {
      const studentProfile = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!studentProfile || studentProfile.id !== input.studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only create requests for yourself.');
      }
    } else if (!authUser.roles.some(r => ['Admin', 'Principal', 'Registrar'].includes(r))) {
      throw new AppError(403, 'FORBIDDEN', 'Unauthorized role to create document requests on behalf of students.');
    }

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
