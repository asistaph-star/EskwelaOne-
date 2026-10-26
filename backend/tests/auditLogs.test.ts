import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { resetAuthRateLimiter, setAuthRateLimits } from '../src/auth/auth.limiter.js';
import { createAuditLog, sanitizeMetadata } from '../src/audit/audit.service.js';
import { generateId } from '../src/common/utils/uuid.js';
import { DEFAULT_SCHOOL_SETTINGS } from '../src/settings/settings.service.js';

describe('DIGISKWELA — Audit Logs & Security Trail Test Suite', () => {
  let itAdminCookie: string;
  let adminCookie: string;
  let teacherCookie: string;
  let studentCookie: string;
  let itAdminUserId: string;

  beforeAll(async () => {
    resetAuthRateLimiter();

    // 1. ITAdmin (Full access)
    const itLogin = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'IT-001', password: 'password123' });
    expect(itLogin.status).toBe(200);
    const itCookies = itLogin.headers['set-cookie'] as string[];
    itAdminCookie = itCookies.find(c => c.startsWith('auth_token='))!;
    itAdminUserId = itLogin.body.data.user.id;

    // 2. Standard Admin (Operational access only)
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'ADM-001', password: 'password123' });
    expect(adminLogin.status).toBe(200);
    const adminCookies = adminLogin.headers['set-cookie'] as string[];
    adminCookie = adminCookies.find(c => c.startsWith('auth_token='))!;

    // 3. Teacher (Non-admin)
    const teacherLogin = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'EMP-T-001', password: 'password123' });
    expect(teacherLogin.status).toBe(200);
    const teacherCookies = teacherLogin.headers['set-cookie'] as string[];
    teacherCookie = teacherCookies.find(c => c.startsWith('auth_token='))!;

    // 4. Student (Non-admin)
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: '2026-00001', password: 'password123' });
    expect(studentLogin.status).toBe(200);
    const studentCookies = studentLogin.headers['set-cookie'] as string[];
    studentCookie = studentCookies.find(c => c.startsWith('auth_token='))!;
  });

  afterAll(async () => {
    resetAuthRateLimiter();
    // Restore default school settings to ensure strict test isolation
    await (prisma as any).schoolSettings.upsert({
      where: { id: 'default' },
      update: DEFAULT_SCHOOL_SETTINGS,
      create: DEFAULT_SCHOOL_SETTINGS,
    });
    await prisma.$disconnect();
  });

  // ─── 1. AUDIT PERSISTENCE & DATA MODEL ─────────────────────────────────────
  describe('1. Audit Persistence & Data Model Integrity', () => {
    it('creates an audit log entry with actor snapshot, category, target label, IP, and result', async () => {
      const testAction = `TEST_ACTION_${Date.now()}`;
      await createAuditLog({
        actorUserId: itAdminUserId,
        actorSchoolId: 'IT-001',
        actorRole: 'ITAdmin',
        action: testAction,
        category: 'SYSTEM',
        resourceType: 'system_test',
        resourceId: 'test-resource-id',
        targetLabel: 'Integration Test Resource',
        result: 'SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'Vitest Automated Agent',
        previousState: { status: 'draft' },
        newState: { status: 'published' },
        correlationId: 'test-correlation-id',
      });

      const entry = await prisma.auditLog.findFirst({
        where: { action: testAction },
      });

      expect(entry).toBeDefined();
      expect(entry!.actor_school_id).toBe('IT-001');
      expect(entry!.actor_role).toBe('ITAdmin');
      expect(entry!.category).toBe('SYSTEM');
      expect(entry!.resource_type).toBe('system_test');
      expect(entry!.resource_id).toBe('test-resource-id');
      expect(entry!.target_label).toBe('Integration Test Resource');
      expect(entry!.result).toBe('SUCCESS');
      expect(entry!.ip_address).toBe('127.0.0.1');
      expect(entry!.user_agent).toBe('Vitest Automated Agent');
      expect(entry!.created_at).toBeInstanceOf(Date);
    });

    it('sanitizes and redacts all sensitive fields from audit metadata', () => {
      const sensitiveInput = {
        username: 'testuser',
        password: 'SuperSecretPassword!',
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz',
        token: 'ey.secret.jwt.token',
        jwt: 'header.payload.signature',
        secretKey: 'key_12345',
        apiKey: 'api_67890',
        lrn: '123456789012',
        counseling_notes: 'Highly confidential student guidance notes',
        medical_conditions: 'Asthma diagnosis and prescriptions',
        guardian_phone: '09171234567',
        safeData: 'Regular operational data',
      };

      const sanitized = sanitizeMetadata(sensitiveInput);
      expect(sanitized!.password).toBe('[REDACTED]');
      expect(sanitized!.password_hash).toBe('[REDACTED]');
      expect(sanitized!.token).toBe('[REDACTED]');
      expect(sanitized!.jwt).toBe('[REDACTED]');
      expect(sanitized!.secretKey).toBe('[REDACTED]');
      expect(sanitized!.apiKey).toBe('[REDACTED]');
      expect(sanitized!.lrn).toBe('[REDACTED]');
      expect(sanitized!.counseling_notes).toBe('[REDACTED]');
      expect(sanitized!.medical_conditions).toBe('[REDACTED]');
      expect(sanitized!.guardian_phone).toBe('[REDACTED]');
      expect(sanitized!.safeData).toBe('Regular operational data');
    });
  });

  // ─── 2. AUTHENTICATION AUDIT EVENTS ────────────────────────────────────────
  describe('2. Authentication Audit Events', () => {
    it('audits login success with IP and user agent', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'DigiSkwela-Test-Browser')
        .send({ schoolId: 'IT-001', password: 'password123' });

      expect(res.status).toBe(200);

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'LOGIN_SUCCESS',
          actor_school_id: 'IT-001',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit!.category).toBe('AUTHENTICATION');
      expect(audit!.result).toBe('SUCCESS');
      expect(audit!.actor_role).toBe('ITAdmin');
      expect(audit!.user_agent).toBe('DigiSkwela-Test-Browser');
    });

    it('audits login failure for invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'DigiSkwela-Failed-Agent')
        .send({ schoolId: 'IT-001', password: 'WrongPassword999!' });

      expect(res.status).toBe(401);

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'LOGIN_FAILURE',
          actor_school_id: 'IT-001',
          reason: 'Invalid password',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit!.category).toBe('AUTHENTICATION');
      expect(audit!.result).toBe('FAILURE');
      expect(audit!.user_agent).toBe('DigiSkwela-Failed-Agent');
    });

    it('audits rate-limit trigger when login threshold is exceeded', async () => {
      // Configure temporary low threshold for deterministic rate-limit testing
      setAuthRateLimits({ maxAttempts: 2, windowMs: 60000 });

      // First two attempts fail
      await request(app).post('/api/auth/login').send({ schoolId: 'RATE-TEST-001', password: 'wrong' });
      await request(app).post('/api/auth/login').send({ schoolId: 'RATE-TEST-001', password: 'wrong' });

      // Third attempt trips rate limiter (429)
      const res = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'RateLimit-Test-Agent')
        .send({ schoolId: 'RATE-TEST-001', password: 'wrong' });

      expect(res.status).toBe(429);

      // Verify AUTH_RATE_LIMIT_TRIGGERED was audited
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'AUTH_RATE_LIMIT_TRIGGERED',
          target_label: 'RATE-TEST-001',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit!.category).toBe('SECURITY');
      expect(audit!.result).toBe('DENIED');

      // Reset limiter back to defaults
      resetAuthRateLimiter();
    });

    it('audits logout event with user identity', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'LOGOUT',
          actor_school_id: 'IT-001',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit!.category).toBe('AUTHENTICATION');
      expect(audit!.result).toBe('SUCCESS');
    });
  });

  // ─── 3. ACCOUNT ADMINISTRATION AUDIT EVENTS ────────────────────────────────
  describe('3. Account Administration Events', () => {
    let createdUserUuid: string;
    const uniqueSchoolId = `TEST-T-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 9000 + 1000)}`;

    it('audits user account creation with roles and target details', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Cookie', [itAdminCookie])
        .send({
          schoolId: uniqueSchoolId,
          email: `${uniqueSchoolId.toLowerCase()}@calulut.edu.ph`,
          firstName: 'Audit',
          lastName: 'Tester',
          roles: ['Teacher'],
          teacherProfile: {
            employeeId: uniqueSchoolId,
            department: 'Science',
            position: 'Teacher I',
          },
        });

      expect(res.status).toBe(201);
      createdUserUuid = res.body.data.user.id;

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'USER_CREATED',
          resource_id: createdUserUuid,
        },
      });

      expect(audit).toBeDefined();
      expect(audit!.category).toBe('ACCOUNT');
      expect(audit!.result).toBe('SUCCESS');
      expect(audit!.target_label).toContain(uniqueSchoolId);
      expect(audit!.new_state).toBeDefined();
    });

    it('audits account status modification as USER_STATUS_CHANGED', async () => {
      const res = await request(app)
        .patch(`/api/users/${createdUserUuid}`)
        .set('Cookie', [itAdminCookie])
        .send({ status: 'inactive' });

      expect(res.status).toBe(200);

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'USER_STATUS_CHANGED',
          resource_id: createdUserUuid,
        },
        orderBy: { created_at: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit!.category).toBe('ACCOUNT');
      expect(audit!.result).toBe('SUCCESS');
      expect(audit!.target_label).toContain(uniqueSchoolId);
    });

    it('audits administrative password reset without leaking temporary password', async () => {
      const res = await request(app)
        .post(`/api/users/${createdUserUuid}/reset-password`)
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.temporaryPassword).toBeDefined();

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'USER_PASSWORD_RESET',
          resource_id: createdUserUuid,
        },
        orderBy: { created_at: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit!.category).toBe('ACCOUNT');
      expect(audit!.result).toBe('SUCCESS');
      // Ensure temporary password is NOT logged in audit record
      const serialized = JSON.stringify(audit);
      expect(serialized).not.toContain(res.body.data.temporaryPassword);
    });
  });

  // ─── 4. SCHOOL CONFIGURATION AUDIT EVENTS ──────────────────────────────────
  describe('4. School Configuration Events', () => {
    it('audits school settings update with field changes', async () => {
      const res = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', [itAdminCookie])
        .send({ primaryColor: '#0A192F', secondaryColor: '#1B3A6B' });

      expect(res.status).toBe(200);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'SCHOOL_SETTINGS_UPDATED' },
        orderBy: { created_at: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit!.category).toBe('CONFIGURATION');
      expect(audit!.result).toBe('SUCCESS');
      expect(audit!.target_label).toBe('School Customization Settings');
    });

    it('audits school branding reset', async () => {
      const res = await request(app)
        .post('/api/settings/school/reset')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'SCHOOL_SETTINGS_BRANDING_RESET' },
        orderBy: { created_at: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit!.category).toBe('CONFIGURATION');
      expect(audit!.result).toBe('SUCCESS');
      expect(audit!.target_label).toBe('School Visual Branding');
    });

    it('audits unauthorized modification attempt as AUTH_FORBIDDEN (DENIED)', async () => {
      // Non-ITAdmin attempts to modify settings
      const res = await request(app)
        .patch('/api/settings/school')
        .set('Cookie', [adminCookie])
        .send({ primaryColor: '#FF0000' });

      expect(res.status).toBe(403);

      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'AUTH_FORBIDDEN',
          resource_type: 'school_settings',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit!.category).toBe('SECURITY');
      expect(audit!.result).toBe('DENIED');
      expect(audit!.actor_role).toBe('Admin');
    });
  });

  // ─── 5. RBAC & PORTAL ACCESS POLICY ────────────────────────────────────────
  describe('5. RBAC & Access Authorization', () => {
    it('ITAdmin has full access to query audit logs', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.summary).toBeDefined();
    });

    it('Standard Admin has operational access to audit logs', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('Standard Admin is blocked from inspecting SECURITY category logs', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs?category=SECURITY')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Teacher access is blocked with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', [teacherCookie]);

      expect(res.status).toBe(403);
    });

    it('Student access is blocked with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Cookie', [studentCookie]);

      expect(res.status).toBe(403);
    });

    it('Unauthenticated access is blocked with 401 Unauthorized', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs');

      expect(res.status).toBe(401);
    });
  });

  // ─── 6. APPEND-ONLY IMMUTABILITY ───────────────────────────────────────────
  describe('6. Append-Only Immutability Enforcement', () => {
    it('rejects POST to audit logs with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .post('/api/admin/audit-logs')
        .set('Cookie', [itAdminCookie])
        .send({ action: 'MALICIOUS_LOG_INSERT' });

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('rejects PUT to audit logs with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .put('/api/admin/audit-logs/any-id')
        .set('Cookie', [itAdminCookie])
        .send({ action: 'TAMPER_LOG' });

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('rejects PATCH to audit logs with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .patch('/api/admin/audit-logs/any-id')
        .set('Cookie', [itAdminCookie])
        .send({ result: 'SUCCESS' });

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('rejects DELETE to audit logs with 405 Method Not Allowed', async () => {
      const res = await request(app)
        .delete('/api/admin/audit-logs/any-id')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  // ─── 7. FILTERING & SERVER-SIDE PAGINATION ─────────────────────────────────
  describe('7. Filtering & Server-Side Pagination', () => {
    it('filters correctly by category', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs?category=ACCOUNT')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        expect(item.category).toBe('ACCOUNT');
      }
    });

    it('filters correctly by result', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs?result=SUCCESS')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      for (const item of res.body.data.items) {
        expect(item.result).toBe('SUCCESS');
      }
    });

    it('supports bounded pagination with correct page bounds', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs?page=1&pageSize=3')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeLessThanOrEqual(3);
      expect(res.body.data.pagination.pageSize).toBe(3);
      expect(res.body.data.pagination.page).toBe(1);
    });

    it('safely handles invalid pagination parameters without crashing', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs?page=-5&pageSize=9999')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.pageSize).toBe(100); // Capped at max 100
    });
  });

  // ─── 8. DETAIL INSPECTION & AUDIT-OF-AUDIT ──────────────────────────────────
  describe('8. Detail Inspection & Accountable Access', () => {
    it('retrieves sanitized log detail and emits AUDIT_LOG_VIEWED event', async () => {
      // Find an existing log
      const anyLog = await prisma.auditLog.findFirst({
        where: { action: { not: 'AUDIT_LOG_VIEWED' } },
      });
      expect(anyLog).toBeDefined();

      const res = await request(app)
        .get(`/api/admin/audit-logs/${anyLog!.id}`)
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(anyLog!.id);

      // Verify that AUDIT_LOG_VIEWED was recorded for oversight
      const viewAudit = await prisma.auditLog.findFirst({
        where: {
          action: 'AUDIT_LOG_VIEWED',
          resource_id: anyLog!.id,
        },
      });

      expect(viewAudit).toBeDefined();
      expect(viewAudit!.category).toBe('SYSTEM');
      expect(viewAudit!.actor_school_id).toBe('IT-001');
    });
  });

  // ─── 9. CSV EXPORT & FORMULA INJECTION MITIGATION ──────────────────────────
  describe('9. CSV Export & Spreadsheet Formula Injection Defense', () => {
    it('allows ITAdmin to export filtered CSV with safe formula neutralizers', async () => {
      // Insert a test record with potential formula injection payload (=SUM(A1:A10), -cmd)
      await createAuditLog({
        action: '=1+1',
        category: 'SYSTEM',
        resourceType: 'export_test',
        targetLabel: '+malicious_formula',
        reason: '@DDE("cmd";"/c calc";"__")',
        result: 'SUCCESS',
      });

      const res = await request(app)
        .get('/api/admin/audit-logs/export/csv')
        .set('Cookie', [itAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('.csv');

      const csvBody = res.text;
      // Formula cells beginning with =, +, -, @ must be prepended with a single quote (')
      expect(csvBody).toContain("'=1+1");
      expect(csvBody).toContain("'+malicious_formula");
      expect(csvBody).toContain("'@DDE");

      // Verify AUDIT_LOG_EXPORTED was recorded
      const exportAudit = await prisma.auditLog.findFirst({
        where: { action: 'AUDIT_LOG_EXPORTED' },
        orderBy: { created_at: 'desc' },
      });
      expect(exportAudit).toBeDefined();
      expect(exportAudit!.category).toBe('SYSTEM');
    });

    it('blocks Standard Admin from exporting audit logs', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/export/csv')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ─── 10. INTEGRITY VERIFICATION (CORRELATION ID, SOURCE IP, REDACTION) ───────
  describe('10. Integrity Verification (Correlation ID, Source IP, Recursive Redaction)', () => {
    describe('10.1 Correlation ID Integrity', () => {
      it('generates a valid 36-char UUID correlation ID for a normal request', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);

        const correlationHeader = res.headers['x-correlation-id'];
        expect(correlationHeader).toBeDefined();
        expect(correlationHeader).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(correlationHeader.length).toBe(36);
      });

      it('does NOT trust arbitrary client X-Correlation-ID headers', async () => {
        const res = await request(app)
          .get('/api/health')
          .set('X-Correlation-ID', 'attacker-controlled-value');

        expect(res.status).toBe(200);
        const correlationHeader = res.headers['x-correlation-id'];
        expect(correlationHeader).not.toBe('attacker-controlled-value');
        expect(correlationHeader).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      it('handles oversized client X-Correlation-ID without error or malformed audit persistence', async () => {
        const oversizedHeader = 'A'.repeat(5000);
        const res = await request(app)
          .post('/api/auth/login')
          .set('X-Correlation-ID', oversizedHeader)
          .send({ schoolId: 'NONEXISTENT-USER', password: 'password123' });

        expect(res.status).toBe(401);

        const audit = await prisma.auditLog.findFirst({
          where: { action: 'LOGIN_FAILURE', actor_school_id: 'NONEXISTENT-USER' },
          orderBy: { created_at: 'desc' },
        });

        expect(audit).toBeDefined();
        expect(audit!.correlation_id).toBeDefined();
        expect(audit!.correlation_id!.length).toBeLessThanOrEqual(36);
        expect(audit!.correlation_id).not.toBe(oversizedHeader);
        expect(audit!.correlation_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      it('ensures two unrelated requests receive distinct, unique correlation IDs', async () => {
        const sharedClientHeader = 'identical-client-value';
        const res1 = await request(app).get('/api/health').set('X-Correlation-ID', sharedClientHeader);
        const res2 = await request(app).get('/api/health').set('X-Correlation-ID', sharedClientHeader);

        expect(res1.headers['x-correlation-id']).toBeDefined();
        expect(res2.headers['x-correlation-id']).toBeDefined();
        expect(res1.headers['x-correlation-id']).not.toBe(res2.headers['x-correlation-id']);
      });
    });

    describe('10.2 Source IP & Trust Proxy Integrity', () => {
      it('ignores client X-Forwarded-For when trust proxy is disabled', async () => {
        const spoofedIp = '203.0.113.195';
        const res = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', spoofedIp)
          .send({ schoolId: 'SPOOF-IP-USER', password: 'password123' });

        expect(res.status).toBe(401);

        const audit = await prisma.auditLog.findFirst({
          where: { action: 'LOGIN_FAILURE', actor_school_id: 'SPOOF-IP-USER' },
          orderBy: { created_at: 'desc' },
        });

        expect(audit).toBeDefined();
        // Trust proxy is NOT enabled, so req.ip is direct socket remoteAddress (127.0.0.1 / ::ffff:127.0.0.1)
        expect(audit!.ip_address).not.toBe(spoofedIp);
        expect(audit!.ip_address).toMatch(/127\.0\.0\.1|::1/);
      });
    });

    describe('10.3 Recursive Redaction Integrity', () => {
      it('redacts sensitive fields in nested objects', () => {
        const nestedInput = {
          student: {
            lrn: '123456789012',
            guardian_email: 'guardian@example.com',
            safeName: 'Juan Dela Cruz',
          },
        };

        const result = sanitizeMetadata(nestedInput);
        expect(result.student.lrn).toBe('[REDACTED]');
        expect(result.student.guardian_email).toBe('[REDACTED]');
        expect(result.student.safeName).toBe('Juan Dela Cruz');
      });

      it('redacts sensitive fields in nested arrays', () => {
        const arrayInput = {
          payload: [
            {
              medical_conditions: 'Asthma / Bronchitis',
              conditionType: 'Chronic',
            },
          ],
        };

        const result = sanitizeMetadata(arrayInput);
        expect(result.payload[0].medical_conditions).toBe('[REDACTED]');
        expect(result.payload[0].conditionType).toBe('Chronic');
      });

      it('redacts sensitive fields in multi-depth nested arrays and preserves structure', () => {
        const deepInput = {
          deeply_nested: [
            [
              {
                guidance_notes: 'Highly confidential student consultation notes',
                counseling_notes: 'Follow-up behavioral session',
                sessionTopic: 'Career planning',
              },
            ],
          ],
        };

        const result = sanitizeMetadata(deepInput);
        expect(Array.isArray(result.deeply_nested)).toBe(true);
        expect(Array.isArray(result.deeply_nested[0])).toBe(true);
        expect(result.deeply_nested[0][0].guidance_notes).toBe('[REDACTED]');
        expect(result.deeply_nested[0][0].counseling_notes).toBe('[REDACTED]');
        expect(result.deeply_nested[0][0].sessionTopic).toBe('Career planning');
      });

      it('normalizes case and separators for sensitive field matching', () => {
        const variations = {
          LRN: 'synthetic-lrn',
          GUARDIAN_EMAIL: 'parent@example.com',
          'guardian-phone': '09181234567',
          GuardianContact: 'Emergency Contact Person',
          medicalConditions: 'Mild Allergies',
          Allergies: 'Peanuts',
          MedicalHistory: 'Chronic condition',
          Medications: 'Paracetamol',
          counselingNotes: 'Private notes',
          guidance_note: 'Confidential record',
          safeField: 'This is not sensitive',
        };

        const result = sanitizeMetadata(variations);
        expect(result.LRN).toBe('[REDACTED]');
        expect(result.GUARDIAN_EMAIL).toBe('[REDACTED]');
        expect(result['guardian-phone']).toBe('[REDACTED]');
        expect(result.GuardianContact).toBe('[REDACTED]');
        expect(result.medicalConditions).toBe('[REDACTED]');
        expect(result.Allergies).toBe('[REDACTED]');
        expect(result.MedicalHistory).toBe('[REDACTED]');
        expect(result.Medications).toBe('[REDACTED]');
        expect(result.counselingNotes).toBe('[REDACTED]');
        expect(result.guidance_note).toBe('[REDACTED]');
        expect(result.safeField).toBe('This is not sensitive');
      });

      it('persists sanitized state into database without sensitive values', async () => {
        const actionName = 'INTEGRITY_TEST_SENSITIVE_STATE';
        await createAuditLog({
          action: actionName,
          category: 'STUDENT_SERVICES',
          resourceType: 'student',
          previousState: {
            student: {
              lrn: '123456789012',
              guardian_phone: '09171234567',
            },
          },
          newState: {
            payload: [
              {
                medical_conditions: 'Severe asthma',
                guidance_notes: 'Academic performance review notes',
              },
            ],
          },
        });

        const entry = await prisma.auditLog.findFirst({
          where: { action: actionName },
        });

        expect(entry).toBeDefined();
        const prev = entry!.previous_state as any;
        const next = entry!.new_state as any;

        expect(prev.student.lrn).toBe('[REDACTED]');
        expect(prev.student.guardian_phone).toBe('[REDACTED]');
        expect(next.payload[0].medical_conditions).toBe('[REDACTED]');
        expect(next.payload[0].guidance_notes).toBe('[REDACTED]');

        // Full JSON string search confirms zero raw sensitive substrings
        const rawJsonString = JSON.stringify(entry);
        expect(rawJsonString).not.toContain('123456789012');
        expect(rawJsonString).not.toContain('09171234567');
        expect(rawJsonString).not.toContain('Severe asthma');
        expect(rawJsonString).not.toContain('Academic performance review notes');
      });
    });
  });
});
