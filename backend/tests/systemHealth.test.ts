import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { deriveOverallStatus } from '../src/health/systemHealth.service.js';

describe('DIGISKWELA — System Health Operational Visibility Test Suite', () => {
  let itAdminCookie: string;
  let adminCookie: string;
  let teacherCookie: string;
  let studentCookie: string;
  let principalCookie: string;
  let registrarCookie: string;
  let guidanceCookie: string;
  let nurseCookie: string;
  let gateOperatorCookie: string;

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

  // ─── 1. ACCESS CONTROL & RBAC ───────────────────────────────────────────────
  describe('1. Access Control & RBAC Policy', () => {
    it('allows ITAdmin full system status with technical diagnostic latency', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scope).toBe('FULL_ITADMIN');
      expect(res.body.data.status).toBeDefined();

      // Diagnostic latency must be present for ITAdmin
      expect(typeof res.body.data.components.database.latencyMs).toBe('number');
      expect(typeof res.body.data.components.api.latencyMs).toBe('number');

      // Application info must be present
      expect(res.body.data.application.name).toBe('DigiSkwela Core Application');
      expect(res.body.data.application.version).toBe('1.0.0');
    });

    it('allows Standard Admin operational overview while omitting technical diagnostics', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scope).toBe('OPERATIONAL_ADMIN');

      // Components must be present with operational messages
      expect(res.body.data.components.database.status).toBeDefined();
      expect(res.body.data.components.api.status).toBeDefined();

      // Technical diagnostic latency must not be disclosed to Standard Admin
      expect(res.body.data.components.database.latencyMs).toBeUndefined();
      expect(res.body.data.components.api.latencyMs).toBeUndefined();
    });

    it('blocks Teacher with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [teacherCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Student with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [studentCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Principal with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [principalCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Registrar with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [registrarCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Guidance with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [guidanceCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Nurse with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [nurseCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks GateOperator with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [gateOperatorCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks Unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/system-health');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects POST, PUT, PATCH, DELETE with 405 Method Not Allowed', async () => {
      const postRes = await request(app).post('/api/admin/system-health').set('Cookie', [itAdminCookie]);
      expect(postRes.status).toBe(405);

      const putRes = await request(app).put('/api/admin/system-health').set('Cookie', [itAdminCookie]);
      expect(putRes.status).toBe(405);

      const patchRes = await request(app).patch('/api/admin/system-health').set('Cookie', [itAdminCookie]);
      expect(patchRes.status).toBe(405);

      const deleteRes = await request(app).delete('/api/admin/system-health').set('Cookie', [itAdminCookie]);
      expect(deleteRes.status).toBe(405);
    });
  });

  // ─── 2. DETERMINISTIC STATUS & COMPONENT CHECKS ─────────────────────────────
  describe('2. Deterministic Status & Component Checks', () => {
    it('accurately reports core live dependencies as OPERATIONAL in healthy test environment', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      const { components, status } = res.body.data;

      expect(status).toBe('OPERATIONAL');
      expect(components.api.status).toBe('OPERATIONAL');
      expect(components.database.status).toBe('OPERATIONAL');
      expect(components.storage.status).toBe('OPERATIONAL');
      expect(components.gateEventService.status).toBe('OPERATIONAL');

      // AI is NOT_MONITORED (free-tier non-invasive check rule)
      expect(['NOT_MONITORED', 'NOT_CONFIGURED']).toContain(components.aiService.status);

      // Email is NOT_CONFIGURED (no SMTP service configured)
      expect(components.emailService.status).toBe('NOT_CONFIGURED');
    });

    it('correctly derives overall status according to deterministic rules', () => {
      // 1. All core dependencies operational -> OPERATIONAL
      expect(deriveOverallStatus('OPERATIONAL', 'OPERATIONAL', 'OPERATIONAL')).toBe('OPERATIONAL');

      // 2. Database unavailable -> UNAVAILABLE
      expect(deriveOverallStatus('UNAVAILABLE', 'OPERATIONAL', 'OPERATIONAL')).toBe('UNAVAILABLE');

      // 3. Storage degraded or unavailable -> DEGRADED
      expect(deriveOverallStatus('OPERATIONAL', 'DEGRADED', 'OPERATIONAL')).toBe('DEGRADED');
      expect(deriveOverallStatus('OPERATIONAL', 'UNAVAILABLE', 'OPERATIONAL')).toBe('DEGRADED');

      // 4. Gate event service unavailable -> DEGRADED
      expect(deriveOverallStatus('OPERATIONAL', 'OPERATIONAL', 'UNAVAILABLE')).toBe('DEGRADED');
    });
  });

  // ─── 3. INFORMATION DISCLOSURE & SECRET HYGIENE ─────────────────────────────
  describe('3. Information Disclosure & Secret Hygiene', () => {
    it('never exposes database credentials, JWT secrets, API keys, or raw stack traces', async () => {
      const res = await request(app)
        .get('/api/admin/system-health')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      const rawString = JSON.stringify(res.body);

      // Verify zero secret leakage
      expect(rawString).not.toContain('postgresql://');
      expect(rawString).not.toContain('prisma');
      expect(rawString).not.toContain('postgres');
      expect(rawString).not.toContain('password');
      expect(rawString).not.toContain('JWT_SECRET');
      expect(rawString).not.toContain('GROQ_API_KEY');
      expect(rawString).not.toContain('CLOUDFLARE_API_TOKEN');
      expect(rawString).not.toContain('S3_SECRET_KEY');
      expect(rawString).not.toContain('stack');
    });
  });

  // ─── 4. PUBLIC LIVENESS PRESERVATION ────────────────────────────────────────
  describe('4. Public Liveness Preservation', () => {
    it('preserves existing minimal public /api/health endpoint', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.version).toBe('1.0.0');
      expect(res.body.data.timestamp).toBeDefined();
    });
  });
});
