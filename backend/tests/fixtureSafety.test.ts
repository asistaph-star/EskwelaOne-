import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import prisma from '../src/config/database.js';
import authRoutes from '../src/auth/auth.routes.js';
import { authMiddleware } from '../src/common/middleware/auth.js';
import { errorHandler } from '../src/common/middleware/errorHandler.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';

describe('DIGISKWELA — TEACHER DEMO FIXTURE SECURITY & ISOLATION INVARIANTS', () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.get('/api/protected-test', authMiddleware, (req, res) => {
    res.json({ success: true, user: (req as any).user });
  });
  app.use(errorHandler);

  it('TC-FIX-01: Canonical active login-capable demo account count is strictly 9', async () => {
    const activeDemoUsers = await prisma.user.findMany({
      where: {
        status: 'active',
        email: { endsWith: '@demo.com' }
      },
      select: { email: true }
    });

    const expectedEmails = [
      'principal@demo.com',
      'itadmin@demo.com',
      'student@demo.com',
      'teacher@demo.com',
      'nurse@demo.com',
      'guidance@demo.com',
      'admin@demo.com',
      'registrar@demo.com',
      'gate@demo.com'
    ];

    expect(activeDemoUsers.length).toBe(9);
    for (const email of expectedEmails) {
      expect(activeDemoUsers.map(u => u.email)).toContain(email);
    }
  });

  it('TC-FIX-02: All synthetic fixture accounts are strictly status inactive with @fixture.invalid domains', async () => {
    const fixtureUsers = await prisma.user.findMany({
      where: {
        id: { startsWith: 'fix-' }
      }
    });

    // If fixture is seeded, verify all 24 are strictly inactive
    if (fixtureUsers.length > 0) {
      expect(fixtureUsers.length).toBe(24);
      for (const user of fixtureUsers) {
        expect(user.status).toBe('inactive');
        expect(user.email.endsWith('@fixture.invalid')).toBe(true);
      }
    }
  });

  it('TC-FIX-03: Inactive fixture account is strictly rejected with 401 ACCOUNT_INACTIVE on login attempt', async () => {
    const fixtureUsers = await prisma.user.findMany({
      where: { id: { startsWith: 'fix-' } }
    });

    if (fixtureUsers.length > 0) {
      const targetUser = fixtureUsers[0];
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          schoolId: targetUser.school_id,
          password: 'AttemptLoginPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('TC-FIX-04: Even if a valid JWT is forged with an inactive fixture user id, authMiddleware strictly rejects with 401', async () => {
    const fixtureUsers = await prisma.user.findMany({
      where: { id: { startsWith: 'fix-' } }
    });

    if (fixtureUsers.length > 0) {
      const targetUser = fixtureUsers[0];
      const forgedToken = jwt.sign({ userId: targetUser.id }, config.jwt.secret, { expiresIn: '1h' });

      const res = await request(app)
        .get('/api/protected-test')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    }
  });
});
