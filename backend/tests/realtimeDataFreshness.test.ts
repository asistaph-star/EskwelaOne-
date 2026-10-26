import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Response } from 'express';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { config } from '../src/config/env.js';
import { getPhilippineCalendarDate } from '../src/common/utils/dateTime.js';
import {
  registerSSEClient,
  getSSEClientCount,
  clearAllSSEClients,
  emitGateAttendanceChanged,
  emitFacultyAttendanceChanged,
  emitInvalidScan
} from '../src/attendance/attendanceBroadcaster.service.js';

describe('DIGISKWELA — REAL-TIME UPDATES & DATA FRESHNESS SUITE', () => {
  const ts = Date.now();
  let principalToken: string;
  let studentToken: string;
  let teacherToken: string;
  let teacherUserId: string;
  let teacherRecordId: string;
  let itAdminToken: string;
  let gateOperatorToken: string;

  const rawPassword = 'password123';
  const hashedPassword = bcrypt.hashSync(rawPassword, 10);

  let testStudentId: string;
  const testStudentLrn = `98${ts.toString().slice(-10)}`;
  const teacherScanIdentifier = `EMP-REALTIME-${ts}`;

  const createdUserIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdTeacherIds: string[] = [];
  const createdCredentialIds: string[] = [];
  const createdAttendanceIds: string[] = [];
  const createdFacultyAttendanceIds: string[] = [];

  const createUserWithToken = async (email: string, roles: string[], permissions: string[]) => {
    const id = generateId();
    createdUserIds.push(id);
    const user = await prisma.user.create({
      data: {
        id,
        email,
        password_hash: hashedPassword,
        first_name: 'Realtime',
        last_name: 'TestUser',
        status: 'active',
      },
    });

    for (const roleName of roles) {
      let role = await prisma.role.findFirst({ where: { name: roleName } });
      if (!role) role = await prisma.role.create({ data: { id: generateId(), name: roleName } });
      await prisma.userRole.create({ data: { user_id: user.id, role_id: role.id } });

      for (const p of permissions) {
        let perm = await prisma.permission.findFirst({ where: { key: p } });
        if (!perm) perm = await prisma.permission.create({ data: { id: generateId(), key: p } });
        const existingRP = await prisma.rolePermission.findFirst({
          where: { role_id: role.id, permission_id: perm.id },
        });
        if (!existingRP) {
          await prisma.rolePermission.create({ data: { role_id: role.id, permission_id: perm.id } });
        }
      }
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, roles, permissions },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    return { user, token };
  };

  beforeAll(async () => {
    // 1. Principal (has attendance:read, faculty_attendance:read)
    const principal = await createUserWithToken(
      `principal-realtime-${ts}@calulut.edu.ph`,
      ['Principal'],
      ['attendance:read', 'faculty_attendance:read', 'attendance:write']
    );
    principalToken = principal.token;

    // 2. Student (lacks attendance:read)
    const studentUser = await createUserWithToken(
      `student-realtime-${ts}@calulut.edu.ph`,
      ['Student'],
      []
    );
    studentToken = studentUser.token;

    // Create student profile
    testStudentId = generateId();
    createdStudentIds.push(testStudentId);
    await prisma.student.create({
      data: {
        id: testStudentId,
        user_id: studentUser.user.id,
        lrn: testStudentLrn,
        grade_level: 10,
      },
    });

    // 3. Teacher
    const teacherUser = await createUserWithToken(
      `teacher-realtime-${ts}@calulut.edu.ph`,
      ['Teacher'],
      ['attendance:read']
    );
    teacherToken = teacherUser.token;
    teacherUserId = teacherUser.user.id;

    teacherRecordId = generateId();
    createdTeacherIds.push(teacherRecordId);
    await prisma.teacher.create({
      data: {
        id: teacherRecordId,
        user_id: teacherUserId,
        employee_id: `EMP-INST-${ts}`,
        department: 'Science',
        position: 'Master Teacher I',
      },
    });

    // Create TeacherScanCredential for faculty gate scanning
    const credId = generateId();
    createdCredentialIds.push(credId);
    await prisma.teacherScanCredential.create({
      data: {
        id: credId,
        teacher_id: teacherRecordId,
        scan_identifier: teacherScanIdentifier,
        is_active: true,
      },
    });

    // 4. ITAdmin
    const itAdmin = await createUserWithToken(
      `itadmin-realtime-${ts}@calulut.edu.ph`,
      ['ITAdmin'],
      ['attendance:read', 'attendance:write', 'faculty_attendance:read', 'faculty_attendance:write']
    );
    itAdminToken = itAdmin.token;

    // 5. Gate Operator
    const gateOperator = await createUserWithToken(
      `gateop-realtime-${ts}@calulut.edu.ph`,
      ['Staff'],
      ['attendance:write', 'attendance:write_all']
    );
    gateOperatorToken = gateOperator.token;
  });

  afterAll(async () => {
    clearAllSSEClients();

    // Clean up created synthetic records
    if (createdAttendanceIds.length > 0) {
      await prisma.gateAttendance.deleteMany({ where: { id: { in: createdAttendanceIds } } }).catch(() => {});
    }
    if (createdFacultyAttendanceIds.length > 0) {
      await prisma.facultyAttendance.deleteMany({ where: { id: { in: createdFacultyAttendanceIds } } }).catch(() => {});
    }
    if (createdCredentialIds.length > 0) {
      await prisma.teacherScanCredential.deleteMany({ where: { id: { in: createdCredentialIds } } }).catch(() => {});
    }
    if (createdTeacherIds.length > 0) {
      await prisma.teacher.deleteMany({ where: { id: { in: createdTeacherIds } } }).catch(() => {});
    }
    if (createdStudentIds.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: createdStudentIds } } }).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { user_id: { in: createdUserIds } } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: createdUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
  });

  beforeEach(() => {
    clearAllSSEClients();
  });

  // ─── 1. Authentication & RBAC Policy ──────────────────────────────────────

  describe('1. Authentication & RBAC Security for SSE Stream', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/attendance/gate/events');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('UNAUTHORIZED');
    });

    it('rejects authenticated users lacking attendance:read with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/attendance/gate/events')
        .set('Cookie', [`auth_token=${studentToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('allows authorized users with attendance:read and sets SSE headers', async () => {
      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as any).port;

      try {
        const result = await new Promise<{ status: number; headers: any; chunk: string }>((resolve, reject) => {
          const req = http.get(
            `http://127.0.0.1:${port}/api/attendance/gate/events`,
            {
              headers: {
                Cookie: `auth_token=${principalToken}`,
              },
            },
            (res) => {
              let chunk = '';
              res.on('data', (d) => {
                chunk += d.toString();
                resolve({
                  status: res.statusCode || 0,
                  headers: res.headers,
                  chunk,
                });
                req.destroy();
              });
            }
          );

          req.on('error', (err: any) => {
            if (err.code === 'ECONNRESET') return;
            reject(err);
          });
        });

        expect(result.status).toBe(200);
        expect(result.headers['content-type']).toContain('text/event-stream');
        expect(result.headers['cache-control']).toContain('no-cache');
        expect(result.headers['x-accel-buffering']).toBe('no');
        expect(result.chunk).toContain('event: connected\ndata: {}\n\n');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });

  // ─── 2. Broadcaster Client Registry & Lifecycle ─────────────────────────

  describe('2. Broadcaster Client Registry & Lifecycle Management', () => {
    it('registers new SSE clients and tracks count accurately', () => {
      expect(getSSEClientCount()).toBe(0);

      const mockRes1 = { write: () => true } as unknown as Response;
      const mockRes2 = { write: () => true } as unknown as Response;

      const unregister1 = registerSSEClient(mockRes1);
      expect(getSSEClientCount()).toBe(1);

      const unregister2 = registerSSEClient(mockRes2);
      expect(getSSEClientCount()).toBe(2);

      unregister1();
      expect(getSSEClientCount()).toBe(1);

      unregister2();
      expect(getSSEClientCount()).toBe(0);
    });

    it('gracefully prunes dead clients that throw on write', () => {
      const writtenChunks: string[] = [];
      const healthyRes = {
        write: (msg: string) => {
          writtenChunks.push(msg);
          return true;
        },
      } as unknown as Response;

      const brokenRes = {
        write: () => {
          throw new Error('Socket closed');
        },
      } as unknown as Response;

      registerSSEClient(healthyRes);
      registerSSEClient(brokenRes);
      expect(getSSEClientCount()).toBe(2);

      // Broadcasting should succeed and prune broken client
      emitGateAttendanceChanged();

      expect(getSSEClientCount()).toBe(1);
      expect(writtenChunks).toContain('event: attendance-changed\ndata: {}\n\n');
    });
  });

  // ─── 3. Data Mutation Event Emission ─────────────────────────────────────

  describe('3. Real-Time Push Notification on Data Changes', () => {
    it('emits attendance-changed when Student Gate scan succeeds', async () => {
      const captured: string[] = [];
      registerSSEClient({
        write: (chunk: string) => {
          captured.push(chunk);
          return true;
        },
      } as unknown as Response);

      const scanRes = await request(app)
        .post('/api/attendance/gate/student/scan')
        .set('Cookie', [`auth_token=${gateOperatorToken}`])
        .send({ barcode: testStudentLrn });

      expect(scanRes.status).toBe(200);
      expect(scanRes.body.success).toBe(true);
      if (scanRes.body.data?.record?.id) {
        createdAttendanceIds.push(scanRes.body.data.record.id);
      }

      expect(captured).toContain('event: attendance-changed\ndata: {}\n\n');
    });

    it('emits attendance-changed when manual student gate attendance is saved', async () => {
      const captured: string[] = [];
      registerSSEClient({
        write: (chunk: string) => {
          captured.push(chunk);
          return true;
        },
      } as unknown as Response);

      const res = await request(app)
        .post('/api/attendance/gate')
        .set('Cookie', [`auth_token=${principalToken}`])
        .send({
          studentId: testStudentId,
          date: '2026-10-27',
          timeIn: '07:30',
          status: 'Present',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.data?.id) {
        createdAttendanceIds.push(res.body.data.id);
      }

      expect(captured).toContain('event: attendance-changed\ndata: {}\n\n');
    });

    it('emits faculty-attendance-changed when Faculty Gate scan succeeds', async () => {
      const captured: string[] = [];
      registerSSEClient({
        write: (chunk: string) => {
          captured.push(chunk);
          return true;
        },
      } as unknown as Response);

      const scanRes = await request(app)
        .post('/api/attendance/gate/faculty/scan')
        .set('Cookie', [`auth_token=${gateOperatorToken}`])
        .send({ barcode: teacherScanIdentifier });

      expect(scanRes.status).toBe(200);
      expect(scanRes.body.success).toBe(true);
      if (scanRes.body.data?.record?.id) {
        createdFacultyAttendanceIds.push(scanRes.body.data.record.id);
      }

      expect(captured).toContain('event: faculty-attendance-changed\ndata: {}\n\n');
    });

    it('emits faculty-attendance-changed on Teacher self-service time-in / time-out', async () => {
      const captured: string[] = [];
      registerSSEClient({
        write: (chunk: string) => {
          captured.push(chunk);
          return true;
        },
      } as unknown as Response);

      // Teacher Self-service Time In
      const timeInRes = await request(app)
        .post('/api/attendance/faculty/time-in')
        .set('Cookie', [`auth_token=${teacherToken}`])
        .send({ remarks: 'Self check-in test' });

      // Note: teacher might already have gate scan today; check either 201 or 409
      if (timeInRes.status === 201) {
        expect(captured).toContain('event: faculty-attendance-changed\ndata: {}\n\n');
        if (timeInRes.body.data?.id) {
          createdFacultyAttendanceIds.push(timeInRes.body.data.id);
        }
      } else {
        // Teacher already timed in via gate scan above -> test self-service time-out
        captured.length = 0;
        const timeOutRes = await request(app)
          .post('/api/attendance/faculty/time-out')
          .set('Cookie', [`auth_token=${teacherToken}`])
          .send({ remarks: 'Self check-out test' });

        expect(timeOutRes.status).toBe(200);
        expect(captured).toContain('event: faculty-attendance-changed\ndata: {}\n\n');
      }
    });

    it('emits faculty-attendance-changed on Admin faculty correction', async () => {
      // Find an existing faculty attendance record to correct
      const todayDate = getPhilippineCalendarDate().dateObj;
      const existing = await prisma.facultyAttendance.findFirst({
        where: { teacher_id: teacherRecordId, date: todayDate },
      });

      expect(existing).toBeDefined();

      const captured: string[] = [];
      registerSSEClient({
        write: (chunk: string) => {
          captured.push(chunk);
          return true;
        },
      } as unknown as Response);

      const patchRes = await request(app)
        .patch(`/api/attendance/faculty/${existing!.id}`)
        .set('Cookie', [`auth_token=${itAdminToken}`])
        .send({
          remarks: 'Administrative time adjustment for verification',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);
      expect(captured).toContain('event: faculty-attendance-changed\ndata: {}\n\n');
    });

    it('emits invalid-scan with barcode and timestamp on unrecognized barcode', async () => {
      const captured: string[] = [];
      registerSSEClient({
        write: (chunk: string) => {
          captured.push(chunk);
          return true;
        },
      } as unknown as Response);

      const fakeBarcode = `UNKNOWN-${Date.now()}`;
      const scanRes = await request(app)
        .post('/api/attendance/gate/student/scan')
        .set('Cookie', [`auth_token=${gateOperatorToken}`])
        .send({ barcode: fakeBarcode });

      expect(scanRes.status).toBe(404);
      expect(captured.some((c) => c.includes('event: invalid-scan') && c.includes(fakeBarcode))).toBe(true);
    });
  });

  // ─── 4. Data Privacy & Zero-PII Payload Invariants ───────────────────────

  describe('4. Invalidation-Only Principle & Data Privacy', () => {
    it('attendance-changed payload strictly carries {} and exposes zero student PII', () => {
      const messages: string[] = [];
      registerSSEClient({
        write: (chunk: string) => {
          messages.push(chunk);
          return true;
        },
      } as unknown as Response);

      emitGateAttendanceChanged();

      expect(messages.length).toBe(1);
      const msg = messages[0];
      expect(msg).toBe('event: attendance-changed\ndata: {}\n\n');

      // Verify zero sensitive fields in payload
      expect(msg).not.toContain('lrn');
      expect(msg).not.toContain('studentId');
      expect(msg).not.toContain('studentName');
    });

    it('faculty-attendance-changed payload strictly carries {} and exposes zero faculty PII', () => {
      const messages: string[] = [];
      registerSSEClient({
        write: (chunk: string) => {
          messages.push(chunk);
          return true;
        },
      } as unknown as Response);

      emitFacultyAttendanceChanged();

      expect(messages.length).toBe(1);
      const msg = messages[0];
      expect(msg).toBe('event: faculty-attendance-changed\ndata: {}\n\n');

      // Verify zero sensitive fields in payload
      expect(msg).not.toContain('employeeId');
      expect(msg).not.toContain('teacherName');
    });
  });

  // ─── 5. Multi-Subscriber Broadcast & Isolation ───────────────────────────

  describe('5. Multi-Subscriber Broadcast', () => {
    it('simultaneously notifies multiple connected monitoring screens', () => {
      const client1Messages: string[] = [];
      const client2Messages: string[] = [];
      const client3Messages: string[] = [];

      registerSSEClient({
        write: (chunk: string) => {
          client1Messages.push(chunk);
          return true;
        },
      } as unknown as Response);

      registerSSEClient({
        write: (chunk: string) => {
          client2Messages.push(chunk);
          return true;
        },
      } as unknown as Response);

      registerSSEClient({
        write: (chunk: string) => {
          client3Messages.push(chunk);
          return true;
        },
      } as unknown as Response);

      expect(getSSEClientCount()).toBe(3);

      emitGateAttendanceChanged();
      emitFacultyAttendanceChanged();

      expect(client1Messages).toEqual([
        'event: attendance-changed\ndata: {}\n\n',
        'event: faculty-attendance-changed\ndata: {}\n\n',
      ]);
      expect(client2Messages).toEqual([
        'event: attendance-changed\ndata: {}\n\n',
        'event: faculty-attendance-changed\ndata: {}\n\n',
      ]);
      expect(client3Messages).toEqual([
        'event: attendance-changed\ndata: {}\n\n',
        'event: faculty-attendance-changed\ndata: {}\n\n',
      ]);
    });
  });
});
