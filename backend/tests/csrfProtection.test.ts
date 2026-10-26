import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { hashPassword } from '../src/auth/auth.service.js';
import { resetAuthRateLimiter } from '../src/auth/auth.limiter.js';

describe('SEC-INFO-001 — CSRF & Cookie Security Architecture Suite', () => {
  let itAdminCookie: string;
  let studentCookie: string;
  const createdUserIds: string[] = [];

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

    // 2. Authenticate as Student
    const stuLogin = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: '2026-00001',
        password: 'password123',
      });

    expect(stuLogin.status).toBe(200);
    const stuSetCookie = stuLogin.headers['set-cookie'] as string[];
    studentCookie = stuSetCookie.find(c => c.startsWith('auth_token='))!;
  });

  afterAll(async () => {
    resetAuthRateLimiter();
    if (createdUserIds.length > 0) {
      await prisma.student.deleteMany({ where: { user_id: { in: createdUserIds } } }).catch(() => {});
      await prisma.teacher.deleteMany({ where: { user_id: { in: createdUserIds } } }).catch(() => {});
      await prisma.staff.deleteMany({ where: { user_id: { in: createdUserIds } } }).catch(() => {});
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

  it('TEST 1 — Allowed same-site authenticated mutation succeeds', async () => {
    const newSchoolId = `CSRF-TST-${Date.now()}`.slice(0, 20);

    const res = await request(app)
      .post('/api/users')
      .set('Cookie', itAdminCookie)
      .send({
        schoolId: newSchoolId,
        email: `csrf_test_${Date.now()}@example.com`,
        firstName: 'CSRF',
        lastName: 'TestUser',
        roles: ['Teacher'],
        teacherProfile: {
          employeeId: newSchoolId,
          specialization: 'Science',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    if (res.body.data?.user?.id) {
      createdUserIds.push(res.body.data.user.id);
    }
  });

  it('TEST 2 — Unauthorized cross-site mutations are blocked', async () => {
    // A. Cross-site request where browser withholds SameSite=Lax cookie -> 401 UNAUTHORIZED
    const noCookieRes = await request(app)
      .post('/api/users')
      .send({
        schoolId: 'FORGED-001',
        email: 'forged@evil.com',
        firstName: 'Forged',
        lastName: 'User',
        roleName: 'Teacher',
      });

    expect(noCookieRes.status).toBe(401);
    expect(noCookieRes.body.error.code).toBe('UNAUTHORIZED');

    // B. Untrusted Origin header verification -> CORS does not authorize evil origin
    const evilOriginRes = await request(app)
      .post('/api/users')
      .set('Origin', 'http://malicious-attacker.com')
      .set('Cookie', itAdminCookie)
      .send({
        schoolId: 'FORGED-002',
        email: 'forged2@evil.com',
      });

    // Access-Control-Allow-Origin must NEVER be http://malicious-attacker.com
    expect(evilOriginRes.headers['access-control-allow-origin']).toBeUndefined();

    // C. Traditional HTML form POST (application/x-www-form-urlencoded) is not parsed as JSON -> rejected
    const formUrlEncodedRes = await request(app)
      .post('/api/auth/change-password')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('Cookie', itAdminCookie)
      .send('currentPassword=password123&newPassword=Hacked123!&confirmPassword=Hacked123!');

    // Since express.urlencoded is not mounted, body is unparsed, Zod rejects it with 422
    expect([400, 422]).toContain(formUrlEncodedRes.status);
    expect(formUrlEncodedRes.body.success).toBe(false);
  });

  it('TEST 3 — Normal login sets secure HttpOnly and SameSite=Lax cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        schoolId: 'IT-001',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    const cookieHeader = res.headers['set-cookie'] as string[];
    expect(cookieHeader).toBeDefined();

    const authCookie = cookieHeader.find(c => c.startsWith('auth_token='));
    expect(authCookie).toBeDefined();
    expect(authCookie).toContain('HttpOnly');
    expect(authCookie?.toLowerCase()).toContain('samesite=lax');
  });

  it('TEST 4 — Mandatory password-change flow functions securely', async () => {
    // Create a temporary user with must_change_password = true
    const tempSchoolId = `TEMP-CSRF-${Date.now()}`.slice(0, 20);
    const tempPassword = 'TempPassword123!';
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
        email: `temp_csrf_${Date.now()}@example.com`,
        password_hash: hashed,
        first_name: 'Temp',
        last_name: 'CSRF',
        status: 'active',
        must_change_password: true,
        user_roles: { create: { role_id: teacherRole.id } },
      },
    });

    // Login as temporary user
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ schoolId: tempSchoolId, password: tempPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.mustChangePassword).toBe(true);

    const tempCookie = (loginRes.headers['set-cookie'] as string[]).find(c => c.startsWith('auth_token='))!;

    // Perform password change with valid current password
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', tempCookie)
      .send({
        currentPassword: tempPassword,
        newPassword: 'NewPermanentPassword123!',
        confirmPassword: 'NewPermanentPassword123!',
      });

    expect(changeRes.status).toBe(200);
    expect(changeRes.body.success).toBe(true);
  });

  it('TEST 5 — Logout properly clears auth_token cookie with matching SameSite=Lax policy', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', itAdminCookie);

    expect(res.status).toBe(200);
    const cookieHeader = res.headers['set-cookie'] as string[];
    expect(cookieHeader).toBeDefined();

    const clearedCookie = cookieHeader.find(c => c.startsWith('auth_token='));
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie).toContain('HttpOnly');
    expect(clearedCookie?.toLowerCase()).toContain('samesite=lax');
  });

  it('TEST 6 — Gate SSE endpoint is read-only and requires authorization', async () => {
    // Unauthenticated request is rejected
    const unauthRes = await request(app).get('/api/attendance/gate/events');
    expect(unauthRes.status).toBe(401);

    // Student without attendance:read permission is rejected with 403
    const forbiddenRes = await request(app)
      .get('/api/attendance/gate/events')
      .set('Cookie', studentCookie);
    expect(forbiddenRes.status).toBe(403);
  });

  it('TEST 7 — RBAC remains strictly authoritative against cookie-carrying requests', async () => {
    // Student carries a valid auth_token cookie, but attempts an admin-only mutation
    const res = await request(app)
      .post('/api/users')
      .set('Cookie', studentCookie)
      .send({
        email: 'unauth@test.com',
        firstName: 'Unauth',
        lastName: 'User',
        roles: ['Teacher'],
        teacherProfile: {
          employeeId: 'EMP-UNAUTH-001',
          specialization: 'Science',
        },
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('TEST 8 — Authenticated GET endpoints are idempotent and perform zero state mutations', async () => {
    const countBefore = await prisma.user.count();

    const getRes = await request(app)
      .get('/api/users')
      .set('Cookie', itAdminCookie);

    expect(getRes.status).toBe(200);

    const countAfter = await prisma.user.count();
    expect(countAfter).toBe(countBefore);
  });
});
