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

// ─── CLINIC ISOLATION ────────────────────────────────────────

/**
 * GET /api/student-services/clinic/:studentId
 * Strict isolation: Clinic records must not be exposed to general staff.
 */
router.get('/clinic/:studentId', requirePermissions('clinic:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRecords = await prisma.clinicReferral.findMany({
      where: { student_id: req.params.studentId as string },
      include: {
        recorder: true,
        symptoms: true,
        diagnosis: true,
        medications: true,
        treatments: true,
      },
      orderBy: { date: 'desc' }
    });
    const records = rawRecords.map(r => ({
      ...r,
      symptoms: r.symptoms.map((s: any) => s.symptom),
      diagnosis: r.diagnosis.map((d: any) => d.diagnosis),
      medications: r.medications.map((m: any) => m.medication),
      treatments: r.treatments.map((t: any) => t.treatment),
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
  symptoms: z.array(z.string()).optional(),
  diagnosis: z.array(z.string()).optional(),
  medications: z.array(z.string()).optional(),
  treatments: z.array(z.string()).optional(),
  temperature: z.coerce.number().optional(),
  bloodPressure: z.string().optional(),
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
        symptoms: input.symptoms ? {
          create: input.symptoms.map(s => ({ id: generateId(), symptom: s }))
        } : undefined,
        diagnosis: input.diagnosis ? {
          create: input.diagnosis.map(d => ({ id: generateId(), diagnosis: d }))
        } : undefined,
        medications: input.medications ? {
          create: input.medications.map(m => ({ id: generateId(), medication: m }))
        } : undefined,
        treatments: input.treatments ? {
          create: input.treatments.map(t => ({ id: generateId(), treatment: t }))
        } : undefined,
        temperature: input.temperature,
        blood_pressure: input.bloodPressure,
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

// ─── APPOINTMENTS ──────────────────────────────────────────────

/**
 * GET /api/student-services/appointments/:studentId
 */
router.get('/appointments/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await prisma.appointment.findMany({
      where: { student_id: req.params.studentId as string },
      orderBy: { date: 'desc' }
    });
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

const createAppointmentSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  teacherId: z.string(),
  teacherName: z.string(),
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
    const actorId = ((req as any).user as AuthenticatedUser).id;

    const record = await prisma.appointment.create({
      data: {
        id: generateId(),
        student_id: input.studentId,
        teacher_id: input.teacherId,
        date: new Date(input.date),
        time: parseTime(input.time)!,
        purpose: input.purpose,
        parent_email: input.parentEmail,
        direction: 'parent-to-teacher',
        status: 'Pending'
      }
    });

    res.status(201).json({ success: true, data: record });
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
