import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { aiConfig } from '../src/config/ai.config.js';
import * as factory from '../src/ai/provider/aiProvider.factory.js';
import { DigiSkwelaAIProvider } from '../src/ai/provider/aiProvider.interface.js';
import { validateAndRemedyCompleteness } from '../src/ai/orchestration/completenessValidator.js';
import { DOMAIN_CATALOG } from '../src/ai/orchestration/domainCatalog.js';

describe('DIGISKWELA — PRINCIPAL GENERAL-PURPOSE INTELLIGENT AI ORCHESTRATION EVALUATION', () => {
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
        email: `prin_gen_orch_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'Orchestrator',
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

  // ─── 1. Paraphrase Equivalence & Coverage ─────────────────────────────
  describe('1. Paraphrase Equivalence & Coverage', () => {
    const sweepPrompts = [
      'What needs my review today?',
      'What needs my attention today?',
      'What operational exceptions require my attention today?',
    ];

    for (const prompt of sweepPrompts) {
      it(`TC-ORCH-01: Paraphrase "${prompt}" executes all 4 tools across 5 domains`, async () => {
        const res = await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${principalToken}`)
          .send({
            messages: [{ role: 'user', content: prompt }],
            portal: 'Principal',
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const data = res.body.data;
        expect(data.toolsExecuted).toContain('getFacultyAttendanceAudit');
        expect(data.toolsExecuted).toContain('getPendingLeaves');
        expect(data.toolsExecuted).toContain('getAdministrativeBehaviorSummary');
        expect(data.toolsExecuted).toContain('getSchoolOperationalFactSheet');

        expect(data.responseType).toBe('structured');
        expect(data.structuredData.type).toBe('fact_sheet');
        expect(data.message.content).toMatch(/review|attention|leave|attendance/i);
      });
    }
  });

  // ─── 2. Multi-Domain Requests (Cross-Domain Synthesis) ─────────────────
  describe('2. Multi-Domain Requests', () => {
    it('TC-ORCH-02: Multi-domain query dispatches exact relevant tools and covers all domains', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{
            role: 'user',
            content: "Compare today's faculty attendance exceptions with pending leave requests and unresolved behavior cases."
          }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.toolsExecuted).toContain('getFacultyAttendanceAudit');
      expect(data.toolsExecuted).toContain('getPendingLeaves');
      expect(data.toolsExecuted).toContain('getAdministrativeBehaviorSummary');

      // Crucial: Must NOT fall back to generic feature menu
      expect(data.message.content).not.toBe('Which DigiSkwela feature do you need help with?');
      expect(data.message.content).toMatch(/attendance|check-in/i);
      expect(data.message.content).toMatch(/leave/i);
      expect(data.message.content).toMatch(/behavior|incident/i);
    });
  });

  // ─── 3. Multi-Question Requests ────────────────────────────────────────
  describe('3. Multi-Question Requests', () => {
    it('TC-ORCH-03: Multi-question query addresses both questions in unified synthesis', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{
            role: 'user',
            content: 'How many pending leaves are there, and are there any unresolved student behavior incidents?'
          }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.toolsExecuted).toContain('getPendingLeaves');
      expect(data.toolsExecuted).toContain('getAdministrativeBehaviorSummary');

      expect(data.message.content).toMatch(/leave/i);
      expect(data.message.content).toMatch(/behavior|incident/i);
    });
  });

  // ─── 4. Grounded Correlation ──────────────────────────────────────────
  describe('4. Grounded Correlation (Authoritative Overlap Only)', () => {
    it('TC-ORCH-04: Correlation query never asserts unsupported truancy or causal claims', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{
            role: 'user',
            content: 'Correlate faculty attendance exceptions with pending leave requests.'
          }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      const content = res.body.data.message.content;

      // Neutral semantics
      expect(content).not.toMatch(/\b(AWOL|Late|Tardy|Undertime|Absent|Unexcused)\b/i);
    });
  });

  // ─── 5. Suggested Review Prioritization with Mandatory Disclaimer ──────
  describe('5. Review Prioritization with Disclaimer', () => {
    it('TC-ORCH-05: Prioritization includes suggested order and mandatory disclaimer', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{
            role: 'user',
            content: 'Prioritize what I should review first today.'
          }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      const content = res.body.data.message.content;

      expect(content).toContain('Items are listed in no particular order of importance.');
    });
  });

  // ─── 6. Read-Only Administrative Drafting ─────────────────────────────
  describe('6. Read-Only Administrative Drafting', () => {
    it('TC-ORCH-06: Drafting request includes read-only disclaimer and non-prescriptive tone', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{
            role: 'user',
            content: 'Draft a reminder memo for faculty to complete pending term grades.'
          }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.toolsExecuted).toContain('getAcademicAnalytics');
      expect(data.message.content).toContain('(Draft for Principal review · Read-only AI assistance)');
      expect(data.message.content).not.toMatch(/\bApprove the pending leave\b/i);
    });
  });

  // ─── 7. Conversational Follow-ups & Anaphora ───────────────────────────
  describe('7. Conversational Follow-ups & Anaphora', () => {
    it('TC-ORCH-07: Contextual follow-up resolves antecedent to attendance filter', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [
            { role: 'user', content: "Review today's faculty attendance." },
            { role: 'assistant', content: "Here is today's faculty attendance audit." },
            { role: 'user', content: 'Which of them are on approved leave?' },
          ],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.responseType).toBe('structured');
      expect(res.body.data.toolsExecuted).toContain('getFacultyAttendanceAudit');
      const records = res.body.data.structuredData.raw.records || [];
      records.forEach((r: any) => {
        expect(r.attendanceStatus).toBe('ON_APPROVED_LEAVE');
      });
    });

    it('TC-ORCH-08: Ambiguous follow-up without antecedent honestly asks for clarification', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'Which of them are on approved leave?' }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.toolsExecuted).toHaveLength(0);
      expect(res.body.data.message.content).toMatch(/clarify/i);
    });
  });

  // ─── 8. Navigation Guidance ────────────────────────────────────────────
  describe('8. Navigation Guidance', () => {
    it('TC-ORCH-09: Direct navigation request executes 0 tools and returns navigation action', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'Where do I manage faculty leave requests?' }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.toolsExecuted).toHaveLength(0);
      expect(data.responseType).toBe('text');
      expect(data.navigationActions?.[0].screen).toBe('p-leaves');
    });
  });

  // ─── 9. Out-of-Scope Enforcement ──────────────────────────────────────
  describe('9. Out-of-Scope Enforcement', () => {
    it('TC-ORCH-10: Non-school requests are declined neutrally without tool calls', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'Write a python script to sort an array.' }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.toolsExecuted).toHaveLength(0);
      expect(data.scopeDecision).toMatch(/OUT_OF_SCOPE/);
      expect(data.message.content).toMatch(/administrative school assistant|cannot write code|out of scope/i);
    });
  });

  // ─── 10. Completeness Validator Unit Remedy ────────────────────────────
  describe('10. Completeness Validator Remedy', () => {
    it('TC-ORCH-11: Appends grounded summary when a requested secondary domain is omitted', () => {
      const plan: any = {
        intent: 'MULTI_DOMAIN',
        toolsToExecute: [],
        primaryToolName: 'getFacultyAttendanceAudit',
        obligations: [
          { domain: 'faculty_attendance', operation: 'retrieve', description: 'Faculty attendance' },
          { domain: 'leaves', operation: 'retrieve', description: 'Pending leave requests' },
        ],
      };

      const executedResults: any[] = [
        {
          name: 'getFacultyAttendanceAudit',
          success: true,
          result: { summary: { completedCount: 20, timeOutPendingCount: 2, onApprovedLeaveCount: 1, noGateCheckInNoApprovedLeaveFoundCount: 2 } },
        },
        {
          name: 'getPendingLeaves',
          success: true,
          result: { totalPending: 3, requests: [{}, {}, {}] },
        },
      ];

      const aggregateData: any = {
        correlations: [],
        priorities: [],
        mergedSourceDomains: ['Faculty Attendance', 'Leave Management'],
      };

      // Narrative mentions attendance but omits leaves
      const narrativeWithOmission = "Here is today's faculty attendance audit with 20 completed check-ins.";
      const remedy = validateAndRemedyCompleteness(
        narrativeWithOmission,
        plan,
        executedResults,
        aggregateData,
        'getFacultyAttendanceAudit',
        true // primary card represents attendance
      );

      // The omitted leaves domain MUST be remedied
      expect(remedy.auditMetrics.remediedCount).toBe(1);
      expect(remedy.finalizedContent).toContain('3 faculty leave application(s) are currently pending review');
    });

    it('TC-ORCH-12: Appends explicit unavailability note when a tool fails', () => {
      const plan: any = {
        intent: 'MULTI_DOMAIN',
        toolsToExecute: [],
        primaryToolName: 'getFacultyAttendanceAudit',
        obligations: [
          { domain: 'behavior', operation: 'retrieve', description: 'Behavior records' },
        ],
      };

      const executedResults: any[] = [
        {
          name: 'getAdministrativeBehaviorSummary',
          success: false,
          error: 'Database timeout',
        },
      ];

      const remedy = validateAndRemedyCompleteness(
        "Faculty attendance checked.",
        plan,
        executedResults,
        { correlations: [], priorities: [], mergedSourceDomains: [] },
        'getFacultyAttendanceAudit',
        false
      );

      expect(remedy.auditMetrics.unmetCount).toBe(1);
      expect(remedy.finalizedContent).toContain('Could not verify Behavioral Reports records at this time.');
    });
  });

  // ─── 11. Provider Parity (Groq & Cloudflare) ───────────────────────────
  describe('11. Provider Parity (Groq & Cloudflare)', () => {
    it('TC-ORCH-13: Groq and Cloudflare receive identical multi-domain tool messages & synthesis directive', async () => {
      let groqReceivedDirective = false;
      let cfReceivedDirective = false;

      const groqProvider: DigiSkwelaAIProvider = {
        name: 'GroqAIProvider',
        mode: 'groq',
        generateResponse: vi.fn().mockImplementation(async (req) => {
          groqReceivedDirective = req.messages.some((m: any) => m.role === 'system' && m.content.includes('OPERATIONAL OBLIGATIONS'));
          return {
            message: {
              role: 'assistant',
              content: 'Groq synthesized response: Faculty attendance shows active presence, while 1 leave request is pending review.',
            },
            finishReason: 'stop',
            usage: { promptTokens: 300, completionTokens: 40, totalTokens: 340 },
          };
        }),
      };

      const cloudflareProvider: DigiSkwelaAIProvider = {
        name: 'CloudflareAIProvider',
        mode: 'cloudflare',
        generateResponse: vi.fn().mockImplementation(async (req) => {
          cfReceivedDirective = req.messages.some((m: any) => m.role === 'system' && m.content.includes('OPERATIONAL OBLIGATIONS'));
          return {
            message: {
              role: 'assistant',
              content: 'Cloudflare synthesized response: Faculty attendance is tracked, and 1 leave request is pending review.',
            },
            finishReason: 'stop',
            usage: { promptTokens: 300, completionTokens: 40, totalTokens: 340 },
          };
        }),
      };

      // Run Groq
      vi.spyOn(factory, 'getAIProvider').mockReturnValue(groqProvider);
      const groqRes = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'Compare faculty attendance with pending leaves.' }],
          portal: 'Principal',
        });

      // Run Cloudflare
      vi.spyOn(factory, 'getAIProvider').mockReturnValue(cloudflareProvider);
      const cfRes = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: 'Compare faculty attendance with pending leaves.' }],
          portal: 'Principal',
        });

      vi.restoreAllMocks();

      expect(groqReceivedDirective).toBe(true);
      expect(cfReceivedDirective).toBe(true);
      expect(groqRes.body.data.toolsExecuted).toEqual(cfRes.body.data.toolsExecuted);
      expect(groqRes.body.data.toolsExecuted).toContain('getFacultyAttendanceAudit');
      expect(groqRes.body.data.toolsExecuted).toContain('getPendingLeaves');
    });
  });

  // ─── 12. AIAuditLog: Privacy & Metadata Invariant ──────────────────────
  describe('12. AIAuditLog Privacy & Orchestration Invariant', () => {
    it('TC-ORCH-14: Audit log records orchestration metadata in tokenUsage and excludes raw prompts', async () => {
      const uniqueSecret = 'OrchSecret_PrivacyTest_9921';
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${principalToken}`)
        .send({
          messages: [{ role: 'user', content: `What needs my review today? ${uniqueSecret}` }],
          portal: 'Principal',
        });

      expect(res.status).toBe(200);
      const traceId = res.body.data.traceId;

      const audit = await prisma.aIAuditLog.findFirst({
        where: { trace_id: traceId },
      });

      expect(audit).not.toBeNull();
      const rawAuditStr = JSON.stringify(audit);
      expect(rawAuditStr).not.toContain(uniqueSecret);
      expect(rawAuditStr).not.toContain(res.body.data.message.content);

      // Verify orchestration metadata inside token_usage
      const tokenUsage = audit?.token_usage as any;
      expect(tokenUsage?.orchestration).toBeDefined();
      expect(tokenUsage?.orchestration?.intent).toBe('SWEEP');
      expect(tokenUsage?.orchestration?.obligationsTotal).toBeGreaterThanOrEqual(1);
    });
  });
});
