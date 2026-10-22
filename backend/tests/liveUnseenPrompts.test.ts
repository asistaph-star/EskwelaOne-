import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { config } from '../src/config/env.js';
import { aiConfig } from '../src/config/ai.config.js';

describe('DIGISKWELA — LIVE UNSEEN GENERALIZATION TESTS (PROMPTS A–G)', { timeout: 45000 }, () => {
  let token: string;
  let principalUserId: string;
  let originalMode: any;

  beforeAll(async () => {
    originalMode = aiConfig.providerMode;
    aiConfig.providerMode = 'cloudflare';

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
    expect(content).toMatch(/partial\s+terms|quarter|grading|incomplete/i);

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

  // Prompt G: Ambiguous follow-up without antecedent -> clarification
  it('Prompt G: Ambiguous follow-up without antecedent asks for clarification', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{
          role: 'user',
          content: 'Which of those should I check first?'
        }],
        portal: 'Principal'
      });

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.toolsExecuted).toHaveLength(0);
    expect(d.message.content).toMatch(/clarify/i);

    console.log('[PROMPT G METRICS] Clarification returned as expected');
  });
});
