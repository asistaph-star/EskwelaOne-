import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/database.js';
import { generateId } from '../src/common/utils/uuid.js';
import { sign } from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { 
  normalizeAssistantResponse, 
  parseAssistantResponse 
} from '../../src/app/principal/ai/utils/parseAssistantResponse.js';
import { PRINCIPAL_QUICK_PROMPTS } from '../../src/app/principal/ai/constants/quickPrompts.js';
import { AIChatResponse } from '../../src/api/ai.api.js';
import { aiConfig } from '../src/config/ai.config.js';

describe('DIGISKWELA — MILESTONE 3 PHASE D: PRINCIPAL ASSISTANT UI CONTRACTS, CONVERSATION & SECURITY', () => {
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
        email: `prin_ui_hard_${Date.now()}@calulut.edu.ph`,
        password_hash: 'hashed_pw',
        first_name: 'Principal',
        last_name: 'Hardening',
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

    principalToken = sign(
      { userId: principalUserId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    aiConfig.providerMode = originalProviderMode;
    await prisma.aIAuditLog.deleteMany({ where: { user_id: principalUserId } });
    await prisma.userRole.deleteMany({ where: { user_id: principalUserId } });
    await prisma.user.deleteMany({ where: { id: principalUserId } });
  });

  // ─── 1. Quick Prompts Coverage & Integrity ─────────────────────────────
  it('TC-PUI-01: Quick Prompts cover all 8 locked Principal tools with grounded natural-language prompts', () => {
    expect(PRINCIPAL_QUICK_PROMPTS).toHaveLength(8);

    const promptIds = PRINCIPAL_QUICK_PROMPTS.map(p => p.id);
    expect(promptIds).toContain('qp-factsheet');
    expect(promptIds).toContain('qp-attendance');
    expect(promptIds).toContain('qp-leaves');
    expect(promptIds).toContain('qp-events');
    expect(promptIds).toContain('qp-behavior');
    expect(promptIds).toContain('qp-academics');
    expect(promptIds).toContain('qp-brief');
    expect(promptIds).toContain('qp-weekly');

    PRINCIPAL_QUICK_PROMPTS.forEach(qp => {
      expect(qp.prompt).not.toMatch(/get[A-Z]/);
      expect(qp.prompt).not.toMatch(/generate[A-Z]/);
      expect(qp.prompt.length).toBeGreaterThan(10);
      expect(qp.label.length).toBeGreaterThan(5);
    });
  });

  // ─── 2. Provider Independence: Zero Mock Scraper in parseAssistantResponse ──
  it('TC-PUI-02: Frontend is provider-agnostic and contains ZERO MockAIProvider-specific text or JSON scraping', () => {
    const parseUtilPath = path.resolve(__dirname, '../../src/app/principal/ai/utils/parseAssistantResponse.ts');
    const content = fs.readFileSync(parseUtilPath, 'utf-8');

    // Must NOT contain MockAIProvider grounding prefix
    expect(content).not.toContain('Verified DigiSkwela Data Grounding:\n');
    // Must NOT scrape markdown code fence
    expect(content).not.toContain('```json');
    // Must NOT contain provider-specific logic
    expect(content).not.toContain('MockAIProvider');
    expect(content).not.toContain('Groq');
    expect(content).not.toContain('OpenAI');
  });

  // ─── 3. Normalized Response Contract: Attendance Typing ─────────────────
  it('TC-PUI-03: Normalized response contract maps attendance data without client-side JSON parsing', () => {
    const mockApiResponse: AIChatResponse = {
      message: {
        role: 'assistant',
        content: "Here is today's faculty attendance audit based on verified gate records and leave logs.",
      },
      responseType: 'structured',
      structuredData: {
        type: 'attendance',
        raw: {
          asOfDate: '2026-10-21',
          summary: {
            totalActiveFaculty: 30,
            completedCount: 22,
            timeOutPendingCount: 4,
            onApprovedLeaveCount: 1,
            noGateCheckInNoApprovedLeaveFoundCount: 3,
          },
          records: [],
        },
        provenance: {
          sourceDomains: ['Faculty Attendance', 'Gate Attendance', 'Leave Management'],
          asOf: '2026-10-21T07:00:00Z',
        },
      },
      provenance: {
        sourceDomains: ['Faculty Attendance', 'Gate Attendance', 'Leave Management'],
        asOf: '2026-10-21T07:00:00Z',
      },
      navigationActions: [
        {
          label: 'View Faculty Attendance',
          screen: 'p-monitoring',
          description: 'Open Faculty Attendance monitoring tab',
        },
      ],
      traceId: 'tr_test_123',
      scopeDecision: 'ALLOWED',
      toolsExecuted: ['getFacultyAttendanceAudit'],
    };

    const normalized = normalizeAssistantResponse(mockApiResponse);

    expect(normalized.displayText).toBe("Here is today's faculty attendance audit based on verified gate records and leave logs.");
    expect(normalized.responseType).toBe('structured');
    expect(normalized.structuredData?.type).toBe('attendance');
    expect(normalized.structuredData?.raw.summary.noGateCheckInNoApprovedLeaveFoundCount).toBe(3);
    expect(normalized.provenance?.sourceDomains).toEqual([
      'Faculty Attendance',
      'Gate Attendance',
      'Leave Management',
    ]);
    expect(normalized.navigationActions?.[0].screen).toBe('p-monitoring');
  });

  // ─── 4. Normalized Response Contract: Academic Analytics Typing ──────────
  it('TC-PUI-04: Normalized response contract maps academic analytics with completeness rules', () => {
    const mockApiResponse: AIChatResponse = {
      message: {
        role: 'assistant',
        content: 'Here are the authorized academic performance analytics for Calulut Integrated School.',
      },
      responseType: 'structured',
      structuredData: {
        type: 'academics',
        raw: {
          academicYear: '2025-2026',
          completenessStatus: 'partial_term_record',
          annualPassRate: null,
          interpretationNote: 'Annual pass rate is null because Term 4 grades are not submitted.',
        },
        provenance: {
          sourceDomains: ['Academic Analytics'],
          asOf: '2026-10-21T07:00:00Z',
        },
      },
      traceId: 'tr_acad_123',
      scopeDecision: 'ALLOWED',
      toolsExecuted: ['getAcademicAnalytics'],
    };

    const normalized = normalizeAssistantResponse(mockApiResponse);

    expect(normalized.responseType).toBe('structured');
    expect(normalized.structuredData?.type).toBe('academics');
    expect(normalized.structuredData?.raw.annualPassRate).toBeNull();
    expect(normalized.structuredData?.raw.completenessStatus).toBe('partial_term_record');
  });

  // ─── 5. Plain Text Messages Return responseType: 'text' ───────────────────
  it('TC-PUI-05: Plain messages return responseType text without structuredData', () => {
    const mockPlainResponse: AIChatResponse = {
      message: {
        role: 'assistant',
        content: 'Hello Principal, how can I assist you with DigiSkwela operations today?',
      },
      responseType: 'text',
      traceId: 'tr_plain_123',
      scopeDecision: 'ALLOWED',
      toolsExecuted: [],
    };

    const normalized = normalizeAssistantResponse(mockPlainResponse);

    expect(normalized.displayText).toBe('Hello Principal, how can I assist you with DigiSkwela operations today?');
    expect(normalized.responseType).toBe('text');
    expect(normalized.structuredData).toBeUndefined();
  });

  // ─── 6. Conversational Follow-Up: Turn 1 -> Turn 2 Resolution ───────────
  it('TC-PUI-06: Conversational follow-up Turn 1 (attendance) -> Turn 2 (which of them are on approved leave) resolves contextually', async () => {
    // Turn 1: Initial query
    const turn1Res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: "Review today's faculty attendance." }],
        portal: 'Principal',
      });

    expect(turn1Res.status).toBe(200);
    expect(turn1Res.body.data.responseType).toBe('structured');
    expect(turn1Res.body.data.toolsExecuted).toContain('getFacultyAttendanceAudit');
    expect(turn1Res.body.data.structuredData.type).toBe('attendance');

    const assistantTurn1Narrative = turn1Res.body.data.message.content;

    // Turn 2: Follow-up referencing "them"
    const turn2Res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [
          { role: 'user', content: "Review today's faculty attendance." },
          { role: 'assistant', content: assistantTurn1Narrative },
          { role: 'user', content: 'Which of them are on approved leave?' },
        ],
        portal: 'Principal',
      });

    expect(turn2Res.status).toBe(200);
    expect(turn2Res.body.data.responseType).toBe('structured');
    // Understands "them" refers to faculty attendance and calls getFacultyAttendanceAudit
    expect(turn2Res.body.data.toolsExecuted).toContain('getFacultyAttendanceAudit');
    expect(turn2Res.body.data.structuredData.type).toBe('attendance');
    // Records returned are filtered for ON_APPROVED_LEAVE
    const records = turn2Res.body.data.structuredData.raw.records || [];
    records.forEach((r: any) => {
      expect(r.attendanceStatus).toBe('ON_APPROVED_LEAVE');
    });
  });

  // ─── 7. Conversational Follow-Up: Turn 1 -> Turn 2 (no gate check-in) ───
  it('TC-PUI-07: Conversational follow-up Turn 2 (which of them have no gate check-in) resolves contextually', async () => {
    const turn2Res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [
          { role: 'user', content: "Review today's faculty attendance." },
          { role: 'assistant', content: "Here is today's faculty attendance audit." },
          { role: 'user', content: 'Which of them have no gate check-in?' },
        ],
        portal: 'Principal',
      });

    expect(turn2Res.status).toBe(200);
    expect(turn2Res.body.data.responseType).toBe('structured');
    expect(turn2Res.body.data.toolsExecuted).toContain('getFacultyAttendanceAudit');
    const records = turn2Res.body.data.structuredData.raw.records || [];
    records.forEach((r: any) => {
      expect(r.attendanceStatus).toBe('NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND');
    });
  });

  // ─── 8. Ambiguous Reference Without Antecedent: Honest Clarification ─────
  it('TC-PUI-08: Ambiguous follow-up without antecedent asks for clarification rather than guessing', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [
          { role: 'user', content: 'Which of them are on approved leave?' },
        ],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.responseType).toBe('text');
    // Must NOT execute any tool
    expect(res.body.data.toolsExecuted).toHaveLength(0);
    // Must honestly ask for clarification
    expect(res.body.data.message.content).toMatch(/clarify/i);
  });

  // ─── 9. Session Privacy: Zero localStorage / IndexedDB transcript writes ──
  it('TC-PUI-09: Principal Assistant codebase contains ZERO transcript writes to localStorage or indexedDB', () => {
    const assistantDir = path.resolve(__dirname, '../../src/app/principal/ai');
    const files = fs.readdirSync(assistantDir, { recursive: true }) as string[];

    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const fullPath = path.join(assistantDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');

        expect(content).not.toMatch(/localStorage\.setItem\s*\(\s*['"]chat/i);
        expect(content).not.toMatch(/localStorage\.setItem\s*\(\s*['"]assistant/i);
        expect(content).not.toMatch(/localStorage\.setItem\s*\(\s*['"]messages/i);
        expect(content).not.toMatch(/indexedDB/i);
      }
    }
  });

  // ─── 10. AIAuditLog: Excludes Raw Prompts & Narrative Transcripts ────────
  it('TC-PUI-10: AIAuditLog strictly excludes raw prompts, narrative completions, and full transcripts', async () => {
    const sensitiveQuery = 'AuditQuery_PrivacyInvariant_Verify789';

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        messages: [{ role: 'user', content: sensitiveQuery }],
        portal: 'Principal',
      });

    expect(res.status).toBe(200);
    const traceId = res.body.data.traceId;

    const auditEntry = await prisma.aIAuditLog.findFirst({
      where: { trace_id: traceId },
    });

    expect(auditEntry).not.toBeNull();
    const entryJson = JSON.stringify(auditEntry);
    expect(entryJson).not.toContain(sensitiveQuery);
    expect(entryJson).not.toContain(res.body.data.message.content);
  });

  // ─── 11. Legacy Principal Widget Cleanup Verification ───────────────────
  it('TC-PUI-11: PrincipalApp.tsx mounts only PrincipalAIAssistant and has zero AIAssistantWidget mounts', () => {
    const principalAppPath = path.resolve(__dirname, '../../src/app/principal/PrincipalApp.tsx');
    const content = fs.readFileSync(principalAppPath, 'utf-8');

    expect(content).not.toContain('AIAssistantWidget');
    expect(content).toContain('PrincipalAIAssistant');
    expect(content).toMatch(/<PrincipalAIAssistant\s+onNavigate={setScreen}/);
  });

  // ─── 12. Shared Widget Preserved for Other Portals ──────────────────────
  it('TC-PUI-12: AIAssistantWidget.tsx still exists for Teacher, Registrar, and Guidance portals', () => {
    const sharedWidgetPath = path.resolve(__dirname, '../../src/app/shared/components/AIAssistantWidget.tsx');
    expect(fs.existsSync(sharedWidgetPath)).toBe(true);

    const teacherAppPath = path.resolve(__dirname, '../../src/app/teacher/TeacherApp.tsx');
    const teacherContent = fs.readFileSync(teacherAppPath, 'utf-8');
    expect(teacherContent).toContain('AIAssistantWidget');
  });

  // ─── 13. Backend API Endpoint Invariant ─────────────────────────────────
  it('TC-PUI-13: aiApi.chat connects to /ai/chat using POST with credentials included', () => {
    const aiApiPath = path.resolve(__dirname, '../../src/api/ai.api.ts');
    const content = fs.readFileSync(aiApiPath, 'utf-8');

    expect(content).toContain("apiClient.post<AIChatResponse>('/ai/chat', request)");
  });

  // ─── 14. Safe Navigation Integrity: Zero Mutation Actions ───────────────
  it('TC-PUI-14: Principal Assistant UI provides safe navigation only and contains zero mutation triggers', () => {
    const structuredRendererPath = path.resolve(__dirname, '../../src/app/principal/ai/components/StructuredDataRenderer.tsx');
    const content = fs.readFileSync(structuredRendererPath, 'utf-8');

    expect(content).toContain("'p-monitoring'");
    expect(content).toContain("'p-leaves'");
    expect(content).toContain("'p-events'");
    expect(content).toContain("'p-behavior'");
    expect(content).toContain("'p-analytics'");
    expect(content).toContain("'p-dashboard'");

    expect(content).not.toContain('.delete(');
    expect(content).not.toContain('.post(');
    expect(content).not.toContain('.patch(');
    expect(content).not.toContain('.put(');
    expect(content).not.toContain('approveLeave');
    expect(content).not.toContain('deleteRecord');
  });

  // ─── 15. Mock Provider State Identifier ─────────────────────────────────
  it('TC-PUI-15: PrincipalAssistantDrawer visibly displays subtle development mode badge', () => {
    const drawerPath = path.resolve(__dirname, '../../src/app/principal/ai/PrincipalAssistantDrawer.tsx');
    const content = fs.readFileSync(drawerPath, 'utf-8');

    expect(content).toContain('Dev · Live data');
    expect(content).toContain('data-testid="mock-provider-badge"');
  });
});
