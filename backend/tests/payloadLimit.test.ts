import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { resetAuthRateLimiter } from '../src/auth/auth.limiter.js';

describe('SEC-INFO-002 — Express Request Payload Size Scoping Suite', () => {
  let itAdminCookie: string;
  let gateOperatorCookie: string;

  beforeAll(async () => {
    resetAuthRateLimiter();

    // 1. Authenticate as ITAdmin
    const itLogin = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'IT-001',
        password: 'password123',
      });
    expect(itLogin.status).toBe(200);
    const itSetCookie = itLogin.headers['set-cookie'] as string[];
    itAdminCookie = itSetCookie.find(c => c.startsWith('auth_token='))!;

    // 2. Authenticate as GateOperator
    const gateLogin = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'GATE-001',
        password: 'password123',
      });
    expect(gateLogin.status).toBe(200);
    const gateSetCookie = gateLogin.headers['set-cookie'] as string[];
    gateOperatorCookie = gateSetCookie.find(c => c.startsWith('auth_token='))!;
  });

  afterAll(async () => {
    resetAuthRateLimiter();
    await prisma.$disconnect();
  });

  // TEST 1 — NORMAL API REQUEST
  it('TEST 1 — Normal JSON request below limit passes body parsing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'IT-001',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // TEST 2 — GLOBAL LIMIT EXCEEDED
  it('TEST 2 — JSON payload exceeding 1MB global limit is rejected with 413 Payload Too Large', async () => {
    // 1.05MB string exceeds 1MB limit (1048576 bytes)
    const oversizedPayload = {
      schoolId: 'IT-001',
      padding: 'x'.repeat(1.05 * 1024 * 1024),
    };

    const res = await request(app)
      .post('/api/auth/login')
      .send(oversizedPayload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error.message).toContain('exceeds the allowable size limit');
    // Ensure no stack trace, internal path, or payload content leaked
    expect(res.body.error).not.toHaveProperty('stack');
    expect(res.body.error).not.toHaveProperty('details');
    expect(JSON.stringify(res.body)).not.toContain('padding');
  });

  // TEST 3 — BELOW LIMIT
  it('TEST 3 — JSON payload near but below 1MB threshold is accepted by body parser', async () => {
    // 600KB payload is safely below the 1MB threshold
    const nearLimitPayload = {
      schoolId: 'TEST-UNKNOWN-SCHOOL-ID',
      password: 'wrongpassword',
      notes: 'x'.repeat(600 * 1024),
    };

    const res = await request(app)
      .post('/api/auth/login')
      .send(nearLimitPayload)
      .set('Content-Type', 'application/json');

    // Body parser accepted it -> reached authentication logic -> rejected with 401 INVALID_CREDENTIALS, NOT 413
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  // TEST 4 — FILE UPLOADS (MULTER) ARE INDEPENDENT OF JSON LIMIT
  it('TEST 4 — Multipart file upload is independent of express.json 1MB limit', async () => {
    // 1.2MB buffer for multipart file upload (> 1MB JSON limit)
    const largeFileBuffer = Buffer.alloc(1.2 * 1024 * 1024, 0xaa);

    const res = await request(app)
      .post('/api/media/admin/upload')
      .set('Cookie', itAdminCookie)
      .attach('file', largeFileBuffer, 'large-file.bin')
      .field('title', 'Large Test Media');

    // Multer handles multipart stream up to 50MB. It was NOT rejected with 413 by express.json.
    // Reaching file-type validation in media.routes.ts returns 400 (Invalid file type), proving Multer parsed it.
    expect(res.status).not.toBe(413);
    expect([400, 201]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.error.message).toContain('Invalid file type');
    }
  });

  // TEST 5 — ROUTE-SPECIFIC LARGE JSON
  it('TEST 5 — General authenticated endpoints remain bounded by the 1MB limit', async () => {
    const oversizedPayload = {
      classId: 'dummy-class-id',
      terms: 'x'.repeat(1.05 * 1024 * 1024),
    };

    const res = await request(app)
      .post('/api/gradebooks/ledger')
      .set('Cookie', itAdminCookie)
      .send(oversizedPayload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  // TEST 6 — AUTHENTICATION & RATE LIMITING PRESERVED
  it('TEST 6 — Authentication and login rate limiter function correctly under new payload limits', async () => {
    resetAuthRateLimiter();

    // 1. Normal successful login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'IT-001',
        password: 'password123',
      });
    expect(loginRes.status).toBe(200);

    // 2. Failed attempt within limits
    const failRes = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'IT-001',
        password: 'wrongpassword',
      });
    expect(failRes.status).toBe(401);
  });

  // TEST 7 — GATE SCAN & SSE PRESERVED
  it('TEST 7 — Gate scanning and SSE event stream remain unaffected', async () => {
    // Gate scan endpoint
    const scanRes = await request(app)
      .post('/api/attendance/gate/student/scan')
      .set('Cookie', gateOperatorCookie)
      .send({
        barcode: '123456789012',
      });

    // Valid scan succeeds (200 / 201) or returns normal application status (404 / 422), never 413
    expect(scanRes.status).not.toBe(413);
    expect([200, 201, 404, 422]).toContain(scanRes.status);

    // Gate SSE event stream authorization and availability
    const unauthSseRes = await request(app)
      .get('/api/attendance/gate/events');
    expect(unauthSseRes.status).toBe(401);

    // Endpoint is reachable and authorization middleware enforces attendance:read
    expect(unauthSseRes.body.error.code).toBe('UNAUTHORIZED');
  });

  // BONUS TEST 8 — Malformed JSON returns 400 BAD_REQUEST, not 500
  it('TEST 8 — Malformed JSON returns structured 400 BAD_REQUEST without stack leak', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ "schoolId": "broken-json');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error).not.toHaveProperty('stack');
  });
});
