import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import app from '../src/app.js';
import { createSecurityHeadersMiddleware } from '../src/common/middleware/securityHeaders.js';

describe('SEC-FRONT-001 — HTTP Security Headers & Browser Hardening Suite', () => {
  it('TEST 1 — MIME Sniffing: X-Content-Type-Options is set to nosniff', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('TEST 2 — Frame / Clickjacking Protection: X-Frame-Options and CSP frame-ancestors are properly configured', async () => {
    const res = await request(app).get('/api/health');

    // X-Frame-Options should be SAMEORIGIN
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');

    // CSP frame-ancestors should restrict framing to 'self'
    const csp = res.headers['content-security-policy'] || '';
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it('TEST 3 — Referrer Policy: set to strict-origin-when-cross-origin', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('TEST 4 — Content Security Policy: Bounded, non-wildcard policy is enforced', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'];

    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://docs.opencv.org");
    expect(csp).toContain("style-src 'self' https://fonts.googleapis.com 'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");

    // Must NOT contain broad permissive wildcards
    expect(csp).not.toContain('default-src *');
    expect(csp).not.toContain('script-src *');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('TEST 5 — HSTS Environment Behavior: Disabled in Development HTTP, Enforced in Production HTTPS', async () => {
    // 1. Current app in development mode: HSTS should NOT be sent over local HTTP
    const devRes = await request(app).get('/api/health');
    expect(devRes.headers['strict-transport-security']).toBeUndefined();

    // 2. Production instance: HSTS must be configured with 1-year maxAge, includeSubDomains, preload
    const prodApp = express();
    prodApp.use(createSecurityHeadersMiddleware(true)); // simulate production = true
    prodApp.get('/test-prod', (_req, res) => res.json({ ok: true }));

    const prodRes = await request(prodApp).get('/test-prod');
    expect(prodRes.headers['strict-transport-security']).toBeDefined();
    expect(prodRes.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(prodRes.headers['strict-transport-security']).toContain('includeSubDomains');
    expect(prodRes.headers['strict-transport-security']).toContain('preload');
  });

  it('TEST 6 — Cross-Origin Resource Policy: Preserves cross-origin asset/media loading', async () => {
    const res = await request(app).get('/api/health');

    // CORP must be cross-origin so the separate frontend dev/prod origin can load static assets
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('TEST 7 — API Functionality: Status codes, JSON payloads, and authentication routes preserved', async () => {
    // Unauthenticated health check
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.success).toBe(true);
    expect(health.body.data.status).toBe('healthy');

    // Authentication failure on invalid credentials remains 401
    const authFail = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'NONEXISTENT', password: 'bad' });
    expect(authFail.status).toBe(401);
    expect(authFail.body.success).toBe(false);
    expect(authFail.headers['x-content-type-options']).toBe('nosniff');

    // 404 handler preserves error structure and security headers
    const notFound = await request(app).get('/api/non-existent-endpoint');
    expect(notFound.status).toBe(404);
    expect(notFound.body.error.code).toBe('NOT_FOUND');
    expect(notFound.headers['x-content-type-options']).toBe('nosniff');
  });
});
