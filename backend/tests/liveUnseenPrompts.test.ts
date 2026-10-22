import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { config } from '../src/config/env.js';
import { aiConfig } from '../src/config/ai.config.js';
import { aiConversationSessionService } from '../src/ai/session/aiConversationSession.service.js';

describe('DIGISKWELA — LIVE UNSEEN GENERALIZATION TESTS (PROMPTS A–G)', { timeout: 75000 }, () => {
  let token: string;
  let principalUserId: string;
  let originalMode: any;
  let originalTimeout: number;

  beforeAll(async () => {
    originalMode = aiConfig.providerMode;
    originalTimeout = aiConfig.cloudflare.timeoutMs;
    aiConfig.providerMode = 'cloudflare';
    aiConfig.cloudflare.timeoutMs = 35000;

    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId,
        email: `live_prin_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'LiveTest',
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

    token = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '8h' });
  });

  afterAll(async () => {
    aiConfig.providerMode = originalMode;
    aiConfig.cloudflare.timeoutMs = originalTimeout;
    aiConversationSessionService._resetAll();
    await prisma.aIAuditLog.deleteMany({ where: { user_id: principalUserId } });
    await prisma.userRole.deleteMany({ where: { user_id: principalUserId } });
    await prisma.user.deleteMany({ where: { id: principalUserId } });
  });

  async function getAuditOrch(traceId: string) {
    const entry = await prisma.aIAuditLog.findFirst({
      where: { trace_id: traceId }
    });
    return (entry?.token_usage as any)?.orchestration;
  }

  // Prompt A: Broad multi-domain + correlation + prioritization
  it('Prompt A: Broad multi-domain + correlation + prioritization', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{
          role: 'user',
          content: 'Check attendance, pending leaves, and active behavior cases, tell me if any are related, and give me a suggested order for what I should review.'
        }],
        portal: 'Principal'
      });

    expect(res.status).toBe(200);
    const d = res.body.data;
    const content = d.message.content;
    const tools = d.toolsExecuted;

    expect(tools).toContain('getFacultyAttendanceAudit');
    expect(tools).toContain('getPendingLeaves');
    expect(tools).toContain('getAdministrativeBehaviorSummary');
    expect(content).toContain('(Suggested review order based on operational urgency; not DepEd policy)');

    const orch = await getAuditOrch(d.traceId);
    expect(orch).toBeDefined();
    expect(orch.completionState).toBe('COMPLETE');
    expect(orch.unmetCount).toBe(0);

    console.log('[PROMPT A AUDIT METRICS]', JSON.stringify(orch));
  });

  // Prompt B: Two questions: unresolved faculty + explained by approved leaves
  it('Prompt B: Two questions: unresolved faculty + explained by approved leaves', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{
          role: 'user',
          content: 'How many faculty members have unresolved attendance today, and can any of those be explained by approved leaves?'
        }],
        portal: 'Principal'
      });

    expect(res.status).toBe(200);
    const d = res.body.data;
    const content = d.message.content;
    const tools = d.toolsExecuted;

    expect(tools).toContain('getFacultyAttendanceAudit');
    expect(tools).toContain('getPendingLeaves');
    expect(content.length).toBeGreaterThan(30);

    const orch = await getAuditOrch(d.traceId);
    expect(orch).toBeDefined();
    expect(orch.completionState).toBe('COMPLETE');

    console.log('[PROMPT B AUDIT METRICS]', JSON.stringify(orch));
  });

  // Prompt C: Academic reporting status + explain completeness
  it('Prompt C: Academic reporting status + explain completeness', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{
          role: 'user',
          content: 'What is the current academic reporting status, and why is the annual view incomplete?'
        }],
        portal: 'Principal'
      });

    expect(res.status).toBe(200);
    const d = res.body.data;
    const content = d.message.content;
    const tools = d.toolsExecuted;

    expect(tools).toContain('getAcademicAnalytics');
    expect(content).toMatch(/partial[-‑\s]*terms?|grades?|incomplete/i);

    const orch = await getAuditOrch(d.traceId);
    expect(orch).toBeDefined();
    expect(orch.completionState).toBe('COMPLETE');

    console.log('[PROMPT C AUDIT METRICS]', JSON.stringify(orch));
  });

  // Prompt D: Navigation + unresolved behavioral cases data
  it('Prompt D: Navigation + unresolved behavioral cases data', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{
          role: 'user',
          content: 'Where do I review behavioral reports, and are there any unresolved cases right now?'
        }],
        portal: 'Principal'
      });

    expect(res.status).toBe(200);
    const d = res.body.data;
    const content = d.message.content;
    const tools = d.toolsExecuted;

    expect(tools).toContain('getAdministrativeBehaviorSummary');
    expect(d.navigationActions).toBeDefined();
    expect(d.navigationActions.length).toBeGreaterThan(0);
    expect(d.navigationActions[0].screen).toBe('p-behavior');

    const orch = await getAuditOrch(d.traceId);
    expect(orch).toBeDefined();
    expect(orch.completionState).toBe('COMPLETE');

    console.log('[PROMPT D AUDIT METRICS]', JSON.stringify(orch));
  });

  // Prompt E: Incomplete academic reporting + draft memo
  it('Prompt E: Incomplete academic reporting + draft memo', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{
          role: 'user',
          content: 'Review incomplete academic reporting and draft a short reminder for faculty.'
        }],
        portal: 'Principal'
      });

    expect(res.status).toBe(200);
    const d = res.body.data;
    const content = d.message.content;
    const tools = d.toolsExecuted;

    expect(tools).toContain('getAcademicAnalytics');
    expect(content).toContain('(Draft for Principal review · Read-only AI assistance)');

    const orch = await getAuditOrch(d.traceId);
    expect(orch).toBeDefined();
    expect(orch.completionState).toBe('COMPLETE');

    console.log('[PROMPT E AUDIT METRICS]', JSON.stringify(orch));
  });

  // Prompt F: Narrow pending leaves count
  it('Prompt F: Narrow pending leaves count', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{
          role: 'user',
          content: 'How many leave requests are currently pending review?'
        }],
        portal: 'Principal'
      });

    expect(res.status).toBe(200);
    const d = res.body.data;
    const content = d.message.content;
    const tools = d.toolsExecuted;

    expect(tools).toEqual(['getPendingLeaves']);
    expect(content).toMatch(/\b\d+\b/);

    const orch = await getAuditOrch(d.traceId);
    expect(orch).toBeDefined();
    expect(orch.completionState).toBe('COMPLETE');

    console.log('[PROMPT F AUDIT METRICS]', JSON.stringify(orch));
  });

  // Prompt G: True multi-turn follow-up with antecedent resolution and scope fidelity
  it('Prompt G: True multi-turn follow-up with antecedent resolution and scope fidelity', async () => {
    // Reset session before Prompt G to ensure clean isolation
    await request(app)
      .delete('/api/ai/session?portal=Principal')
      .set('Authorization', `Bearer ${token}`);

    // Turn 1: Initial query
    const res1 = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{
          role: 'user',
          content: 'What faculty attendance matters are pending today?'
        }],
        portal: 'Principal'
      });

    expect(res1.status).toBe(200);
    expect(res1.body.data.sessionId).toBeDefined();
    expect(res1.body.data.toolsExecuted).toContain('getFacultyAttendanceAudit');
    const sessionId = res1.body.data.sessionId;

    // Verify server session holds Turn 1
    const sessionRes1 = await request(app)
      .get('/api/ai/session?portal=Principal')
      .set('Authorization', `Bearer ${token}`);
    expect(sessionRes1.status).toBe(200);
    expect(sessionRes1.body.data.session).not.toBeNull();
    expect(sessionRes1.body.data.session.id).toBe(sessionId);
    expect(sessionRes1.body.data.session.messages.length).toBe(2);

    // Turn 2: Follow-up query resolving referent 'those'
    const turn1User = { role: 'user', content: 'What faculty attendance matters are pending today?' };
    const turn1Assistant = { role: 'assistant', content: res1.body.data.message.content };
    const turn2User = { role: 'user', content: 'Which of those should I check first?' };

    const res2 = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [turn1User, turn1Assistant, turn2User],
        portal: 'Principal'
      });

    expect(res2.status).toBe(200);
    const d2 = res2.body.data;
    const content2 = d2.message.content;
    const tools2 = d2.toolsExecuted;

    // Verification invariants:
    // 1. Current facts re-grounded through tool
    expect(tools2).toContain('getFacultyAttendanceAudit');
    // 2. Scope fidelity: Unrelated domains (Behavior, Leaves, Events) are NOT added
    expect(tools2).not.toContain('getPendingLeaves');
    expect(tools2).not.toContain('getAdministrativeBehaviorSummary');
    expect(tools2).not.toContain('getSchoolEventsNotice');
    expect(tools2.length).toBe(1);

    // 3. Read-only review prioritization disclaimer included
    expect(content2).toContain('(Suggested review order based on operational urgency; not DepEd policy)');

    // 4. Verify server session holds all 4 messages (persisted multi-turn interaction)
    const sessionRes2 = await request(app)
      .get('/api/ai/session?portal=Principal')
      .set('Authorization', `Bearer ${token}`);
    expect(sessionRes2.body.data.session.messages.length).toBe(4);

    // 5. Authoritative audit log verification
    const orch2 = await getAuditOrch(d2.traceId);
    expect(orch2).toBeDefined();
    expect(orch2.completionState).toBe('COMPLETE');
    expect(orch2.unmetCount).toBe(0);

    console.log('[PROMPT G TRUE MULTI-TURN AUDIT METRICS]', JSON.stringify(orch2));
  });
});
