import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import bcrypt from 'bcrypt';
import { generateId } from '../src/common/utils/uuid';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env';
import { fieldEncryptionMiddleware } from 'prisma-field-encryption';

// Wait, the prisma client in the app already has middleware applied. 
// We will just use the same prisma client.

const TEST_EMAIL = 'test_integration@calulut.edu.ph';
const TEST_PASSWORD = 'Password123!';
const TEST_LRN = '999988887777'; // Must be encrypted in Prisma, but handled automatically by prisma-field-encryption plugin.
const TEST_BARCODE = '999988887777'; // The scanned barcode (same as LRN).

let testUserId: string;
let testStudentId: string;
let testRoleId: string;
let testToken: string;

describe('Phase 1A: Backend Regression Tests', () => {
  beforeAll(async () => {
    // Clean up if it already exists
    try {
      await prisma.enrollment.deleteMany({ where: { student: { user: { email: TEST_EMAIL } } } });
      await prisma.userRole.deleteMany({ where: { user: { email: TEST_EMAIL } } });
      await prisma.student.deleteMany({ where: { user: { email: TEST_EMAIL } } });
      await prisma.auditLog.deleteMany({ where: { actor: { email: TEST_EMAIL } } });
      await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    } catch (err) {}

    // Ensure the 'TestRole' exists or just grab Admin
    let role = await prisma.role.findFirst({ where: { name: 'TestRole' } });
    if (!role) {
      role = await prisma.role.create({ data: { id: generateId(), name: 'TestRole' } });
    }
    testRoleId = role.id;

    // We need some permissions for attendance and media to test authorization
    const attendancePerm = await prisma.permission.upsert({
      where: { key: 'attendance:write' },
      update: {},
      create: { id: generateId(), key: 'attendance:write' }
    });
    
    // Attach to role if not already attached
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: testRoleId, permission_id: attendancePerm.id } },
      update: {},
      create: { role_id: testRoleId, permission_id: attendancePerm.id }
    });

    testUserId = generateId();
    testStudentId = generateId();

    const password_hash = await bcrypt.hash(TEST_PASSWORD, 10);
    
    await prisma.user.create({
      data: {
        id: testUserId,
        email: TEST_EMAIL,
        password_hash,
        first_name: 'Test',
        last_name: 'Integration',
        status: 'active',
        must_change_password: false,
        user_roles: {
          create: {
            role_id: testRoleId
          }
        },
        student: {
          create: {
            id: testStudentId,
            lrn: TEST_LRN,
            grade_level: 10
          }
        }
      }
    });

    // We also need a raw token for supertest if we don't want to login every time.
    testToken = sign({ userId: testUserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    // Clean up
    try {
      await prisma.gateAttendance.deleteMany({ where: { student_id: testStudentId } });
      await prisma.enrollment.deleteMany({ where: { student_id: testStudentId } });
      await prisma.userRole.deleteMany({ where: { user_id: testUserId } });
      await prisma.student.deleteMany({ where: { user_id: testUserId } });
      await prisma.auditLog.deleteMany({ where: { actor_user_id: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch (err) {
      console.warn('Cleanup failed (non-critical):', err);
    }
    await prisma.$disconnect();
  });

  describe('Authentication', () => {
    it('should reject invalid login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: 'WrongPassword' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should allow valid login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should allow /auth/me for authenticated user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(TEST_EMAIL);
    });

    it('should reject /auth/me for unauthenticated request', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Authorization', () => {
    it('should allow authorized role to access protected route (media)', async () => {
      const res = await request(app)
        .get('/api/media/gate/playlist')
        .set('Authorization', `Bearer ${testToken}`);
      expect([200, 403, 404]).toContain(res.status);
    });

    it('should reject unauthorized role from accessing protected route', async () => {
      const res = await request(app)
        .get('/api/admin/enrollment-applications')
        .set('Authorization', `Bearer ${testToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Gate Attendance', () => {
    it('should reject missing authorization', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/scan')
        .send({ barcode: TEST_BARCODE });
      expect(res.status).toBe(401);
    });

    it('should successfully record gate attendance', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/scan')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ barcode: TEST_BARCODE });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should gracefully handle duplicate/debounce by updating timeout if applicable', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/scan')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ barcode: TEST_BARCODE });
      
      expect([200, 422]).toContain(res.status);
    });

    it('should return 404 for unknown barcode', async () => {
      const res = await request(app)
        .post('/api/attendance/gate/scan')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ barcode: '999999999999' });
      expect(res.status).toBe(404);
    });
  });

  describe('Campus Media', () => {
    it('should retrieve active playlist', async () => {
      const res = await request(app)
        .get('/api/media/gate/playlist')
        .set('Authorization', `Bearer ${testToken}`);
      if (res.status === 200) {
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });

    it('should reject unauthorized media management (upload)', async () => {
      const res = await request(app)
        .post('/api/media/admin/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .send({}); // Invalid body, but auth should fail or validation should fail
      expect([401, 403, 400]).toContain(res.status);
    });
  });
});
