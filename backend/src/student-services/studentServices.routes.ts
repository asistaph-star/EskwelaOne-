import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/middleware/errorHandler.js';
const router = Router();
router.use(authMiddleware);

const parseTime = (timeStr?: string) => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  const hh = parts[0].padStart(2, '0');
  const mm = parts[1].padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  return new Date(`1970-01-01T${hh}:${mm}:${ss}.000Z`);
};

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

router.get('/clinic-analytics', requirePermissions('clinic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
    const rawReferrals = await prisma.clinicReferral.findMany({
      where: { date: { gte: fiveDaysAgo } },
      select: { date: true, diagnosis: true, time: true }
    });
    
    // 1. Trend Chart (last 5 days visit counts)
    const trendMap = new Map<string, number>();
    for (let i = 4; i >= 0; i--) {
       const d = new Date(Date.now() - i * 86400000);
       const dStr = d.toISOString().split('T')[0];
       trendMap.set(dStr, 0);
    }
    
    rawReferrals.forEach(r => {
      const dStr = typeof r.date === 'string' ? r.date : (r.date as Date).toISOString().split('T')[0];
      if (trendMap.has(dStr)) trendMap.set(dStr, trendMap.get(dStr)! + 1);
    });
    const trend = Array.from(trendMap.entries()).map(([date, visits]) => ({ date, visits }));

    // 2. Top Diagnosis
    const diagCount: Record<string, number> = {};
    rawReferrals.forEach(r => {
      if (r.diagnosis) diagCount[r.diagnosis] = (diagCount[r.diagnosis] || 0) + 1;
    });
    const sortedDiags = Object.entries(diagCount).sort((a,b) => b[1] - a[1]);
    const topDiagnosis = sortedDiags.length > 0 ? sortedDiags[0][0] : "None";
    const topDiagPercent = sortedDiags.length > 0 ? Math.round((sortedDiags[0][1] / rawReferrals.length) * 100) : 0;

    // 3. Peak Hours
    const hourCount: Record<string, number> = {};
    rawReferrals.forEach(r => {
      if (r.time) {
        const d = new Date(r.time);
        const hour = d.getUTCHours();
        const slot = `${hour.toString().padStart(2, '0')}:00 - ${(hour+1).toString().padStart(2, '0')}:00`;
        hourCount[slot] = (hourCount[slot] || 0) + 1;
      }
    });
    const sortedHours = Object.entries(hourCount).sort((a,b) => b[1] - a[1]);
    const peakHour = sortedHours.length > 0 ? sortedHours[0][0] : "None";

    // 4. Inventory Low Stock Warning (calculate burn rate for top low items)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    
    // Find items that are medicines/supplies
    const items = await prisma.inventoryItem.findMany({
      where: { category: { in: ['Medicine', 'Supplies'] }, quantity: { gt: 0 } },
      select: { id: true, name: true, quantity: true, reorder_level: true, updates: {
        where: { created_at: { gte: sevenDaysAgo }, action: 'Quantity adjusted' },
        select: { details: true, created_at: true }
      } }
    });
    
    // Estimate days until empty based on updates
    const inventoryWarnings = items.map(item => {
      let used = 0;
      // In the mock update, details is "Given to student for headache" or "Stock adjusted from X to Y"
      // If we had a rigorous quantity_changed field, it would be easier. For now, just flag low stock.
      const isLow = item.quantity <= (item.reorder_level || 0);
      return isLow ? { name: item.name, stock: item.quantity, reorder: item.reorder_level } : null;
    }).filter(i => i !== null);
    
    res.json({ success: true, data: { trend, topDiagnosis, topDiagPercent, peakHour, inventoryWarnings } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/student-services/clinic/:studentId
 * Strict isolation: Clinic records must not be exposed to general staff.
 */
router.get('/clinic/:studentId', requirePermissions('clinic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user as AuthenticatedUser;
    
    // Defense-in-depth: If the user is a Student, they MUST only be able to request their own ID.
    if (user.roles.includes('Student')) {
      const studentProfile = await prisma.student.findUnique({ where: { user_id: user.id } });
      if (!studentProfile || studentProfile.id !== req.params.studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own clinic records.');
      }
    }

    const rawRecords = await prisma.clinicReferral.findMany({
      where: { student_id: req.params.studentId as string },
      include: {
        recorder: true,
      },
      orderBy: { date: 'desc' }
    });
    
    const records = rawRecords.map(r => ({
      ...r,
      studentId: r.student_id,
      date: typeof r.date === 'string' ? r.date : (r.date as Date).toISOString().split('T')[0],
      time: r.time ? (typeof r.time === 'string' ? r.time : (r.time as Date).toISOString().split('T')[1].substring(0,5)) : '',
      recorded_by: r.recorder ? `${r.recorder.first_name} ${r.recorder.last_name}` : r.recorded_by
    }));
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/student-services/clinic
 * Returns global clinic records (recent 100). Nurse dashboard.
 */
router.get('/clinic', requirePermissions('clinic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRecords = await prisma.clinicReferral.findMany({
      include: {
        recorder: true,
      },
      orderBy: { date: 'desc' },
      take: 100
    });
    
    const records = rawRecords.map(r => ({
      ...r,
      studentId: r.student_id,
      date: typeof r.date === 'string' ? r.date : (r.date as Date).toISOString().split('T')[0],
      time: r.time ? (typeof r.time === 'string' ? r.time : (r.time as Date).toISOString().split('T')[1].substring(0,5)) : '',
      recorded_by: r.recorder ? `${r.recorder.first_name} ${r.recorder.last_name}` : r.recorded_by
    }));
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

const createClinicRecordSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be HH:mm or HH:mm:ss').optional(),
  symptoms: z.string().optional(),
  diagnosis: z.string().optional(),
  medications: z.string().optional(),
  treatments: z.string().optional(),
  notes: z.string().optional(),
  temperature: z.coerce.number().optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.string().optional(),
});

router.post('/clinic', requirePermissions('clinic:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createClinicRecordSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    const record = await prisma.clinicReferral.create({
      data: {
        id: generateId(),
        student_id: input.studentId,
        date: new Date(input.date),
        time: parseTime(input.time),
        symptoms: input.symptoms,
        diagnosis: input.diagnosis,
        medications: input.medications,
        treatments: input.treatments,
        notes: input.notes,
        temperature: input.temperature,
        blood_pressure: input.bloodPressure,
        heart_rate: input.heartRate,
        recorded_by: actorId,
      }
    });

    await createAuditLog({
      actorUserId: actorId,
      action: 'CLINIC_RECORD_CREATED',
      resourceType: 'clinic_record',
      resourceId: record.id,
      newState: { studentId: input.studentId, symptoms: input.symptoms }, // omitted vitals from audit for privacy
      correlationId,
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

// ─── GUIDANCE ISOLATION ──────────────────────────────────────

/**
 * GET /api/student-services/guidance
 */
router.get('/guidance', requirePermissions('guidance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRecords = await prisma.guidanceRecord.findMany({
      include: { counselor: true, student: { include: { user: true } } },
      orderBy: { date: 'desc' },
      take: 100
    });
    const records = rawRecords.map(r => ({
      ...r,
      counselor_name: r.counselor ? `${r.counselor.first_name} ${r.counselor.last_name}` : r.counselor_id,
      studentName: r.student ? `${r.student.user.first_name} ${r.student.user.last_name}` : r.student_id
    }));
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/student-services/guidance/:studentId
 */
router.get('/guidance/:studentId', requirePermissions('guidance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRecords = await prisma.guidanceRecord.findMany({
      where: { student_id: req.params.studentId as string },
      include: { counselor: true },
      orderBy: { date: 'desc' }
    });
    const records = rawRecords.map(r => ({
      ...r,
      counselor_name: r.counselor ? `${r.counselor.first_name} ${r.counselor.last_name}` : r.counselor_id
    }));
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

const createGuidanceSchema = z.object({
  studentId: z.string(),
  date: z.string(),
  type: z.string(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  actionTaken: z.string().optional(),
  followUpDate: z.string().optional(),
  status: z.string().optional(),
});

router.post('/guidance', requirePermissions('guidance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createGuidanceSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const actorId = authUser.id;

    const record = await prisma.guidanceRecord.create({
      data: {
        id: generateId(),
        student_id: input.studentId,
        counselor_id: actorId,
        date: new Date(input.date),
        type: input.type,
        reason: input.reason,
        notes: input.notes,
        action_taken: input.actionTaken,
        follow_up_date: input.followUpDate ? new Date(input.followUpDate) : null,
        status: input.status || 'Open'
      }
    });

    const correlationId = (req as any).correlationId;
    await createAuditLog({
      actorUserId: actorId,
      action: 'GUIDANCE_RECORD_CREATED',
      resourceType: 'guidance_record',
      resourceId: record.id,
      newState: { studentId: input.studentId, type: input.type },
      correlationId,
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.patch('/guidance/:id/status', requirePermissions('guidance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const { status } = req.body;
    const recordId = req.params.id;

    const existing = await prisma.guidanceRecord.findUnique({ where: { id: recordId as string } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Guidance record not found.');

    const isGlobalViewer = authUser.roles.some(r => ['Admin', 'Principal'].includes(r));
    if (!isGlobalViewer && existing.counselor_id !== authUser.id) {
       throw new AppError(403, 'FORBIDDEN', 'You can only update your own records.');
    }

    const record = await prisma.guidanceRecord.update({
      where: { id: recordId as string },
      data: { status }
    });

    const correlationId = (req as any).correlationId as string;
    await createAuditLog({
      actorUserId: authUser.id,
      action: 'GUIDANCE_RECORD_UPDATED',
      resourceType: 'guidance_record',
      resourceId: record.id,
      previousState: { status: existing.status },
      newState: { status: record.status },
      correlationId,
    });

    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

// ─── BEHAVIOR LOGS ───────────────────────────────────────────

router.get('/behavior', requirePermissions('guidance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRecords = await prisma.behaviorLog.findMany({
      include: { reporter: true, student: { include: { user: true } } },
      orderBy: { date: 'desc' },
      take: 100
    });
    const records = rawRecords.map(r => ({
      ...r,
      reporter_name: r.reporter ? `${r.reporter.first_name} ${r.reporter.last_name}` : r.reported_by,
      studentName: r.student ? `${r.student.user.first_name} ${r.student.user.last_name}` : r.student_id
    }));
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

router.get('/behavior/:studentId', requirePermissions('guidance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRecords = await prisma.behaviorLog.findMany({
      where: { student_id: req.params.studentId as string },
      include: { reporter: true },
      orderBy: { date: 'desc' }
    });
    const records = rawRecords.map(r => ({
      ...r,
      reporter_name: r.reporter ? `${r.reporter.first_name} ${r.reporter.last_name}` : r.reported_by
    }));
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

const createBehaviorSchema = z.object({
  studentId: z.string(),
  type: z.string(),
  date: z.string(),
  status: z.string().optional(),
  note: z.string().optional(),
});

router.post('/behavior', requirePermissions('guidance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createBehaviorSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const actorId = authUser.id;

    const record = await prisma.behaviorLog.create({
      data: {
        id: generateId(),
        student_id: input.studentId,
        type: input.type,
        date: new Date(input.date),
        status: input.status || 'Reported',
        note: input.note,
        reported_by: actorId
      }
    });

    const correlationId = (req as any).correlationId;
    await createAuditLog({
      actorUserId: actorId,
      action: 'BEHAVIOR_LOG_CREATED',
      resourceType: 'behavior_log',
      resourceId: record.id,
      newState: { studentId: input.studentId, type: input.type },
      correlationId,
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.patch('/behavior/:id/status', requirePermissions('guidance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const { status } = req.body;
    const recordId = req.params.id;

    const existing = await prisma.behaviorLog.findUnique({ where: { id: recordId as string } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Behavior log not found.');

    const isGlobalViewer = authUser.roles.some(r => ['Admin', 'Principal'].includes(r));
    if (!isGlobalViewer && existing.reported_by !== authUser.id) {
       throw new AppError(403, 'FORBIDDEN', 'You can only update your own reports.');
    }

    const record = await prisma.behaviorLog.update({
      where: { id: recordId as string },
      data: { status }
    });

    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

// ─── APPOINTMENTS ──────────────────────────────────────────────

/**
 * GET /api/student-services/appointments/me
 * Teacher or Guidance fetching their own appointments
 */
router.get('/appointments/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    
    if (!authUser.roles.includes('Teacher') && !authUser.roles.includes('Admin') && !authUser.roles.includes('Guidance')) {
       throw new AppError(403, 'FORBIDDEN', 'Only teachers, guidance, and admins can access this endpoint.');
    }

    let records = [];
    if (authUser.roles.includes('Teacher')) {
      const teacher = await prisma.teacher.findUnique({ where: { user_id: authUser.id } });
      if (!teacher) throw new AppError(403, 'FORBIDDEN', 'Teacher profile not found.');
      records = await prisma.appointment.findMany({
        where: { teacher_id: teacher.id },
        include: { student: { include: { user: true } }, teacher: { include: { user: true } } },
        orderBy: { date: 'desc' }
      });
    } else if (authUser.roles.includes('Guidance')) {
      const staff = await prisma.staff.findUnique({ where: { user_id: authUser.id } });
      if (!staff) throw new AppError(403, 'FORBIDDEN', 'Staff profile not found.');
      records = await prisma.appointment.findMany({
        where: { staff_id: staff.id },
        include: { student: { include: { user: true } }, staff: { include: { user: true } } },
        orderBy: { date: 'desc' }
      });
    } else {
      throw new AppError(403, 'FORBIDDEN', 'You must have a Teacher or Staff profile.');
    }

    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/student-services/appointments/students
 * Teacher fetching their authorized students (from assigned sections)
 */
router.get('/appointments/students', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    
    if (!authUser.roles.includes('Teacher')) {
       throw new AppError(403, 'FORBIDDEN', 'Only teachers can access this endpoint.');
    }

    const students = await prisma.student.findMany({
      where: {
        current_section: {
          assignments: {
            some: { teacher: { user_id: authUser.id } }
          }
        }
      },
      include: {
        user: true,
        current_section: true
      },
      distinct: ['id']
    });

    res.json({ success: true, data: students });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/student-services/appointments/:studentId
 */
router.get('/appointments/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const studentId = req.params.studentId as string;
    
    if (authUser.roles.includes('Student')) {
      const student = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!student || student.id !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own appointments.');
      }
    }

    const records = await prisma.appointment.findMany({
      where: { student_id: req.params.studentId as string },
      include: { 
        teacher: { include: { user: true } },
        staff: { include: { user: true } },
        student: { include: { user: true } }
      }, 
      orderBy: { date: 'desc' }
    });
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

const createAppointmentSchema = z.object({
  studentId: z.string().optional(),
  teacherId: z.string().optional(),
  staffId: z.string().optional(),
  date: z.string(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be HH:mm or HH:mm:ss'),
  purpose: z.string(),
  parentEmail: z.string().optional(),
});

/**
 * POST /api/student-services/appointments
 */
router.post('/appointments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAppointmentSchema.parse(req.body);
    const authUser = (req as any).user as AuthenticatedUser;
    const actorId = authUser.id;

    let resolvedStudentId = input.studentId;
    let resolvedTeacherId = input.teacherId;
    let resolvedStaffId = input.staffId;
    let direction = 'parent-to-teacher';

    if (authUser.roles.includes('Student')) {
      const student = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!student) throw new AppError(403, 'FORBIDDEN', 'Student profile not found.');
      resolvedStudentId = student.id;
      if (!resolvedTeacherId && !resolvedStaffId) throw new AppError(400, 'BAD_REQUEST', 'teacherId or staffId is required.');
      if (resolvedTeacherId && resolvedStaffId) throw new AppError(400, 'BAD_REQUEST', 'Cannot specify both teacherId and staffId.');
      direction = resolvedStaffId ? 'parent-to-counselor' : 'parent-to-teacher';
    } else if (authUser.roles.includes('Teacher')) {
      const teacher = await prisma.teacher.findUnique({ where: { user_id: authUser.id } });
      if (!teacher) throw new AppError(403, 'FORBIDDEN', 'Teacher profile not found.');
      resolvedTeacherId = teacher.id;
      resolvedStaffId = undefined; // Override client spoofing
      if (!resolvedStudentId) throw new AppError(400, 'BAD_REQUEST', 'studentId is required.');
      direction = 'teacher-to-parent';

      const authorizedStudent = await prisma.student.findFirst({
        where: {
          id: resolvedStudentId,
          current_section: {
            assignments: { some: { teacher_id: teacher.id } }
          }
        }
      });
      if (!authorizedStudent) throw new AppError(403, 'FORBIDDEN', 'Not authorized to create appointment for this student.');
    } else if (authUser.roles.includes('Guidance')) {
      const staff = await prisma.staff.findUnique({ where: { user_id: authUser.id } });
      if (!staff) throw new AppError(403, 'FORBIDDEN', 'Staff profile not found.');
      resolvedStaffId = staff.id;
      resolvedTeacherId = undefined; // Override client spoofing
      if (!resolvedStudentId) throw new AppError(400, 'BAD_REQUEST', 'studentId is required.');
      direction = 'counselor-to-parent';
    } else {
      if (!resolvedStudentId || (!resolvedTeacherId && !resolvedStaffId) || (resolvedTeacherId && resolvedStaffId)) {
        throw new AppError(400, 'BAD_REQUEST', 'studentId and exactly one of teacherId or staffId are required.');
      }
    }

    const record = await prisma.appointment.create({
      data: {
        id: generateId(),
        student_id: resolvedStudentId!,
        teacher_id: resolvedTeacherId || null,
        staff_id: resolvedStaffId || null,
        date: new Date(input.date),
        time: parseTime(input.time)!,
        purpose: input.purpose,
        parent_email: input.parentEmail,
        direction: direction,
        status: 'Pending'
      }
    });

    const correlationId = (req as any).correlationId;
    await createAuditLog({
      actorUserId: actorId,
      action: 'APPOINTMENT_CREATED',
      resourceType: 'appointment',
      resourceId: record.id,
      newState: { studentId: resolvedStudentId, teacherId: resolvedTeacherId, staffId: resolvedStaffId, date: input.date, time: input.time },
      correlationId,
    });

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.patch('/appointments/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const { status } = req.body;
    const recordId = req.params.id;
    
    const existing = await prisma.appointment.findUnique({ 
      where: { id: recordId as string },
      include: { student: true, teacher: true } 
    });
    
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Appointment not found.');
    }

    const isGlobalViewer = authUser.roles.some(r => ['Admin', 'Principal'].includes(r));
    if (!isGlobalViewer) {
      if (authUser.roles.includes('Teacher')) {
        const teacher = await prisma.teacher.findUnique({ where: { user_id: authUser.id } });
        if (!teacher || existing.teacher_id !== teacher.id) {
          throw new AppError(403, 'FORBIDDEN', 'You can only update your own appointments.');
        }
      } else if (authUser.roles.includes('Guidance')) {
        const staff = await prisma.staff.findUnique({ where: { user_id: authUser.id } });
        if (!staff || existing.staff_id !== staff.id) {
          throw new AppError(403, 'FORBIDDEN', 'You can only update your own appointments.');
        }
      } else if (authUser.roles.includes('Student')) {
        const student = await prisma.student.findUnique({ where: { user_id: authUser.id } });
        if (!student || existing.student_id !== student.id) {
          throw new AppError(403, 'FORBIDDEN', 'You can only update your own appointments.');
        }
      } else {
        throw new AppError(403, 'FORBIDDEN', 'Unauthorized role.');
      }
    }

    const record = await prisma.appointment.update({
      where: { id: recordId as string },
      data: { status }
    });

    const correlationId = (req as any).correlationId as string;
    await createAuditLog({
      actorUserId: authUser.id,
      action: 'APPOINTMENT_STATUS_UPDATED',
      resourceType: 'appointment',
      resourceId: record.id,
      previousState: { status: existing.status },
      newState: { status: record.status },
      correlationId,
    });

    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

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
