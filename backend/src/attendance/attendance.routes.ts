import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, requireAnyPermission, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/middleware/errorHandler.js';
import excuseLettersRouter from '../modules/excuse-letters/excuseLetters.routes.js';
import classAttendanceRouter from '../modules/class-attendance/classAttendance.routes.js';

const router = Router();
router.use(authMiddleware);

router.use('/excuses', excuseLettersRouter);
router.use('/', classAttendanceRouter);

// ─── SSE Client Registry ──────────────────────────────────────────────────────
// Tracks all active Principal Monitoring SSE connections.
// When a gate scan succeeds, we emit 'attendance-changed' to all connected clients.
// The event carries no attendance data — the client must call GET /attendance/gate
// to get the authoritative PostgreSQL-backed records.
const sseClients = new Set<Response>();

function emitGateAttendanceChanged(): void {
  for (const client of sseClients) {
    try {
      client.write('event: attendance-changed\ndata: {}\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}

function emitInvalidScan(barcode: string): void {
  for (const client of sseClients) {
    try {
      client.write(`event: invalid-scan\ndata: ${JSON.stringify({ barcode, time: new Date().toISOString() })}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * GET /api/attendance/gate/events
 * SSE stream for Principal Monitoring real-time updates.
 * Emits 'attendance-changed' whenever a gate scan is saved to PostgreSQL.
 * Authentication: inherits router-level authMiddleware (cookie-based JWT).
 * Authorization: attendance:read permission required.
 *
 * EventSource sends cookies automatically, so no token-in-URL workaround is needed.
 */
router.get('/gate/events', requirePermissions('attendance:read'), (req: Request, res: Response) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if proxied
  res.flushHeaders();

  // Register this client
  sseClients.add(res);

  // Send a confirmation event so the client knows the stream is live
  res.write('event: connected\ndata: {}\n\n');

  // Heartbeat every 25 seconds.
  // Rationale: Many proxies and browsers silently drop idle HTTP connections
  // after 30 seconds. A 25-second heartbeat keeps the connection alive without
  // polling for data. The client ignores 'heartbeat' events.
  const heartbeat = setInterval(() => {
    try {
      res.write('event: heartbeat\ndata: {}\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  // Clean up when the client disconnects
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

const parseTime = (timeStr?: string) => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  const hh = parts[0].padStart(2, '0');
  const mm = parts[1].padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  return new Date(`1970-01-01T${hh}:${mm}:${ss}.000Z`);
};

// ─── DTOs ──────────────────────────────────────────────────

const createGateAttendanceSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  timeIn: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be HH:mm or HH:mm:ss').optional(),
  timeOut: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Time must be HH:mm or HH:mm:ss').optional(),
  status: z.enum(['Present', 'Absent', 'Late Arrival', 'Early Dismissal']),
});

const scanAttendanceSchema = z.object({
  barcode: z.string().min(1),
});

// ─── Resolver ─────────────────────────────────────────────────

/**
 * Resolves a raw scanned barcode value to a student record.
 * Current implementation assumes the barcode is a DepEd LRN.
 * Future implementations may map this to a custom Student ID or NFC/RFID Card Token.
 */
async function resolveScannedStudent(barcode: string) {
  return prisma.student.findUnique({
    where: { lrn: barcode },
    include: {
      user: { select: { first_name: true, last_name: true } }
    }
  });
}

// ─── Routes ─────────────────────────────────────────────────

/**
 * POST /api/attendance/gate/scan
 * Hardware USB keyboard-wedge barcode scanner endpoint
 */
router.post('/gate/scan', requireAnyPermission('attendance:write', 'attendance:write_all'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('=== GATE SCAN RECEIVED ===', req.body);
    const input = scanAttendanceSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    const student = await resolveScannedStudent(input.barcode);

    if (!student) {
      console.log('--- GATE SCAN FAILED: Student not found for barcode', input.barcode);
      
      // Emit invalid-scan event so Principal Monitoring TVs can display it
      emitInvalidScan(input.barcode);
      
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } });
    }

    const now = new Date();
    // Assuming server local time for the "date" field
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const today = new Date(todayStr); // 00:00:00Z for the Date field

    const existing = await prisma.gateAttendance.findUnique({
      where: {
        student_id_date: {
          student_id: student.id,
          date: today,
        }
      }
    });

    let action = '';
    let resultEntry;

    if (!existing) {
      resultEntry = await prisma.gateAttendance.create({
        data: {
          id: generateId(),
          student_id: student.id,
          date: today,
          status: 'Present',
          time_in: now,
        }
      });
      action = 'Time In';
    } else {
      if (existing.time_out) {
        return res.status(422).json({ success: false, error: { code: 'UNPROCESSABLE_ENTITY', message: 'Student already timed out today.' } });
      }
      
      // Debounce logic (within 1 minute of previous action, don't allow time_out)
      // Note: time_in is @db.Time(3) so Prisma returns it as 1970-01-01. We use updated_at instead for a reliable timestamp comparison.
      if (existing.updated_at && (now.getTime() - existing.updated_at.getTime()) < 60000) {
        return res.status(422).json({ success: false, error: { code: 'UNPROCESSABLE_ENTITY', message: 'Scan ignored (duplicate scan within 1 minute).' } });
      }

      resultEntry = await prisma.gateAttendance.update({
        where: { id: existing.id },
        data: {
          time_out: now,
        }
      });
      action = 'Time Out';
    }

    await createAuditLog({
      actorUserId: actorId,
      action: existing ? 'GATE_ATTENDANCE_SCAN_OUT' : 'GATE_ATTENDANCE_SCAN_IN',
      resourceType: 'gate_attendance',
      resourceId: resultEntry.id,
      newState: { barcode: input.barcode },
      correlationId,
    });

    // Notify all connected Principal Monitoring clients that attendance has changed.
    // This fires ONLY after the PostgreSQL write succeeds — not on error.
    emitGateAttendanceChanged();

    res.json({
      success: true,
      data: {
        studentName: student.user ? `${student.user.first_name} ${student.user.last_name}` : 'Unknown',
        studentId: student.id,
        action: action,
        time: now.toISOString(),
        record: {
          id: resultEntry.id,
          studentId: student.id,
          studentName: student.user ? `${student.user.first_name} ${student.user.last_name}` : 'Unknown',
          date: today.toISOString(),
          timeIn: resultEntry.time_in ? resultEntry.time_in.toISOString() : null,
          timeOut: resultEntry.time_out ? resultEntry.time_out.toISOString() : null,
          status: resultEntry.status
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/gate
 * Fetch all gate attendance records for today
 */
router.get('/gate', requirePermissions('attendance:read'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const today = new Date(todayStr); // 00:00:00Z for the Date field

    const records = await prisma.gateAttendance.findMany({
      where: {
        date: today
      },
      include: {
        student: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        time_in: 'desc'
      }
    });

    const formatted = records.map(r => ({
      id: r.id,
      studentId: r.student_id,
      studentName: r.student.user ? `${r.student.user.first_name} ${r.student.user.last_name}` : 'Unknown',
      date: r.date.toISOString(),
      timeIn: r.time_in ? r.time_in.toISOString() : null,
      timeOut: r.time_out ? r.time_out.toISOString() : null,
      status: r.status,
      time: r.time_in ? r.time_in.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : undefined
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attendance/gate
 */
router.post('/gate', requireAnyPermission('attendance:write', 'attendance:write_all'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createGateAttendanceSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;

    // Check if entry already exists for this date
    const existing = await prisma.gateAttendance.findUnique({
      where: {
        student_id_date: {
          student_id: input.studentId,
          date: new Date(input.date),
        }
      }
    });

    let entry;
    if (existing) {
      entry = await prisma.gateAttendance.update({
        where: { id: existing.id },
        data: {
          time_in: input.timeIn ? parseTime(input.timeIn) : existing.time_in,
          time_out: input.timeOut ? parseTime(input.timeOut) : existing.time_out,
          status: input.status,
        },
      });
      await createAuditLog({
        actorUserId: actorId,
        action: 'GATE_ATTENDANCE_UPDATED',
        resourceType: 'gate_attendance',
        resourceId: entry.id,
        newState: input,
        correlationId,
      });
    } else {
      entry = await prisma.gateAttendance.create({
        data: {
          id: generateId(),
          student_id: input.studentId,
          date: new Date(input.date),
          time_in: parseTime(input.timeIn),
          time_out: parseTime(input.timeOut),
          status: input.status,
        },
      });
      await createAuditLog({
        actorUserId: actorId,
        action: 'GATE_ATTENDANCE_CREATED',
        resourceType: 'gate_attendance',
        resourceId: entry.id,
        newState: input,
        correlationId,
      });
    }

    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/gate/:studentId
 * Allows students or parents to fetch their gate attendance records
 */
router.get('/gate/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const studentId = req.params.studentId as string;
    
    if (authUser.roles.includes('Student')) {
      const student = await prisma.student.findUnique({ where: { user_id: authUser.id } });
      if (!student || student.id !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You can only view your own gate attendance records.');
      }
    }
    
    const records = await prisma.gateAttendance.findMany({
      where: { student_id: studentId },
      orderBy: { date: 'desc' },
      take: 30 // Get last 30 days
    });
    
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});


export default router;
