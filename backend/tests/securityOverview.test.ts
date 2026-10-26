import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';

describe('DIGISKWELA — Security & Access Overview Test Suite', () => {
  let itAdminCookie: string;
  let adminCookie: string;
  let teacherCookie: string;
  let studentCookie: string;
  let principalCookie: string;
  let registrarCookie: string;
  let guidanceCookie: string;
  let nurseCookie: string;
  let gateOperatorCookie: string;

  const testActionPrefix = `SEC_TEST_${Date.now()}`;

  beforeAll(async () => {
    // 1. ITAdmin
    const itRes = await request(app).post('/api/auth/login').send({ schoolId: 'IT-001', password: 'password123' });
    expect(itRes.status).toBe(200);
    itAdminCookie = (itRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 2. Admin
    const adminRes = await request(app).post('/api/auth/login').send({ schoolId: 'ADM-001', password: 'password123' });
    expect(adminRes.status).toBe(200);
    adminCookie = (adminRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 3. Teacher
    const teacherRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-T-001', password: 'password123' });
    expect(teacherRes.status).toBe(200);
    teacherCookie = (teacherRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 4. Student
    const studentRes = await request(app).post('/api/auth/login').send({ schoolId: '2026-00001', password: 'password123' });
    expect(studentRes.status).toBe(200);
    studentCookie = (studentRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 5. Principal
    const principalRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-P-001', password: 'password123' });
    expect(principalRes.status).toBe(200);
    principalCookie = (principalRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 6. Registrar
    const regRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-R-001', password: 'password123' });
    expect(regRes.status).toBe(200);
    registrarCookie = (regRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 7. Guidance
    const guidRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-G-001', password: 'password123' });
    expect(guidRes.status).toBe(200);
    guidanceCookie = (guidRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 8. Nurse
    const nurseRes = await request(app).post('/api/auth/login').send({ schoolId: 'EMP-N-001', password: 'password123' });
    expect(nurseRes.status).toBe(200);
    nurseCookie = (nurseRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // 9. GateOperator
    const gateRes = await request(app).post('/api/auth/login').send({ schoolId: 'GATE-001', password: 'password123' });
    expect(gateRes.status).toBe(200);
    gateOperatorCookie = (gateRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;
  });

  afterAll(async () => {
    // Clean up any test audit logs inserted during test run
    await prisma.auditLog.deleteMany({
      where: {
        action: { startsWith: testActionPrefix },
      },
    });
  });

  // ─── 1. ACCESS CONTROL & RBAC ───────────────────────────────────────────────
  describe('1. Access Control & RBAC Policy', () => {
    it('allows ITAdmin full access to all security and operational metrics', async () => {
      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scope).toBe('FULL_ITADMIN');

      // KPIs must all be populated (not null) for ITAdmin
      expect(typeof res.body.data.kpis.failedLogins).toBe('number');
      expect(typeof res.body.data.kpis.rateLimits).toBe('number');
      expect(typeof res.body.data.kpis.authDenials).toBe('number');
      expect(typeof res.body.data.kpis.passwordResets).toBe('number');
      expect(typeof res.body.data.kpis.statusChanges).toBe('number');

      // Account status must be present
      expect(res.body.data.accountStatus.totalAccounts).toBeGreaterThan(0);
      expect(res.body.data.accountStatus.activeAccounts).toBeGreaterThan(0);

      // Recent events array must be present
      expect(Array.isArray(res.body.data.recentEvents)).toBe(true);
    });

    it('allows Standard Admin operational access while restricting security-sensitive metrics', async () => {
      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scope).toBe('OPERATIONAL_ADMIN');

      // Low-level security KPIs must be null for Standard Admin
      expect(res.body.data.kpis.failedLogins).toBeNull();
      expect(res.body.data.kpis.rateLimits).toBeNull();
      expect(res.body.data.kpis.authDenials).toBeNull();

      // Operational KPIs must remain accessible
      expect(typeof res.body.data.kpis.passwordResets).toBe('number');
      expect(typeof res.body.data.kpis.statusChanges).toBe('number');

      // Account status remains accessible
      expect(res.body.data.accountStatus.totalAccounts).toBeGreaterThan(0);
    });

    it('blocks Teacher with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [teacherCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [studentCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Principal with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [principalCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Registrar with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [registrarCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Guidance Counselor with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [guidanceCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Nurse with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [nurseCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Gate Operator with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [gateOperatorCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/security-overview');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects POST, PUT, PATCH, DELETE with 405 Method Not Allowed', async () => {
      const postRes = await request(app)
        .post('/api/admin/security-overview')
        .set('Cookie', [itAdminCookie]);
      expect(postRes.status).toBe(405);

      const putRes = await request(app)
        .put('/api/admin/security-overview')
        .set('Cookie', [itAdminCookie]);
      expect(putRes.status).toBe(405);

      const patchRes = await request(app)
        .patch('/api/admin/security-overview')
        .set('Cookie', [itAdminCookie]);
      expect(patchRes.status).toBe(405);

      const deleteRes = await request(app)
        .delete('/api/admin/security-overview')
        .set('Cookie', [itAdminCookie]);
      expect(deleteRes.status).toBe(405);
    });
  });

  // ─── 2. TIME WINDOW & METRIC AGGREGATION ACCURACY ───────────────────────────
  describe('2. Time Window & Metric Aggregation Accuracy', () => {
    it('accurately bounds events within 24-hour vs 7-day reporting windows', async () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);

      // Pre-query baseline counts
      const baseline24hRes = await request(app)
        .get('/api/admin/security-overview?timeWindow=24h')
        .set('Cookie', [itAdminCookie]);
      const initialFailed24h = baseline24hRes.body.data.kpis.failedLogins;

      const baseline7dRes = await request(app)
        .get('/api/admin/security-overview?timeWindow=7d')
        .set('Cookie', [itAdminCookie]);
      const initialFailed7d = baseline7dRes.body.data.kpis.failedLogins;

      // Insert: 1 failure at 2 hours ago (inside 24h & 7d)
      await prisma.auditLog.create({
        data: {
          id: generateId(),
          action: 'LOGIN_FAILURE',
          category: 'AUTHENTICATION',
          resource_type: 'auth',
          target_label: `${testActionPrefix}_RECENT`,
          result: 'FAILURE',
          created_at: twoHoursAgo,
        },
      });

      // Insert: 1 failure at 3 days ago (outside 24h, inside 7d)
      await prisma.auditLog.create({
        data: {
          id: generateId(),
          action: 'LOGIN_FAILURE',
          category: 'AUTHENTICATION',
          resource_type: 'auth',
          target_label: `${testActionPrefix}_MID`,
          result: 'FAILURE',
          created_at: threeDaysAgo,
        },
      });

      // Insert: 1 failure at 10 days ago (outside both 24h & 7d)
      await prisma.auditLog.create({
        data: {
          id: generateId(),
          action: 'LOGIN_FAILURE',
          category: 'AUTHENTICATION',
          resource_type: 'auth',
          target_label: `${testActionPrefix}_OLD`,
          result: 'FAILURE',
          created_at: tenDaysAgo,
        },
      });

      // Query 24h window: must increment by exactly 1
      const res24h = await request(app)
        .get('/api/admin/security-overview?timeWindow=24h')
        .set('Cookie', [itAdminCookie]);

      expect(res24h.body.data.timeWindow).toBe('24h');
      expect(res24h.body.data.kpis.failedLogins).toBe(initialFailed24h + 1);

      // Query 7d window: must increment by exactly 2 (twoHoursAgo + threeDaysAgo, excluding tenDaysAgo)
      const res7d = await request(app)
        .get('/api/admin/security-overview?timeWindow=7d')
        .set('Cookie', [itAdminCookie]);

      expect(res7d.body.data.timeWindow).toBe('7d');
      expect(res7d.body.data.kpis.failedLogins).toBe(initialFailed7d + 2);
    });

    it('accurately counts rate limits, auth denials, password resets, and status changes', async () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

      const beforeRes = await request(app)
        .get('/api/admin/security-overview?timeWindow=24h')
        .set('Cookie', [itAdminCookie]);

      const initialRateLimits = beforeRes.body.data.kpis.rateLimits;
      const initialDenials = beforeRes.body.data.kpis.authDenials;
      const initialResets = beforeRes.body.data.kpis.passwordResets;
      const initialStatusChanges = beforeRes.body.data.kpis.statusChanges;

      // Insert one of each event
      await prisma.auditLog.createMany({
        data: [
          {
            id: generateId(),
            action: 'AUTH_RATE_LIMIT_TRIGGERED',
            category: 'SECURITY',
            resource_type: 'auth',
            result: 'DENIED',
            created_at: oneHourAgo,
          },
          {
            id: generateId(),
            action: 'AUTH_FORBIDDEN',
            category: 'SECURITY',
            resource_type: 'settings',
            result: 'DENIED',
            created_at: oneHourAgo,
          },
          {
            id: generateId(),
            action: 'USER_PASSWORD_RESET',
            category: 'ACCOUNT',
            resource_type: 'user',
            result: 'SUCCESS',
            created_at: oneHourAgo,
          },
          {
            id: generateId(),
            action: 'USER_STATUS_CHANGED',
            category: 'ACCOUNT',
            resource_type: 'user',
            result: 'SUCCESS',
            created_at: oneHourAgo,
          },
        ],
      });

      const afterRes = await request(app)
        .get('/api/admin/security-overview?timeWindow=24h')
        .set('Cookie', [itAdminCookie]);

      expect(afterRes.body.data.kpis.rateLimits).toBe(initialRateLimits + 1);
      expect(afterRes.body.data.kpis.authDenials).toBe(initialDenials + 1);
      expect(afterRes.body.data.kpis.passwordResets).toBe(initialResets + 1);
      expect(afterRes.body.data.kpis.statusChanges).toBe(initialStatusChanges + 1);
    });
  });

  // ─── 3. LIVE ACCOUNT STATE VERIFICATION ─────────────────────────────────────
  describe('3. Live Account State Verification', () => {
    it('returns exact counts corresponding to actual User model state', async () => {
      const [expectedTotal, expectedActive, expectedInactive, expectedMustChange] =
        await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { status: 'active' } }),
          prisma.user.count({ where: { status: { not: 'active' } } }),
          prisma.user.count({ where: { must_change_password: true } }),
        ]);

      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      const acc = res.body.data.accountStatus;
      expect(acc.totalAccounts).toBe(expectedTotal);
      expect(acc.activeAccounts).toBe(expectedActive);
      expect(acc.inactiveAccounts).toBe(expectedInactive);
      expect(acc.passwordChangeRequired).toBe(expectedMustChange);
    });
  });

  // ─── 4. PRIVACY & SENSITIVE DATA DEFENSE ─────────────────────────────────────
  describe('4. Privacy & Sensitive Data Defense', () => {
    it('ensures zero raw sensitive fields or state objects leak in overview response', async () => {
      const res = await request(app)
        .get('/api/admin/security-overview')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      const responseString = JSON.stringify(res.body);

      // Verify zero sensitive leakages
      expect(responseString).not.toContain('password_hash');
      expect(responseString).not.toContain('passwordHash');
      expect(responseString).not.toContain('previous_state');
      expect(responseString).not.toContain('new_state');
      expect(responseString).not.toContain('counseling_notes');
      expect(responseString).not.toContain('medical_conditions');
      expect(responseString).not.toContain('diagnosis');

      // Verify recentEvents projection contains only safe scalar identifiers
      for (const evt of res.body.data.recentEvents) {
        expect(evt.id).toBeDefined();
        expect(evt.action).toBeDefined();
        expect(evt.created_at).toBeDefined();
        expect(evt).not.toHaveProperty('previous_state');
        expect(evt).not.toHaveProperty('new_state');
      }
    });
  });
});
