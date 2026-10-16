import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';
import { authMiddleware, requirePermissions, requireAnyPermission, AuthenticatedUser } from '../common/middleware/auth.js';
import { createAuditLog } from '../audit/audit.service.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { getPhilippineCalendarDate } from '../common/utils/dateTime.js';
import excuseLettersRouter from '../modules/excuse-letters/excuseLetters.routes.js';
import classAttendanceRouter from '../modules/class-attendance/classAttendance.routes.js';
import facultyAttendanceRouter from '../modules/faculty-attendance/facultyAttendance.routes.js';

const router = Router();
router.use(authMiddleware);

router.use('/faculty', facultyAttendanceRouter);
router.use('/excuses', excuseLettersRouter);
router.use('/', classAttendanceRouter);

// ─── SSE Client Registry ──────────────────────────────────────────────────────
// Tracks all active Principal Monitoring SSE connections.
// When a gate scan succeeds, we emit 'attendance-changed' (students) or
// 'faculty-attendance-changed' (teachers) to all connected clients.
// The event carries no attendance data — the client must call GET /attendance/gate
// or GET /attendance/faculty to get the authoritative PostgreSQL-backed records.
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

export function emitFacultyAttendanceChanged(): void {
  for (const client of sseClients) {
    try {
      client.write('event: faculty-attendance-changed\ndata: {}\n\n');
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

/**
 * Resolves a raw scanned barcode value to a teacher record using active scan credentials.
 * Decouples the physical card barcode/QR payload from the teacher's institutional employee_id.
 */
async function resolveScannedTeacher(barcode: string) {
  const credential = await prisma.teacherScanCredential.findFirst({
    where: {
      scan_identifier: barcode,
      is_active: true,
    },
    include: {
      teacher: {
        include: {
          user: { select: { first_name: true, last_name: true, status: true } }
        }
      }
    }
  });

  return credential?.teacher ?? null;
}

// ─── Routes ─────────────────────────────────────────────────

/**
 * POST /api/attendance/gate/student/scan
 * Dedicated Student Gate Scanner endpoint.
 * Strictly accepts Student LRN only -> records Student GateAttendance.
 * Rejects Faculty credentials with explicit diagnostic error without creating attendance.
 */
router.post('/gate/student/scan', requireAnyPermission('attendance:write', 'attendance:write_all'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = scanAttendanceSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    const rawBarcode = input.barcode.replace(/[\r\n]/g, '');

    // Resolve Student only
    const student = await resolveScannedStudent(rawBarcode);

    if (!student) {
      // Diagnostic check: Was a Teacher credential scanned on the Student scanner?
      const teacher = await resolveScannedTeacher(rawBarcode);
      emitInvalidScan(rawBarcode);
      if (teacher) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIAL_TYPE',
            message: 'This ID is not valid for the Student Attendance scanner.'
          }
        });
      }

      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Identifier not recognized.'
        }
      });
    }

    const now = new Date();
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

    // Notify all connected Principal Monitoring clients that student gate attendance has changed.
    emitGateAttendanceChanged();

    return res.json({
      success: true,
      data: {
        entityType: 'STUDENT',
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
 * POST /api/attendance/gate/faculty/scan
 * Dedicated Faculty Gate Scanner endpoint.
 * Strictly accepts TeacherScanCredential only -> records FacultyAttendance.
 * Rejects Student IDs with explicit diagnostic error without creating attendance.
 */
router.post('/gate/faculty/scan', requireAnyPermission('attendance:write', 'attendance:write_all'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = scanAttendanceSchema.parse(req.body);
    const correlationId = (req as any).correlationId;
    const actorId = ((req as any).user as AuthenticatedUser).id;
    const rawBarcode = input.barcode.replace(/[\r\n]/g, '');

    // Resolve Faculty credential only
    const teacher = await resolveScannedTeacher(rawBarcode);

    if (!teacher) {
      // Diagnostic check: Was a Student ID scanned on the Faculty scanner?
      const student = await resolveScannedStudent(rawBarcode);
      emitInvalidScan(rawBarcode);
      if (student) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIAL_TYPE',
            message: 'This ID is not valid for the Faculty Attendance scanner.'
          }
        });
      }

      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Identifier not recognized.'
        }
      });
    }

    if (!teacher.user || teacher.user.status !== 'active') {
      return res.status(403).json({ success: false, error: { code: 'ACCOUNT_INACTIVE', message: 'Teacher account is not active.' } });
    }

    const now = new Date();
    const { dateObj: today } = getPhilippineCalendarDate(now);

    const existing = await prisma.facultyAttendance.findUnique({
      where: {
        teacher_id_date: {
          teacher_id: teacher.id,
          date: today,
        }
      }
    });

    let action = '';
    let resultEntry;

    if (!existing) {
      resultEntry = await prisma.facultyAttendance.create({
        data: {
          id: generateId(),
          teacher_id: teacher.id,
          date: today,
          time_in: now,
          capture_source: 'gate_scanner',
        }
      });
      action = 'Time In';
    } else {
      if (existing.time_out) {
        return res.status(422).json({ success: false, error: { code: 'UNPROCESSABLE_ENTITY', message: 'Teacher already timed out today.' } });
      }

      // 60-second debounce matching Student Gate
      if (existing.updated_at && (now.getTime() - existing.updated_at.getTime()) < 60000) {
        return res.status(422).json({ success: false, error: { code: 'UNPROCESSABLE_ENTITY', message: 'Scan ignored (duplicate scan within 1 minute).' } });
      }

      resultEntry = await prisma.facultyAttendance.update({
        where: { id: existing.id },
        data: {
          time_out: now,
        }
      });
      action = 'Time Out';
    }

    await createAuditLog({
      actorUserId: actorId,
      action: existing ? 'FACULTY_ATTENDANCE_SCAN_OUT' : 'FACULTY_ATTENDANCE_SCAN_IN',
      resourceType: 'faculty_attendance',
      resourceId: resultEntry.id,
      newState: { barcode: input.barcode, teacherId: teacher.id },
      correlationId,
    });

    // Notify Principal Monitoring clients that Faculty Attendance changed
    emitFacultyAttendanceChanged();

    return res.json({
      success: true,
      data: {
        entityType: 'FACULTY',
        teacherName: teacher.user ? `${teacher.user.first_name} ${teacher.user.last_name}` : 'Unknown',
        teacherId: teacher.id,
        employeeId: teacher.employee_id,
        department: teacher.department || 'Faculty',
        position: teacher.position || 'Teacher',
        action: action,
        time: now.toISOString(),
        record: {
          id: resultEntry.id,
          teacherId: teacher.id,
          teacherName: teacher.user ? `${teacher.user.first_name} ${teacher.user.last_name}` : 'Unknown',
          date: today.toISOString(),
          timeIn: resultEntry.time_in ? resultEntry.time_in.toISOString() : null,
          timeOut: resultEntry.time_out ? resultEntry.time_out.toISOString() : null,
          captureSource: resultEntry.capture_source,
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attendance/gate/scan
 * DEPRECATED: Unified scanner endpoint has been separated.
 * Clients must use /gate/student/scan for Students or /gate/faculty/scan for Faculty.
 */
router.post('/gate/scan', requireAnyPermission('attendance:write', 'attendance:write_all'), (req: Request, res: Response) => {
  return res.status(400).json({
    success: false,
    error: {
      code: 'DEPRECATED_ENDPOINT',
      message: 'Unified scanner endpoint has been separated. Use /api/attendance/gate/student/scan for Students or /api/attendance/gate/faculty/scan for Faculty.'
    }
  });
});

const createTerminalSchema = z.object({
  id: z.string().optional(),
  terminal_name: z.string().min(1, 'Terminal name is required.'),
  terminal_type: z.enum(['student', 'faculty']).default('student'),
});

const updateTerminalSchema = z.object({
  terminal_type: z.enum(['student', 'faculty']).optional(),
  terminal_name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  adminPassword: z.string().optional(),
});

/**
 * GET /api/attendance/gate/terminals
 * List all registered physical gate terminals.
 */
router.get('/gate/terminals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const terminals = await prisma.gateTerminal.findMany({
      orderBy: { terminal_name: 'asc' },
    });
    return res.json({
      success: true,
      data: terminals,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance/gate/terminals/:id
 * Retrieve a single physical gate terminal configuration by ID.
 * Kiosks poll this endpoint to discover their assigned role ('student' | 'faculty').
 */
router.get('/gate/terminals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const terminal = await prisma.gateTerminal.findUnique({
      where: { id },
    });
    if (!terminal) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Gate terminal not found.' },
      });
    }
    return res.json({
      success: true,
      data: terminal,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attendance/gate/terminals
 * Register a new physical gate terminal.
 * Strictly restricted to Admin and ITAdmin roles.
 */
router.post('/gate/terminals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const isAuthorized = authUser.roles.includes('Admin') || authUser.roles.includes('ITAdmin');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only Admin or ITAdmin can register gate terminals.' },
      });
    }

    const input = createTerminalSchema.parse(req.body);
    const id = input.id || generateId();

    const terminal = await prisma.gateTerminal.create({
      data: {
        id,
        terminal_name: input.terminal_name,
        terminal_type: input.terminal_type,
        active: true,
      },
    });

    await createAuditLog({
      actorUserId: authUser.id,
      action: 'GATE_TERMINAL_REGISTERED',
      resourceType: 'gate_terminal',
      resourceId: terminal.id,
      newState: { terminal_name: terminal.terminal_name, terminal_type: terminal.terminal_type },
      correlationId: (req as any).correlationId,
    });

    return res.status(201).json({
      success: true,
      data: terminal,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/attendance/gate/terminals/:id
 * Remotely reconfigure a physical gate terminal.
 * Strictly restricted to Admin and ITAdmin roles.
 * GateOperators are rejected with 403 Forbidden.
 */
router.patch('/gate/terminals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = (req as any).user as AuthenticatedUser;
    const isAuthorized = authUser.roles.includes('Admin') || authUser.roles.includes('ITAdmin');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only Admin or ITAdmin can reconfigure gate terminals.' },
      });
    }

    const id = req.params.id as string;
    const input = updateTerminalSchema.parse(req.body);

    if (input.adminPassword) {
      const user = await prisma.user.findUnique({ where: { id: authUser.id } });
      if (!user || !(await bcrypt.compare(input.adminPassword, user.password_hash))) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid administrator password.' },
        });
      }
    }

    const existing = await prisma.gateTerminal.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Gate terminal not found.' },
      });
    }

    const updated = await prisma.gateTerminal.update({
      where: { id },
      data: {
        ...(input.terminal_type !== undefined ? { terminal_type: input.terminal_type } : {}),
        ...(input.terminal_name !== undefined ? { terminal_name: input.terminal_name } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });

    await createAuditLog({
      actorUserId: authUser.id,
      action: 'GATE_TERMINAL_RECONFIGURED',
      resourceType: 'gate_terminal',
      resourceId: updated.id,
      previousState: { terminal_type: existing.terminal_type, terminal_name: existing.terminal_name },
      newState: { terminal_type: updated.terminal_type, terminal_name: updated.terminal_name },
      correlationId: (req as any).correlationId,
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

const reconfigureTerminalSchema = z.object({
  email: z.string().email('Valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
  terminalType: z.enum(['student', 'faculty']),
  terminalId: z.string().optional(),
});

/**
 * POST /api/attendance/gate/terminal/reconfigure
 * Physical Station Reconfiguration Endpoint (Fallback On-Device Maintenance).
 * Strictly requires authenticated Admin or ITAdmin credentials.
 * GateOperators, Teachers, Students, and invalid credentials are rejected.
 */
router.post('/gate/terminal/reconfigure', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = reconfigureTerminalSchema.parse(req.body);
    const correlationId = (req as any).correlationId;

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        user_roles: {
          include: { role: true },
        },
      },
    });

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid administrator credentials.' },
      });
    }

    const isValidPassword = await bcrypt.compare(input.password, user.password_hash);
    if (!isValidPassword) {
      await createAuditLog({
        actorUserId: user.id,
        action: 'GATE_TERMINAL_RECONFIG_FAILED',
        resourceType: 'gate_terminal',
        reason: 'Invalid password',
        correlationId,
      });
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid administrator credentials.' },
      });
    }

    const roles = user.user_roles.map(ur => ur.role.name);
    const isAuthorized = roles.includes('Admin') || roles.includes('ITAdmin');

    if (!isAuthorized) {
      await createAuditLog({
        actorUserId: user.id,
        action: 'GATE_TERMINAL_RECONFIG_FORBIDDEN',
        resourceType: 'gate_terminal',
        reason: 'User lacks Admin or ITAdmin role',
        correlationId,
      });
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Admin or ITAdmin can reconfigure attendance terminals.',
        },
      });
    }

    // If terminalId provided, update server-side database assignment
    if (input.terminalId) {
      const target = await prisma.gateTerminal.findUnique({ where: { id: input.terminalId } });
      if (target) {
        await prisma.gateTerminal.update({
          where: { id: input.terminalId },
          data: { terminal_type: input.terminalType },
        });
      }
    }

    await createAuditLog({
      actorUserId: user.id,
      action: 'GATE_TERMINAL_RECONFIGURED',
      resourceType: 'gate_terminal',
      newState: { terminalType: input.terminalType, terminalId: input.terminalId },
      correlationId,
    });

    return res.json({
      success: true,
      data: {
        terminalType: input.terminalType,
        terminalId: input.terminalId,
        authorizedBy: `${user.first_name} ${user.last_name} (${user.email})`,
      },
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
