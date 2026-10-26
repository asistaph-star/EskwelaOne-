import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { hashPassword } from '../src/auth/auth.service.js';
import { generateId } from '../src/common/utils/uuid.js';
import {
  setAuthRateLimits,
  resetAuthRateLimiter,
} from '../src/auth/auth.limiter.js';

describe('SEC-AUTH-001 — Login Rate Limiting & Throttling Test Suite', () => {
  const createdUserIds: string[] = [];
  const tempSchoolId = `TEMP-${Date.now()}`.slice(0, 20);
  const tempPassword = 'TemporaryPassword123!';

  beforeAll(async () => {
    // Create a temporary user with must_change_password = true for Test 9
    const hashed = await hashPassword(tempPassword);
    let teacherRole = await prisma.role.findFirst({ where: { name: 'Teacher' } });
    if (!teacherRole) {
      teacherRole = await prisma.role.create({ data: { id: generateId(), name: 'Teacher' } });
    }

    const tempUserId = generateId();
    createdUserIds.push(tempUserId);
    await prisma.user.create({
      data: {
        id: tempUserId,
        school_id: tempSchoolId,
        email: `temp_${Date.now()}@example.com`,
        password_hash: hashed,
        first_name: 'Temp',
        last_name: 'User',
        status: 'active',
        must_change_password: true,
        user_roles: { create: { role_id: teacherRole.id } },
      },
    });
  });

  afterAll(async () => {
    resetAuthRateLimiter();
    if (createdUserIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { user_id: { in: createdUserIds } } }).catch(() => {});
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actor_user_id: { in: createdUserIds } },
            { resource_id: { in: createdUserIds } },
          ],
        },
      }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    resetAuthRateLimiter();
    setAuthRateLimits({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      maxIpAttempts: 50,
    });
  });

  it('TEST 1 — Failed authentication attempts below threshold return 401 INVALID_CREDENTIALS', async () => {
    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'EMP-T-001',
          password: 'IncorrectPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid credentials.');
    }
  });

  it('TEST 2 — Exceeding failed attempt threshold triggers 429 TOO_MANY_REQUESTS with Retry-After', async () => {
    // Perform 5 failed attempts (allowed under threshold)
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'EMP-T-001',
          password: 'WrongPassword!',
        });
      expect(res.status).toBe(401);
    }

    // 6th attempt must be throttled
    const throttledRes = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'EMP-T-001',
        password: 'WrongPassword!',
      });

    expect(throttledRes.status).toBe(429);
    expect(throttledRes.body.success).toBe(false);
    expect(throttledRes.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(throttledRes.body.error.message).toBe('Too many login attempts. Please try again later.');
    expect(throttledRes.headers['retry-after']).toBeDefined();
    expect(Number(throttledRes.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('TEST 3 — Generic failure response is identical between unknown School ID and wrong password', async () => {
    const unknownIdRes = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'NONEXISTENT-999',
        password: 'AnyPassword123!',
      });

    const wrongPasswordRes = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'EMP-T-001',
        password: 'IncorrectPassword123!',
      });

    expect(unknownIdRes.status).toBe(401);
    expect(wrongPasswordRes.status).toBe(401);
    expect(unknownIdRes.body.error).toEqual(wrongPasswordRes.body.error);
    expect(unknownIdRes.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownIdRes.body.error.message).toBe('Invalid credentials.');
  });

  it('TEST 4 — Rate limiting cannot be bypassed by School ID casing or whitespace variants', async () => {
    const variants = [
      'EMP-T-001',
      'emp-t-001',
      '  Emp-T-001  ',
      'EMP-t-001',
      '   emp-t-001',
    ];

    // Exhaust quota across variants
    for (const variant of variants) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: variant,
          password: 'WrongPassword123!',
        });
      expect(res.status).toBe(401);
    }

    // Next variant must be throttled because they resolve to the same canonical key
    const throttled = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: '  EMP-T-001  ',
        password: 'WrongPassword123!',
      });

    expect(throttled.status).toBe(429);
    expect(throttled.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('TEST 5 — Legitimate user can authenticate normally and resets failed attempt quota', async () => {
    // 3 failed attempts
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'EMP-T-001',
          password: 'WrongPassword!',
        });
    }

    // Successful login
    const validLogin = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'EMP-T-001',
        password: 'password123',
      });

    expect(validLogin.status).toBe(200);
    expect(validLogin.body.success).toBe(true);
    expect(validLogin.body.data.user.schoolId).toBe('EMP-T-001');

    // Quota should have been reset by successful login — next 3 failures should not trigger 429
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'EMP-T-001',
          password: 'WrongPasswordAgain!',
        });
      expect(res.status).toBe(401);
    }
  });

  it('TEST 6 — Email login remains disabled (returns 401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'teacher@calulut.edu.ph',
        password: 'password123',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('TEST 7 — DepEd LRN login remains disabled (returns 401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: '109876543210',
        password: 'password123',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('TEST 8 — UUID login remains disabled (returns 401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        password: 'password123',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('TEST 9 — Temporary password user authenticates with mustChangePassword = true', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: tempSchoolId,
        password: tempPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.mustChangePassword).toBe(true);
  });

  it('TEST 10 — Rate limit isolation: Throttling User A does not block unrelated User B', async () => {
    // Throttle EMP-T-001
    for (let i = 1; i <= 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: 'EMP-T-001',
          password: 'WrongPassword!',
        });
    }

    // Verify EMP-T-001 is throttled
    const throttledUserA = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'EMP-T-001',
        password: 'password123',
      });
    expect(throttledUserA.status).toBe(429);

    // Unrelated user IT-001 on the same IP must still authenticate successfully
    const userBRes = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'IT-001',
        password: 'password123',
      });

    expect(userBRes.status).toBe(200);
    expect(userBRes.body.success).toBe(true);
    expect(userBRes.body.data.user.schoolId).toBe('IT-001');
  });

  it('TEST 11 — IP-level spraying protection throttles dictionary attacks across multiple accounts', async () => {
    // Configure small IP threshold for testing
    setAuthRateLimits({
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      maxIpAttempts: 3,
    });

    // 3 failed attempts against 3 distinct accounts
    await request(app).post('/api/auth/login').send({ schoolId: 'ATTACK-001', password: 'pwd' });
    await request(app).post('/api/auth/login').send({ schoolId: 'ATTACK-002', password: 'pwd' });
    await request(app).post('/api/auth/login').send({ schoolId: 'ATTACK-003', password: 'pwd' });

    // 4th attempt from same IP must be throttled even with a fresh School ID
    const res = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: 'ATTACK-004', password: 'pwd' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
