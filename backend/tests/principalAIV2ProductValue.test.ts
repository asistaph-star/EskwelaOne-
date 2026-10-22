import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { aiConfig } from '../src/config/ai.config.js';
import { PRINCIPAL_QUICK_PROMPTS } from '../../src/app/principal/ai/constants/quickPrompts.js';

describe('DIGISKWELA — PRINCIPAL AI V2 PRODUCT VALUE REFINEMENT SUITE', () => {
  let principalToken: string;
  let principalUserId: string;
  let originalProviderMode: any;

  beforeAll(async () => {
    originalProviderMode = aiConfig.providerMode;
    aiConfig.providerMode = 'mock';

    principalUserId = generateId();
    await prisma.user.create({
      data: {
        id: principalUserId,
        email: `prin_v2_val_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'Evaluator',
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

    principalToken = sign({ userId: principalUserId }, config.jwt.secret, { expiresIn: '8h' });
  });

  afterAll(async () => {
    aiConfig.providerMode = originalProviderMode;
    await prisma.aIAuditLog.deleteMany({ where: { user_id: principalUserId } });
    await prisma.userRole.deleteMany({ where: { user_id: principalUserId } });
    await prisma.user.deleteMany({ where: { id: principalUserId } });
  });

  // ─── 1. Task-Oriented Suggested Prompts Invariant ──────────────────────
  it('TC-V2-01: Suggested prompts are task-oriented, high-value, and contain zero emojis', () => {
    expect(PRINCIPAL_QUICK_PROMPTS).toHaveLength(8);

    const labels = PRINCIPAL_QUICK_PROMPTS.map(p => p.label);
    const prompts = PRINCIPAL_QUICK_PROMPTS.map(p => p.prompt);

    // Old generic module names replaced with task concepts
    expect(labels).not.toContain('Faculty Attendance');
    expect(labels).not.toContain('Pending Leaves');
    expect(labels).not.toContain('Behavior Cases');
    expect(labels).not.toContain('Academic Analytics');

    expect(labels).toContain('Needs Attention');
    expect(labels).toContain('Cross-check Attendance');
    expect(labels).toContain('Prepare Meeting');
    expect(labels).toContain('Explain Academics');
    expect(labels).toContain('Find Exceptions');
    expect(labels).toContain('Weekly Brief');
    expect(labels).toContain('System Help');
    expect(labels).toContain('Draft Communication');

    // Zero emojis in labels and prompts
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    PRINCIPAL_QUICK_PROMPTS.forEach(qp => {
      expect(qp.label).not.toMatch(emojiRegex);
      expect(qp.prompt).not.toMatch(emojiRegex);
      expect(qp.prompt.length).toBeGreaterThan(15);
    });
  });

  // ─── 2. Scenario 1: Needs Attention / Review ───────────────────────────
  it('TC-V2-02: "What needs my review today?" synthesizes cross-module operational exceptions', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'What needs my review today?' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.toolsExecuted).toContain('getSchoolOperationalFactSheet');
    expect(res.body.data.message.content).toMatch(/review|attention|pending/i);
    expect(res.body.data.structuredData).toBeDefined();
  });

  // ─── 3. Scenario 2: Cross-check Gate Attendance vs Approved Leaves ──────
  it('TC-V2-03: "Check faculty gate records against approved leaves" cross-checks multiple domains', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Check faculty gate records against approved leaves.' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.toolsExecuted).toContain('getFacultyAttendanceAudit');
    expect(res.body.data.message.content).toMatch(/cross-checked|leave|attendance/i);
    // Neutral semantics preserved
    expect(res.body.data.message.content).not.toMatch(/\b(AWOL|Late|Tardy|Undertime|Absent)\b/i);
  });

  // ─── 4. Scenario 3: Explain-Why Capability ─────────────────────────────
  it('TC-V2-04: "Why is annual academic analytics incomplete?" explains verified policy rules', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Why is annual academic analytics incomplete?' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.toolsExecuted).toContain('getAcademicAnalytics');
    expect(res.body.data.message.content).toMatch(/four (quarters|terms)|partial|finalized/i);
  });

  // ─── 5. Scenario 4: Meeting Brief Synthesis ────────────────────────────
  it('TC-V2-05: "Prepare me for my next faculty meeting." compiles cross-module briefing', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Prepare me for my next faculty meeting.' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.toolsExecuted).toContain('generatePrincipalMeetingBrief');
    expect(res.body.data.structuredData?.type).toBe('meeting_brief');
  });

  // ─── 6. Scenario 5: Find Exceptions ────────────────────────────────────
  it('TC-V2-06: "Show unresolved or incomplete operational items requiring review." surfaces exceptions', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Show unresolved or incomplete operational items requiring review.' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.toolsExecuted).toContain('getSchoolOperationalFactSheet');
    expect(res.body.data.message.content).toMatch(/unresolved|exceptions|pending/i);
  });

  // ─── 7. Scenario 6: Weekly Operations Brief ────────────────────────────
  it('TC-V2-07: "Summarize this week\'s school operations." produces executive brief', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: "Summarize this week's school operations." }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.toolsExecuted).toContain('generateWeeklyOperationsReport');
    expect(res.body.data.structuredData?.type).toBe('weekly_report');
  });

  // ─── 8. Scenario 7: Contextual Navigation & System Help ────────────────
  it('TC-V2-08: "Where do I review faculty attendance?" returns navigation guidance and verified route action', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Where do I review faculty attendance?' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message.content).toMatch(/Gate Attendance Monitoring|Teacher Management/i);
    expect(res.body.data.navigationActions).toBeDefined();
    expect(res.body.data.navigationActions[0].screen).toBe('p-monitoring');
  });

  // ─── 9. Scenario 8: Prepare Work / Draft Communication ─────────────────
  it('TC-V2-09: "Help me draft a reminder for faculty to complete pending term grades." prepares read-only memo', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'Help me draft a reminder for faculty to complete pending term grades.' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message.content).toMatch(/Subject: Reminder/i);
    expect(res.body.data.message.content).toMatch(/Gradebook/i);
    expect(res.body.data.message.content).toMatch(/Read-only AI assistance/i);
  });

  // ─── 10. Simple Questions Stay Simple ──────────────────────────────────
  it('TC-V2-10: "How many pending leaves are there?" responds concisely without massive reports', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: 'How many pending leaves are there?' }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message.content).toMatch(/1 faculty leave/i);
    expect(res.body.data.message.content.length).toBeLessThan(150);
  });
});
