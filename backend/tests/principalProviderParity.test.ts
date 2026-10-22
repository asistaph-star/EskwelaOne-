import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { aiConfig } from '../src/config/ai.config.js';
import { normalizeAssistantText } from '../src/ai/utils/normalizeResponseText.js';
import * as factory from '../src/ai/provider/aiProvider.factory.js';
import { DigiSkwelaAIProvider, AICompletionResponse } from '../src/ai/provider/aiProvider.interface.js';

describe('DIGISKWELA — PRINCIPAL AI PROVIDER PARITY SUITE', () => {
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
        email: `prin_parity_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'ParityTester',
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

  // ─── 1. Needs Attention Parity ──────────────────────────────────────────
  describe('1. Needs Attention Composite Intent ("What needs my review today?")', () => {
    it('TC-PARITY-01: Deterministically executes all 4 operational tools across 5 domains', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'What needs my review today?' }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      // All 5 domains covered by executing the 4 verified operational tools:
      // Domain 1: Pending leave requests
      // Domain 2: Faculty attendance exceptions (gate check-in vs approved leave)
      // Domain 3: Unresolved behavior cases
      // Domain 4: Academic grading completeness
      // Domain 5: Upcoming operational events
      expect(data.toolsExecuted).toContain('getFacultyAttendanceAudit');
      expect(data.toolsExecuted).toContain('getPendingLeaves');
      expect(data.toolsExecuted).toContain('getAdministrativeBehaviorSummary');
      expect(data.toolsExecuted).toContain('getSchoolOperationalFactSheet');

      // Structured data output
      expect(data.responseType).toBe('structured');
      expect(data.structuredData).toBeDefined();
      expect(data.structuredData.type).toBe('fact_sheet');

      // Provenance includes merged source domains
      expect(data.provenance).toBeDefined();
      expect(data.provenance.sourceDomains).toEqual(
        expect.arrayContaining(['Faculty Attendance', 'Leave Management', 'Executive Summary'])
      );

      // Natural, grounded narrative without raw route IDs or HTML entities
      expect(data.message.content).toMatch(/review|attention|leave|attendance/i);
      expect(data.message.content).not.toMatch(/p-monitoring|p-leaves|p-behavior/);
      expect(data.message.content).not.toMatch(/&#x[0-9a-fA-F]+;/);
    });

    it('TC-PARITY-02: Provider parity: Simulated Groq and Cloudflare produce equivalent operational scope', async () => {
      // Simulate Groq provider synthesis turn
      const groqProvider: DigiSkwelaAIProvider = {
        name: 'GroqAIProvider',
        mode: 'groq',
        generateResponse: vi.fn().mockImplementation(async (req) => {
          // Confirm that all 4 tool outputs were received in the messages
          const toolMessages = req.messages.filter((m: any) => m.role === 'tool');
          const toolNames = toolMessages.map((m: any) => m.name);
          expect(toolNames).toContain('getFacultyAttendanceAudit');
          expect(toolNames).toContain('getPendingLeaves');
          expect(toolNames).toContain('getAdministrativeBehaviorSummary');
          expect(toolNames).toContain('getSchoolOperationalFactSheet');

          return {
            message: {
              role: 'assistant',
              content: 'Groq Operational Review: 1 pending leave request requires action, faculty attendance records have been cross-checked, 1 behavior case is active, and academic analytics reflect partial-term records.',
            },
            finishReason: 'stop',
            usage: { promptTokens: 350, completionTokens: 45, totalTokens: 395 },
          };
        }),
      };

      // Simulate Cloudflare provider synthesis turn
      const cloudflareProvider: DigiSkwelaAIProvider = {
        name: 'CloudflareAIProvider',
        mode: 'cloudflare',
        generateResponse: vi.fn().mockImplementation(async (req) => {
          // Confirm that Cloudflare receives the EXACT SAME tool outputs
          const toolMessages = req.messages.filter((m: any) => m.role === 'tool');
          const toolNames = toolMessages.map((m: any) => m.name);
          expect(toolNames).toContain('getFacultyAttendanceAudit');
          expect(toolNames).toContain('getPendingLeaves');
          expect(toolNames).toContain('getAdministrativeBehaviorSummary');
          expect(toolNames).toContain('getSchoolOperationalFactSheet');

          return {
            message: {
              role: 'assistant',
              content: 'Cloudflare Operational Review: 1 pending leave request requires review, faculty gate attendance is audited against approved leaves, 1 behavior case is open, and academic analytics remain partial terms.',
            },
            finishReason: 'stop',
            usage: { promptTokens: 350, completionTokens: 45, totalTokens: 395 },
          };
        }),
      };

      // 1. Run with Groq
      vi.spyOn(factory, 'getAIProvider').mockReturnValue(groqProvider);
      const groqRes = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'What needs my review today?' }],
          portal: 'Principal',
        });

      // 2. Run with Cloudflare
      vi.spyOn(factory, 'getAIProvider').mockReturnValue(cloudflareProvider);
      const cfRes = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'What needs my review today?' }],
          portal: 'Principal',
        });

      vi.restoreAllMocks();

      // PARITY VERIFICATION
      // A. Tools executed must be identical
      expect(groqRes.body.data.toolsExecuted).toEqual(cfRes.body.data.toolsExecuted);
      expect(groqRes.body.data.toolsExecuted).toHaveLength(4);

      // B. Structured response type must be identical
      expect(groqRes.body.data.responseType).toBe('structured');
      expect(cfRes.body.data.responseType).toBe('structured');
      expect(groqRes.body.data.structuredData.type).toBe('fact_sheet');
      expect(cfRes.body.data.structuredData.type).toBe('fact_sheet');

      // C. Provenance must be identical
      expect(groqRes.body.data.provenance.sourceDomains).toEqual(cfRes.body.data.provenance.sourceDomains);

      // D. Both narratives reference all operational domains
      expect(groqRes.body.data.message.content).toMatch(/leave/i);
      expect(groqRes.body.data.message.content).toMatch(/attendance/i);
      expect(cfRes.body.data.message.content).toMatch(/leave/i);
      expect(cfRes.body.data.message.content).toMatch(/attendance/i);
    });
  });

  // ─── 2. Meeting Brief Parity ───────────────────────────────────────────
  describe('2. Meeting Brief Composite Intent ("Prepare me for my next faculty meeting.")', () => {
    it('TC-PARITY-03: Deterministically dispatches generatePrincipalMeetingBrief', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'Prepare me for my next faculty meeting.' }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.toolsExecuted).toContain('generatePrincipalMeetingBrief');
      expect(data.responseType).toBe('structured');
      expect(data.structuredData.type).toBe('meeting_brief');
      expect(data.message.content).toMatch(/meeting brief/i);
    });
  });

  // ─── 3. Weekly Brief Parity ────────────────────────────────────────────
  describe("3. Weekly Brief Composite Intent (\"Summarize this week's school operations.\")", () => {
    it('TC-PARITY-04: Deterministically dispatches generateWeeklyOperationsReport', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: "Summarize this week's school operations." }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.toolsExecuted).toContain('generateWeeklyOperationsReport');
      expect(data.responseType).toBe('structured');
      expect(data.structuredData.type).toBe('weekly_report');
      expect(data.message.content).toMatch(/weekly operations/i);
    });
  });

  // ─── 4. Attendance Cross-check Parity ──────────────────────────────────
  describe('4. Attendance Cross-check ("Check faculty gate records against approved leaves.")', () => {
    it('TC-PARITY-05: Deterministically dispatches getFacultyAttendanceAudit with neutral semantics', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'Check faculty gate records against approved leaves.' }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.toolsExecuted).toContain('getFacultyAttendanceAudit');
      expect(data.responseType).toBe('structured');
      expect(data.structuredData.type).toBe('attendance');

      // Neutral semantics: Zero unsupported tardiness / truancy / AWOL claims
      expect(data.message.content).not.toMatch(/\b(AWOL|Late|Tardy|Undertime|Absent|Unexcused)\b/i);
    });
  });

  // ─── 5. Simple Factual Queries Remain Narrow ───────────────────────────
  describe('5. Simple Factual Queries Remain Narrow (Non-Composite)', () => {
    it('TC-PARITY-06: "How many pending leaves are there?" executes only getPendingLeaves', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'How many pending leaves are there?' }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      // Single tool only: Must NOT execute fact sheet or behavior tools
      expect(data.toolsExecuted).toHaveLength(1);
      expect(data.toolsExecuted).toEqual(['getPendingLeaves']);
      expect(data.toolsExecuted).not.toContain('getSchoolOperationalFactSheet');
      expect(data.toolsExecuted).not.toContain('getFacultyAttendanceAudit');
    });

    it('TC-PARITY-07: "Where do I review faculty attendance?" executes zero tools (navigation only)', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'Where do I review faculty attendance?' }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      // Zero tools executed
      expect(data.toolsExecuted).toHaveLength(0);
      expect(data.responseType).toBe('text');
      expect(data.navigationActions).toBeDefined();
      expect(data.navigationActions?.[0].screen).toBe('p-monitoring');
      expect(data.navigationActions?.[0].label).toBe('Open Gate Attendance Monitoring');
    });
  });

  // ─── 6. Response Quality & Awkward Empty Commentary Removal ─────────────
  describe('6. Response Quality: Empty-Collection Commentary Removal', () => {
    it('TC-PARITY-08: Strips "No other faculty have completed check-ins or are on approved leave."', () => {
      const awkwardRaw = '1 faculty member has completed check-in. No other faculty have completed check-ins or are on approved leave. Overall attendance is tracked.';
      const normalized = normalizeAssistantText(awkwardRaw);

      expect(normalized).not.toContain('No other faculty have completed check-ins or are on approved leave');
      expect(normalized).toContain('1 faculty member has completed check-in');
      expect(normalized).toContain('Overall attendance is tracked');
    });

    it('TC-PARITY-09: Strips "All other faculty (none) have completed check-ins."', () => {
      const awkwardRaw = '1 faculty member is on approved leave. All other faculty (none) have completed check-ins.';
      const normalized = normalizeAssistantText(awkwardRaw);

      expect(normalized).not.toContain('All other faculty');
      expect(normalized).not.toContain('(none)');
    });
  });
});
