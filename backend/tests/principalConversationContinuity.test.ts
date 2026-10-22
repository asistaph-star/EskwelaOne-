import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { aiConfig } from '../src/config/ai.config.js';
import { aiConversationSessionService } from '../src/ai/session/aiConversationSession.service.js';

describe('DIGISKWELA — PRINCIPAL AI CONVERSATION CONTINUITY & SECURITY SUITE', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let originalProviderMode: any;

  beforeAll(async () => {
    originalProviderMode = aiConfig.providerMode;
    aiConfig.providerMode = 'mock';

    // Seed Principal User A
    userAId = generateId();
    await prisma.user.create({
      data: {
        id: userAId,
        email: `prin_a_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'Alpha',
        status: 'active',
      },
    });

    const principalRole = await prisma.role.findFirst({ where: { name: 'Principal' } });
    if (principalRole) {
      await prisma.userRole.create({
        data: {
          user_id: userAId,
          role_id: principalRole.id,
        },
      });
    }

    userAToken = sign({ userId: userAId }, config.jwt.secret, { expiresIn: '8h' });

    // Seed User B (Different User)
    userBId = generateId();
    await prisma.user.create({
      data: {
        id: userBId,
        email: `prin_b_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'Beta',
        status: 'active',
      },
    });

    if (principalRole) {
      await prisma.userRole.create({
        data: {
          user_id: userBId,
          role_id: principalRole.id,
        },
      });
    }

    userBToken = sign({ userId: userBId }, config.jwt.secret, { expiresIn: '8h' });
  });

  afterAll(async () => {
    aiConfig.providerMode = originalProviderMode;
    aiConversationSessionService._resetAll();

    await prisma.auditLog.deleteMany({ where: { actor_user_id: { in: [userAId, userBId] } } });
    await prisma.aIAuditLog.deleteMany({ where: { user_id: { in: [userAId, userBId] } } });
    await prisma.userRole.deleteMany({ where: { user_id: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  });

  beforeEach(() => {
    aiConversationSessionService._resetAll();
  });

  // ─── 1. Session Creation & Message Appending ─────────────────────────────
  it('TC-CC-01: Chat request automatically creates and appends to server-side ephemeral session', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        messages: [{ role: 'user', content: "Review today's faculty attendance." }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionId).toBeDefined();

    // Verify server session exists
    const session = aiConversationSessionService.getSession(userAId, 'Principal');
    expect(session).not.toBeNull();
    expect(session?.id).toBe(res.body.data.sessionId);
    expect(session?.userId).toBe(userAId);
    expect(session?.portal).toBe('Principal');
    expect(session?.messages.length).toBe(2); // user + assistant turn
    expect(session?.messages[0].role).toBe('user');
    expect(session?.messages[0].content).toBe("Review today's faculty attendance.");
    expect(session?.messages[1].role).toBe('assistant');
  });

  // ─── 2. Refresh Restoration ─────────────────────────────────────────────
  it('TC-CC-02: GET /api/ai/session restores active conversation across refresh for authenticated user', async () => {
    // Populate session turn
    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        messages: [{ role: 'user', content: 'Weekly Operations Brief' }],
        portal: 'Principal',
      });

    // Simulate browser refresh: GET session
    const res = await request(app)
      .get('/api/ai/session?portal=Principal')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session).not.toBeNull();
    expect(res.body.data.session.messages.length).toBe(2);
    expect(res.body.data.session.messages[0].content).toBe('Weekly Operations Brief');
  });

  // ─── 3. Strict User Isolation ────────────────────────────────────────────
  it('TC-CC-03: User A conversation is completely inaccessible to User B', async () => {
    // User A conducts conversation
    const chatRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        messages: [{ role: 'user', content: 'Confidential staff evaluation overview' }],
        portal: 'Principal',
      });

    const userASessionId = chatRes.body.data.sessionId;

    // User B calls GET /api/ai/session
    const userBRes = await request(app)
      .get('/api/ai/session?portal=Principal')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(userBRes.status).toBe(200);
    // User B has NO session
    expect(userBRes.body.data.session).toBeNull();
  });

  // ─── 4. Forged Conversation ID Protection ────────────────────────────────
  it('TC-CC-04: User B supplying User A conversationId is rejected with 403 Forbidden', async () => {
    // User A creates conversation
    const chatRes = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        messages: [{ role: 'user', content: 'Private administrative inquiries' }],
        portal: 'Principal',
      });

    const userASessionId = chatRes.body.data.sessionId;

    // User B attempts to access User A's session using User A's session ID
    const forgedRes = await request(app)
      .get(`/api/ai/session?portal=Principal&conversationId=${userASessionId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(forgedRes.status).toBe(403);
    expect(forgedRes.body.error.code).toBe('FORBIDDEN');
  });

  // ─── 5. Ephemeral Expiry & Inactivity TTL ────────────────────────────────
  it('TC-CC-05: Expired conversation session is purged and cannot be restored', () => {
    // Seed an expired session
    const oldTime = Date.now() - 40 * 60 * 1000; // 40 minutes ago (> 30 min TTL)
    aiConversationSessionService.appendTurn(
      userAId,
      'Principal',
      'Principal',
      { id: '1', role: 'user', content: 'Old question', timestamp: new Date(oldTime).toISOString() },
      { id: '2', role: 'assistant', content: 'Old answer', timestamp: new Date(oldTime).toISOString() }
    );

    // Force timestamps to past
    const session = aiConversationSessionService.getSession(userAId, 'Principal');
    if (session) {
      session.updatedAt = oldTime;
      session.expiresAt = oldTime;
    }

    // Now attempt to get session
    const expiredCheck = aiConversationSessionService.getSession(userAId, 'Principal');
    expect(expiredCheck).toBeNull();
  });

  // ─── 6. Clear Session Button ─────────────────────────────────────────────
  it('TC-CC-06: DELETE /api/ai/session clears server session; refresh does not restore it', async () => {
    // Create session
    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        messages: [{ role: 'user', content: 'Clear me' }],
        portal: 'Principal',
      });

    // Clear session
    const deleteRes = await request(app)
      .delete('/api/ai/session?portal=Principal')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verify GET returns null
    const getRes = await request(app)
      .get('/api/ai/session?portal=Principal')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(getRes.body.data.session).toBeNull();
  });

  // ─── 7. Logout Invalidation ──────────────────────────────────────────────
  it('TC-CC-07: POST /api/auth/logout invalidates active AI session', async () => {
    // Create session for User A
    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        messages: [{ role: 'user', content: 'Session active before logout' }],
        portal: 'Principal',
      });

    expect(aiConversationSessionService.getSession(userAId, 'Principal')).not.toBeNull();

    // Call logout endpoint
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(logoutRes.status).toBe(200);

    // Session is now invalidated
    expect(aiConversationSessionService.getSession(userAId, 'Principal')).toBeNull();
  });

  // ─── 8. Data Minimization & Privacy ──────────────────────────────────────
  it('TC-CC-08: Stored session contains only sanitized display context; zero credentials or raw entities', async () => {
    await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        messages: [{ role: 'user', content: "Review today's faculty attendance." }],
        portal: 'Principal',
      });

    const session = aiConversationSessionService.getSession(userAId, 'Principal');
    expect(session).not.toBeNull();

    const sessionJson = JSON.stringify(session);

    // Zero credentials or secrets stored
    expect(sessionJson).not.toContain(config.jwt.secret);
    expect(sessionJson).not.toContain('password_hash');
    expect(sessionJson).not.toContain('Bearer');
    expect(sessionJson).not.toContain('gsk_'); // Groq API key
  });

  // ─── 9. Authentication Security Invariant ─────────────────────────────────
  it('TC-CC-09: Unauthenticated requests to /api/ai/session are rejected with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/ai/session?portal=Principal');
    expect(res.status).toBe(401);
  });
});
