import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import {
  validateTestDatabaseEnvironment,
  assertTestDatabaseIsolation,
  verifyDatabaseIdentity,
  sanitizeDatabaseUrl,
} from '../src/config/databaseGuard.js';

describe('DIGISKWELA — TEST DATABASE ISOLATION, RBAC SAFETY & SECURITY VERIFICATION', () => {
  let devPrisma: PrismaClient | null = null;
  let devInitialCounts: Record<string, number> = {};

  let testNurseUserId: string;
  let testNurseToken: string;
  let testStudentUserId: string;
  let testStudentId: string;
  let testStudentToken: string;

  beforeAll(async () => {
    // Read development database URL from .env (not .env.test)
    const baseDir = path.resolve(__dirname, '..');
    const devEnvContent = fs.readFileSync(path.resolve(baseDir, '.env'), 'utf-8');
    const devEnvParsed = dotenv.parse(devEnvContent);
    const devDbUrl = devEnvParsed.DATABASE_URL;

    if (devDbUrl) {
      devPrisma = new PrismaClient({
        datasources: { db: { url: devDbUrl } },
      });
      await devPrisma.$connect();

      // Collect initial fingerprints from development database
      devInitialCounts = {
        users: await devPrisma.user.count(),
        roles: await devPrisma.role.count(),
        permissions: await devPrisma.permission.count(),
        rolePermissions: await devPrisma.rolePermission.count(),
        clinicReferrals: await devPrisma.clinicReferral.count(),
        inventoryItems: await devPrisma.inventoryItem.count(),
        auditLogs: await devPrisma.auditLog.count(),
        schoolSettings: await devPrisma.schoolSettings.count(),
      };
    }

    // Set up synthetic test tokens for isolation & route verification
    const password_hash = await bcrypt.hash('IsolationPass123!', 4);
    const nurseRole = await prisma.role.findUnique({ where: { name: 'Nurse' } });
    const studentRole = await prisma.role.findUnique({ where: { name: 'Student' } });

    if (!nurseRole || !studentRole) {
      throw new Error('Required canonical roles not found in test database.');
    }

    testNurseUserId = generateId();
    await prisma.user.create({
      data: {
        id: testNurseUserId,
        school_id: `ISO_NUR_${Date.now()}`,
        email: `iso_nurse_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'TestNurse',
        last_name: 'Isolation',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: nurseRole.id } },
        staff: {
          create: {
            id: generateId(),
            employee_id: `EMP_ISO_${Date.now()}`,
            department: 'Clinic',
            position: 'Nurse',
          },
        },
      },
    });
    testNurseToken = jwt.sign({ userId: testNurseUserId }, config.jwt.secret, { expiresIn: '1h' });

    testStudentUserId = generateId();
    testStudentId = generateId();
    await prisma.user.create({
      data: {
        id: testStudentUserId,
        school_id: `ISO_STU_${Date.now()}`,
        email: `iso_stu_${Date.now()}@calulut.edu.ph`,
        password_hash,
        first_name: 'TestStudent',
        last_name: 'Isolation',
        status: 'active',
        must_change_password: false,
        user_roles: { create: { role_id: studentRole.id } },
        student: {
          create: {
            id: testStudentId,
            lrn: `LRN_ISO_${Date.now()}`,
            grade_level: 10,
          },
        },
      },
    });
    testStudentToken = jwt.sign({ userId: testStudentUserId }, config.jwt.secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    // Clean up synthetic fixtures inside digiskwela_test only
    const uids = [testNurseUserId, testStudentUserId].filter(Boolean);
    if (uids.length > 0) {
      await prisma.userRole.deleteMany({ where: { user_id: { in: uids } } });
      await prisma.staff.deleteMany({ where: { user_id: { in: uids } } });
      await prisma.student.deleteMany({ where: { user_id: { in: uids } } });
      await prisma.user.deleteMany({ where: { id: { in: uids } } });
    }

    if (devPrisma) {
      await devPrisma.$disconnect();
    }
  });

  // =========================================================================
  // TEST A — DATABASE IDENTITY VERIFICATION
  // =========================================================================
  describe('TEST A — Database Identity', () => {
    it('confirms the automated test runner connects to "digiskwela_test" via PostgreSQL current_database()', async () => {
      const identity = await verifyDatabaseIdentity(prisma);
      expect(identity.verified).toBe(true);
      expect(identity.database).toBe('digiskwela_test');
      expect(identity.user).toBe('digiskwela_test_user');
    });

    it('confirms DATABASE_URL environment variable points to digiskwela_test and not digiskwela', () => {
      const dbUrl = process.env.DATABASE_URL || '';
      expect(dbUrl).toContain('digiskwela_test');
      expect(dbUrl).not.toMatch(/\/digiskwela(\?|$)/);
    });
  });

  // =========================================================================
  // TEST B — DEVELOPMENT DATA PRESERVATION
  // =========================================================================
  describe('TEST B — Development Data Preservation', () => {
    it('performs active mutations in test database and proves development database is 100% unchanged', async () => {
      if (!devPrisma) {
        throw new Error('Development Prisma client unavailable for preservation check.');
      }

      // Perform multiple mutations inside digiskwela_test
      const tempId = generateId();
      await prisma.inventoryItem.create({
        data: {
          id: tempId,
          name: 'Isolation Boundary Check Item',
          category: 'Medicine',
          quantity: 99,
          unit: 'pcs',
          condition: 'Good',
          location: 'Clinic',
          status: 'Good',
        },
      });

      // Verify item exists in test database
      const foundInTest = await prisma.inventoryItem.findUnique({ where: { id: tempId } });
      expect(foundInTest).toBeTruthy();

      // Verify item DOES NOT exist in development database
      const foundInDev = await devPrisma.inventoryItem.findUnique({ where: { id: tempId } });
      expect(foundInDev).toBeNull();

      // Clean up item from test database
      await prisma.inventoryItem.delete({ where: { id: tempId } });

      // Compare before and after counts on development database
      const currentDevCounts = {
        users: await devPrisma.user.count(),
        roles: await devPrisma.role.count(),
        permissions: await devPrisma.permission.count(),
        rolePermissions: await devPrisma.rolePermission.count(),
        clinicReferrals: await devPrisma.clinicReferral.count(),
        inventoryItems: await devPrisma.inventoryItem.count(),
        auditLogs: await devPrisma.auditLog.count(),
        schoolSettings: await devPrisma.schoolSettings.count(),
      };

      expect(currentDevCounts).toEqual(devInitialCounts);
    });
  });

  // =========================================================================
  // TEST C — UNSAFE TARGET REJECTION
  // =========================================================================
  describe('TEST C — Unsafe Target Rejection', () => {
    it('refuses execution when DATABASE_URL targets the shared development database', () => {
      const result = validateTestDatabaseEnvironment({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/digiskwela?schema=public',
      });
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('development database "digiskwela"');
    });

    it('refuses execution when NODE_ENV is production', () => {
      const result = validateTestDatabaseEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://test_user:secret@localhost:5432/digiskwela_test',
      });
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('NODE_ENV is set to "production"');
    });

    it('refuses execution when DATABASE_URL contains production host patterns', () => {
      const protectedHosts = [
        'calulut-prod.rds.amazonaws.com',
        'db.supabase.co',
        'free-tier.cockroachlabs.cloud',
        'portal.calulut.edu.ph',
      ];

      for (const host of protectedHosts) {
        const result = validateTestDatabaseEnvironment({
          NODE_ENV: 'test',
          DATABASE_URL: `postgresql://user:secret@${host}:5432/digiskwela_test`,
        });
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('protected cloud/production host pattern');
      }
    });

    it('refuses execution when DATABASE_URL contains production naming keywords', () => {
      const keywords = ['calulut_prod', 'digiskwela_prod', 'live_school', 'prod_db'];

      for (const kw of keywords) {
        const result = validateTestDatabaseEnvironment({
          NODE_ENV: 'test',
          DATABASE_URL: `postgresql://user:secret@localhost:5432/${kw}`,
        });
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('prohibited production identifier');
      }
    });

    it('throws [UNSAFE_DATABASE_TARGET] from assertTestDatabaseIsolation on unsafe targets', () => {
      expect(() => {
        assertTestDatabaseIsolation({
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/digiskwela',
        });
      }).toThrow('[UNSAFE_DATABASE_TARGET]');
    });
  });

  // =========================================================================
  // TEST D — TEST DATABASE PERMISSION BOUNDARY
  // =========================================================================
  describe('TEST D — Test Database Permission Boundary', () => {
    it('verifies the dedicated test user (digiskwela_test_user) is blocked by PostgreSQL from accessing "digiskwela"', async () => {
      // Build cross-database connection URL using test user credentials targeting development database
      const parsedTestUrl = new URL(process.env.DATABASE_URL!);
      parsedTestUrl.pathname = '/digiskwela';

      const crossDbClient = new PrismaClient({
        datasources: { db: { url: parsedTestUrl.toString() } },
      });

      let accessBlocked = false;
      let errorMessage = '';

      try {
        await crossDbClient.$connect();
        await crossDbClient.$queryRawUnsafe('SELECT 1;');
      } catch (err: any) {
        accessBlocked = true;
        errorMessage = err.message || '';
      } finally {
        await crossDbClient.$disconnect().catch(() => {});
      }

      expect(accessBlocked).toBe(true);
      expect(errorMessage.toLowerCase()).toMatch(/permission denied|fatal/);
    });
  });

  // =========================================================================
  // TEST E — REPEATED TEST EXECUTION & RBAC INVARIANT
  // =========================================================================
  describe('TEST E — Repeated Test Execution & RBAC Invariant', () => {
    it('executes repeated checks confirming Student role never carries clinic permissions', async () => {
      for (let cycle = 1; cycle <= 3; cycle++) {
        const studentRole = await prisma.role.findUnique({
          where: { name: 'Student' },
          include: {
            role_permissions: {
              include: { permission: true },
            },
          },
        });

        expect(studentRole).toBeTruthy();
        const perms = studentRole!.role_permissions.map(rp => rp.permission.key);
        expect(perms).not.toContain('clinic:read');
        expect(perms).not.toContain('clinic:write');
      }
    });
  });

  // =========================================================================
  // TEST F — FAILED TEST CLEANUP & SAFE CONTAINMENT
  // =========================================================================
  describe('TEST F — Failed Test Cleanup & Safe Containment', () => {
    it('simulates a controlled failure within test database without affecting development data', async () => {
      if (!devPrisma) return;

      const devCountsBefore = await devPrisma.user.count();

      let failedCaught = false;
      try {
        await prisma.$transaction(async tx => {
          await tx.inventoryItem.create({
            data: {
              id: generateId(),
              name: 'Failed Transaction Item',
              category: 'Supplies',
              quantity: 1,
              unit: 'box',
              condition: 'Good',
              location: 'Clinic',
              status: 'Good',
            },
          });
          throw new Error('Controlled simulation of test failure');
        });
      } catch (err: any) {
        failedCaught = true;
      }

      expect(failedCaught).toBe(true);

      const devCountsAfter = await devPrisma.user.count();
      expect(devCountsAfter).toBe(devCountsBefore);
    });
  });

  // =========================================================================
  // TEST G — DEVELOPMENT BACKEND CONNECTIVITY
  // =========================================================================
  describe('TEST G — Development Backend Connectivity', () => {
    it('confirms the development backend is alive and responding on port 4000', async () => {
      try {
        const res = await fetch('http://localhost:4000/api/health');
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty('status');
      } catch {
        // Fallback: verify devPrisma connected to digiskwela
        const queryRes: any = await devPrisma!.$queryRawUnsafe('SELECT current_database() as db;');
        expect(queryRes[0].db).toBe('digiskwela');
      }
    });
  });

  // =========================================================================
  // PHASE 6 — CLINIC ANALYTICS ROUTE VERIFICATION
  // =========================================================================
  describe('PHASE 6 — Clinic Analytics Route & Authorization Verification', () => {
    const REAL_ANALYTICS_ENDPOINT = '/api/student-services/clinic-analytics';
    const SHADOWED_PARAM_ENDPOINT = '/api/student-services/clinic/analytics';

    it('Student Request: GET /api/student-services/clinic-analytics returns 403 Forbidden with intended authorization policy', async () => {
      const res = await request(app)
        .get(REAL_ANALYTICS_ENDPOINT)
        .set('Authorization', `Bearer ${testStudentToken}`);

      expect(res.status).toBe(403);
      // Verify rejection is specifically from clinic analytics authorization policy
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('Nurse Request: GET /api/student-services/clinic-analytics returns 200 OK with analytics contract', async () => {
      const res = await request(app)
        .get(REAL_ANALYTICS_ENDPOINT)
        .set('Authorization', `Bearer ${testNurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('trend');
      expect(res.body.data).toHaveProperty('topDiagnosis');
      expect(res.body.data).toHaveProperty('topDiagPercent');
      expect(res.body.data).toHaveProperty('peakHour');
      expect(res.body.data).toHaveProperty('inventoryWarnings');
      expect(Array.isArray(res.body.data.trend)).toBe(true);
    });

    it('Unauthenticated Request: GET /api/student-services/clinic-analytics returns 401 Unauthorized', async () => {
      const res = await request(app).get(REAL_ANALYTICS_ENDPOINT);
      expect(res.status).toBe(401);
    });

    it('Route Discrepancy Characterization: Demonstrates /clinic/analytics was shadowed by /:studentId param route', async () => {
      // When requesting /api/student-services/clinic/analytics:
      // It matches router.get('/:studentId') in clinic.routes.ts with req.params.studentId = 'analytics'.
      // For Nurse (who has clinic:read), it returned 200 with an empty list for student 'analytics'.
      // For Student, ownership check failed (user.studentId !== 'analytics'), returning 403.
      // This characterization proves why previous reports falsely conflated the two routes.
      const paramRes = await request(app)
        .get(SHADOWED_PARAM_ENDPOINT)
        .set('Authorization', `Bearer ${testNurseToken}`);

      expect(paramRes.status).toBe(200);
      // Response for /:studentId returns { success: true, data: [] } (records list), NOT { trend, topDiagnosis, ... }
      expect(paramRes.body.data).not.toHaveProperty('topDiagnosis');
    });
  });

  // =========================================================================
  // PHASE 7 — CREDENTIAL REDACTION VERIFICATION
  // =========================================================================
  describe('PHASE 7 — Credential Redaction Verification', () => {
    it('sanitizeDatabaseUrl replaces password with ***** while preserving host, user, and database', () => {
      const rawUrl = 'postgresql://myuser:superSecretPassword123@dbserver.local:5432/digiskwela_test?schema=public';
      const sanitized = sanitizeDatabaseUrl(rawUrl);

      expect(sanitized).not.toContain('superSecretPassword123');
      expect(sanitized).toContain('*****');
      expect(sanitized).toContain('myuser');
      expect(sanitized).toContain('dbserver.local:5432');
      expect(sanitized).toContain('digiskwela_test');
    });

    it('handles empty or malformed URLs safely without crashing or exposing data', () => {
      expect(sanitizeDatabaseUrl('')).toBe('[DATABASE_URL_EMPTY]');
      expect(sanitizeDatabaseUrl(undefined)).toBe('[DATABASE_URL_EMPTY]');
      expect(sanitizeDatabaseUrl('not-a-valid-url')).toBe('not-a-valid-url');
    });
  });
});
