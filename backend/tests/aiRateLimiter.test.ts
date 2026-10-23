import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { aiConfig } from '../src/config/ai.config.js';
import { resetAIRateLimits } from '../src/ai/middleware/aiRateLimiter.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';

describe('DIGISKWELA — AI RATE LIMITER MIDDLEWARE (A2)', () => {
  let principalUserId: string;
  let principalToken: string;
  const originalMode = aiConfig.providerMode;
  const originalPerMinute = aiConfig.limits.rateLimitPerMinute;
  const originalPerDay = aiConfig.limits.rateLimitPerDay;

  beforeAll(async () => {
    aiConfig.providerMode = 'mock';

    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId,
        email: `ratelimit_prin_${Date.now()}@sindalan.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'RateLimitTest',
        status: 'active',
      },
    });

    const role = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (role) {
      await prisma.userRole.create({
        data: {
          user_id: principalUserId,
          role_id: role.id,
        },
      });
    }

    principalToken = jwt.sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '8h' });
  });

  afterAll(async () => {
    aiConfig.providerMode = originalMode;
    aiConfig.limits.rateLimitPerMinute = originalPerMinute;
    aiConfig.limits.rateLimitPerDay = originalPerDay;
    resetAIRateLimits();

    await prisma.aIAuditLog.deleteMany({ where: { user_id: principalUserId } });
    await prisma.userRole.deleteMany({ where: { user_id: principalUserId } });
    await prisma.user.deleteMany({ where: { id: principalUserId } });
  });

  beforeEach(() => {
    resetAIRateLimits();
    aiConfig.limits.rateLimitPerMinute = 3;
    aiConfig.limits.rateLimitPerDay = 5;
  });

  it('TC-RATE-01: Allows requests within normal rate boundaries', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Hello' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('TC-RATE-02: Returns HTTP 429 when per-minute limit is exceeded', async () => {
    aiConfig.limits.rateLimitPerMinute = 2;
    aiConfig.limits.rateLimitPerDay = 10;

    // Request 1: OK
    const r1 = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Req 1' }],
        portal: 'Principal',
      });
    expect(r1.status).toBe(200);

    // Request 2: OK
    const r2 = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Req 2' }],
        portal: 'Principal',
      });
    expect(r2.status).toBe(200);

    // Request 3: Exceeds 2/minute -> 429
    const r3 = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Req 3' }],
        portal: 'Principal',
      });

    expect(r3.status).toBe(429);
    expect(r3.body.success).toBe(false);
    expect(r3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(r3.body.error.message).toContain('maximum number of AI requests per minute');
  });

  it('TC-RATE-03: Returns HTTP 429 when per-day limit is exceeded', async () => {
    aiConfig.limits.rateLimitPerMinute = 10;
    aiConfig.limits.rateLimitPerDay = 2;

    // Request 1: OK
    const r1 = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Req 1' }],
        portal: 'Principal',
      });
    expect(r1.status).toBe(200);

    // Request 2: OK
    const r2 = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Req 2' }],
        portal: 'Principal',
      });
    expect(r2.status).toBe(200);

    // Request 3: Exceeds 2/day -> 429
    const r3 = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Req 3' }],
        portal: 'Principal',
      });

    expect(r3.status).toBe(429);
    expect(r3.body.success).toBe(false);
    expect(r3.body.error.code).toBe('DAILY_LIMIT_EXCEEDED');
    expect(r3.body.error.message).toContain('maximum daily limit for AI requests');
  });
});
