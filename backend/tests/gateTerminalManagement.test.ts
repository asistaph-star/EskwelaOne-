import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { config } from '../src/config/env.js';

describe('Centralized Gate Terminal Management Architecture', () => {
  const ts = Date.now();
  let adminToken: string;
  let itAdminToken: string;
  let gateOperatorToken: string;
  let adminUser: any;
  let itAdminUser: any;
  let gateOperatorUser: any;
  const rawAdminPassword = 'TestAdminPassword1!';
  const hashedAdminPassword = bcrypt.hashSync(rawAdminPassword, 10);

  const createdUserIds: string[] = [];
  const createdTerminalIds: string[] = [];

  const createUserWithToken = async (email: string, roleName: string, permissions: string[]) => {
    const id = generateId();
    createdUserIds.push(id);

    let role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      role = await prisma.role.create({ data: { id: generateId(), name: roleName } });
    }

    const user = await prisma.user.create({
      data: {
        id,
        email,
        password_hash: hashedAdminPassword,
        first_name: 'Test',
        last_name: roleName,
        status: 'active',
      },
    });

    await prisma.userRole.create({
      data: { user_id: id, role_id: role.id },
    });

    const token = jwt.sign({ userId: id }, config.jwt.secret, { expiresIn: '1h' });
    return { user, token };
  };

  beforeAll(async () => {
    const adminRes = await createUserWithToken(`admin-${ts}@test.com`, 'Admin', ['attendance:read', 'attendance:write_all']);
    adminUser = adminRes.user;
    adminToken = adminRes.token;

    const itAdminRes = await createUserWithToken(`itadmin-${ts}@test.com`, 'ITAdmin', ['attendance:read', 'attendance:write_all']);
    itAdminUser = itAdminRes.user;
    itAdminToken = itAdminRes.token;

    const gateRes = await createUserWithToken(`gate-${ts}@test.com`, 'GateOperator', ['attendance:write']);
    gateOperatorUser = gateRes.user;
    gateOperatorToken = gateRes.token;
  });

  afterAll(async () => {
    // Cleanup created terminals
    if (createdTerminalIds.length > 0) {
      await prisma.gateTerminal.deleteMany({
        where: { id: { in: createdTerminalIds } },
      });
    }

    // Cleanup created users
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { user_id: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  describe('1. Server-Side Gate Terminal Registry & RBAC', () => {
    let testTerminalId: string;

    it('Admin can register a new gate terminal on the server', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/terminals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          terminal_name: `Gate North Entrance ${ts}`,
          terminal_type: 'student',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.terminal_name).toBe(`Gate North Entrance ${ts}`);
      expect(res.body.data.terminal_type).toBe('student');
      expect(res.body.data.active).toBe(true);

      testTerminalId = res.body.data.id;
      createdTerminalIds.push(testTerminalId);

      // Verify in database
      const dbTerminal = await prisma.gateTerminal.findUnique({ where: { id: testTerminalId } });
      expect(dbTerminal).not.toBeNull();
      expect(dbTerminal?.terminal_type).toBe('student');
    });

    it('GateOperator CANNOT register a gate terminal (strictly 403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/terminals')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({
          terminal_name: `Hacked Terminal ${ts}`,
          terminal_type: 'faculty',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Admin can change terminal assignment from student to faculty', async () => {
      const res = await request(app)
        .patch(`/api/attendance/gate/terminals/${testTerminalId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          terminal_type: 'faculty',
          adminPassword: rawAdminPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.terminal_type).toBe('faculty');

      // Verify server-side database persistence
      const dbTerminal = await prisma.gateTerminal.findUnique({ where: { id: testTerminalId } });
      expect(dbTerminal?.terminal_type).toBe('faculty');
    });

    it('ITAdmin can reconfigure a terminal assignment', async () => {
      const res = await request(app)
        .patch(`/api/attendance/gate/terminals/${testTerminalId}`)
        .set('Authorization', `Bearer ${itAdminToken}`)
        .send({
          terminal_type: 'student',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.terminal_type).toBe('student');

      const dbTerminal = await prisma.gateTerminal.findUnique({ where: { id: testTerminalId } });
      expect(dbTerminal?.terminal_type).toBe('student');
    });

    it('GateOperator CANNOT reconfigure a terminal assignment (strictly 403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/attendance/gate/terminals/${testTerminalId}`)
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({
          terminal_type: 'faculty',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Reconfiguration rejects invalid administrator password', async () => {
      const res = await request(app)
        .patch(`/api/attendance/gate/terminals/${testTerminalId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          terminal_type: 'faculty',
          adminPassword: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Physical Kiosk Role Discovery & Synchronization', () => {
    let syncTerminalId: string;

    beforeAll(async () => {
      const t = await prisma.gateTerminal.create({
        data: {
          id: `kiosk-sync-${ts}`,
          terminal_name: 'Test Kiosk Turnstile',
          terminal_type: 'student',
          active: true,
        },
      });
      syncTerminalId = t.id;
      createdTerminalIds.push(syncTerminalId);
    });

    it('Physical kiosk retrieves its assigned role from backend', async () => {
      const res = await request(app)
        .get(`/api/attendance/gate/terminals/${syncTerminalId}`)
        .set('Authorization', `Bearer ${gateOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(syncTerminalId);
      expect(res.body.data.terminal_type).toBe('student');
    });

    it('When Admin remotely updates role to faculty, kiosk receives updated role on next fetch', async () => {
      // 1. Admin updates role to faculty
      await request(app)
        .patch(`/api/attendance/gate/terminals/${syncTerminalId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ terminal_type: 'faculty' });

      // 2. Kiosk polls its status
      const res = await request(app)
        .get(`/api/attendance/gate/terminals/${syncTerminalId}`)
        .set('Authorization', `Bearer ${gateOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.terminal_type).toBe('faculty');
    });

    it('Fallback on-device maintenance endpoint updates server-side assignment when terminalId is provided', async () => {
      // The kiosk is logged in as GateOperator (has a valid JWT session).
      // The Admin identity + password are provided in the body for secondary authorization.
      const res = await request(app)
        .post('/api/attendance/gate/terminal/reconfigure')
        .set('Authorization', `Bearer ${gateOperatorToken}`)
        .send({
          email: adminUser.email,
          password: rawAdminPassword,
          terminalId: syncTerminalId,
          terminalType: 'student',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.terminalType).toBe('student');

      // Verify database updated
      const dbTerminal = await prisma.gateTerminal.findUnique({ where: { id: syncTerminalId } });
      expect(dbTerminal?.terminal_type).toBe('student');
    });
  });

  describe('3. Production Security & Credential Hygiene Audit', () => {
    it('GateTerminalsManagement.tsx has no hardcoded demo credentials or password placeholders', () => {
      const filePath = path.resolve(__dirname, '../../src/app/admin/operations/GateTerminalsManagement.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Must not hardcode admin@demo.com in API payload
      expect(content).not.toContain("email: 'admin@demo.com'");
      expect(content).not.toContain('email: "admin@demo.com"');

      // Must not display demo password as placeholder or guidance
      expect(content).not.toContain('placeholder="password123"');
      expect(content).not.toContain("placeholder='password123'");
      expect(content).not.toContain('password123');
    });

    it('GateTerminalApp.tsx has no hardcoded password placeholders in maintenance modal', () => {
      const filePath = path.resolve(__dirname, '../../src/app/gate/GateTerminalApp.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).not.toContain('placeholder="password123"');
      expect(content).not.toContain("placeholder='password123'");
      expect(content).not.toContain('password123');
    });
  });
});
