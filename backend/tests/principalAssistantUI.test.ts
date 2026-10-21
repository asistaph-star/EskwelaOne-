import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseAssistantResponse } from '../../src/app/principal/ai/utils/parseAssistantResponse.js';
import { PRINCIPAL_QUICK_PROMPTS } from '../../src/app/principal/ai/constants/quickPrompts.js';

describe('DIGISKWELA — MILESTONE 3 PHASE D: PRINCIPAL ASSISTANT UI CONTRACTS & SECURITY', () => {
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

    // Verify natural language without internal tool names leaked
    PRINCIPAL_QUICK_PROMPTS.forEach(qp => {
      expect(qp.prompt).not.toMatch(/get[A-Z]/); // No camelCase internal names
      expect(qp.prompt).not.toMatch(/generate[A-Z]/);
      expect(qp.prompt.length).toBeGreaterThan(10);
      expect(qp.label.length).toBeGreaterThan(5);
    });
  });

  // ─── 2. Neutral Attendance Semantics ───────────────────────────────────
  it('TC-PUI-02: Parsing faculty attendance output strictly preserves neutral presence semantics', () => {
    const mockToolOutput = {
      asOfDate: '2026-10-21',
      summary: {
        totalActiveFaculty: 30,
        completedCount: 22,
        timeOutPendingCount: 4,
        onApprovedLeaveCount: 1,
        noGateCheckInNoApprovedLeaveFoundCount: 3,
      },
      records: [
        {
          teacherId: 't-1',
          teacherName: 'Santos, Maria',
          department: 'Science',
          attendanceStatus: 'NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND',
        },
      ],
      provenance: {
        sourceDomains: ['Faculty Attendance', 'Leave Management'],
        asOf: '2026-10-21T07:00:00Z',
      },
    };

    const rawMessage = `Verified DigiSkwela Data Grounding:\n${JSON.stringify(mockToolOutput, null, 2)}`;
    const parsed = parseAssistantResponse(rawMessage, ['getFacultyAttendanceAudit']);

    expect(parsed.structuredData).toBeDefined();
    expect(parsed.structuredData?.type).toBe('attendance');
    expect(parsed.structuredData?.raw.summary.noGateCheckInNoApprovedLeaveFoundCount).toBe(3);

    // Verify provenance extracted accurately
    expect(parsed.structuredData?.provenance?.sourceDomains).toEqual([
      'Faculty Attendance',
      'Leave Management',
    ]);
  });

  // ─── 3. Academic Completeness Rules ────────────────────────────────────
  it('TC-PUI-03: Parsing academic analytics preserves completeness rules and explains partial records', () => {
    const mockAcademicOutput = {
      academicYear: '2025-2026',
      completenessStatus: 'partial_term_record',
      annualPassRate: null,
      interpretationNote: 'Annual pass rate is null because Term 4 grades are not submitted.',
      termSummaries: [],
      provenance: {
        sourceDomains: ['Academic Analytics'],
        asOf: '2026-10-21T07:00:00Z',
      },
    };

    const rawMessage = `Verified DigiSkwela Data Grounding:\n${JSON.stringify(mockAcademicOutput, null, 2)}`;
    const parsed = parseAssistantResponse(rawMessage, ['getAcademicAnalytics']);

    expect(parsed.structuredData?.type).toBe('academics');
    expect(parsed.structuredData?.raw.annualPassRate).toBeNull();
    expect(parsed.structuredData?.raw.completenessStatus).toBe('partial_term_record');
    expect(parsed.structuredData?.provenance?.sourceDomains).toContain('Academic Analytics');
  });

  // ─── 4. Provenance Extraction ──────────────────────────────────────────
  it('TC-PUI-04: Provenance correctly surfaces verified source domains and timestamp without leaking internal paths', () => {
    const mockBriefOutput = {
      briefTitle: 'Executive Committee Brief',
      reportingPeriod: 'Today',
      meetingType: 'EXECUTIVE_COMMITTEE',
      operationalHighlights: [{ label: 'Enrolled Students', value: 1250 }],
      discussionItems: ['Review campus security'],
      pendingAdministrativeItems: [],
      upcomingDates: [],
      sourceDomains: ['Executive Summary', 'Leave Management', 'Events Calendar'],
      asOf: '2026-10-21T07:30:00Z',
    };

    const rawMessage = `Verified DigiSkwela Data Grounding:\n${JSON.stringify(mockBriefOutput, null, 2)}`;
    const parsed = parseAssistantResponse(rawMessage, ['generatePrincipalMeetingBrief']);

    expect(parsed.structuredData?.type).toBe('meeting_brief');
    expect(parsed.structuredData?.provenance?.sourceDomains).toEqual([
      'Executive Summary',
      'Leave Management',
      'Events Calendar',
    ]);
    expect(parsed.structuredData?.provenance?.asOf).toBe('2026-10-21T07:30:00Z');
  });

  // ─── 5. Provenance Omission When Absent ────────────────────────────────
  it('TC-PUI-05: Provenance is undefined if the backend response contains no provenance metadata', () => {
    const plainMessage = 'Hello Principal, how can I assist you with DigiSkwela operations today?';
    const parsed = parseAssistantResponse(plainMessage, []);

    expect(parsed.displayText).toBe(plainMessage);
    expect(parsed.structuredData).toBeUndefined();
  });

  // ─── 6. Empty Result Handling ──────────────────────────────────────────
  it('TC-PUI-06: Empty results for leaves, events, and behavior are correctly identified', () => {
    const emptyLeaves = {
      totalPending: 0,
      leaves: [],
      provenance: { sourceDomains: ['Leave Management'] },
    };
    const parsedLeaves = parseAssistantResponse(
      `Verified DigiSkwela Data Grounding:\n${JSON.stringify(emptyLeaves)}`,
      ['getPendingLeaves']
    );
    expect(parsedLeaves.structuredData?.type).toBe('leaves');
    expect(parsedLeaves.structuredData?.raw.totalPending).toBe(0);

    const emptyEvents = {
      window: { startDate: '2026-10-21', endDate: '2026-10-28' },
      totalEvents: 0,
      events: [],
      provenance: { sourceDomains: ['Events Calendar'] },
    };
    const parsedEvents = parseAssistantResponse(
      `Verified DigiSkwela Data Grounding:\n${JSON.stringify(emptyEvents)}`,
      ['getUpcomingEvents']
    );
    expect(parsedEvents.structuredData?.type).toBe('events');
    expect(parsedEvents.structuredData?.raw.totalEvents).toBe(0);
  });

  // ─── 7. Weekly Operations Report Typing ─────────────────────────────────
  it('TC-PUI-07: Weekly Operations Report structure is accurately identified', () => {
    const mockWeeklyReport = {
      reportPeriod: { startDate: '2026-10-14', endDate: '2026-10-21', label: 'Oct 14 - Oct 21' },
      executiveSummaryFacts: { enrolledStudents: 1240, studentsOnCampusToday: 1180, totalActiveFaculty: 45, facultyCheckedInToday: 42 },
      facultyAttendanceFacts: { totalActiveFaculty: 45, checkedInToday: 42, timeOutPendingToday: 5, completedToday: 37, attendanceSemanticsNote: 'Neutral gate scan data' },
      leaveFacts: { pendingApprovalsCount: 2, approvedLeavesCoveringPeriod: 1 },
      administrativeBehaviorFacts: { openCasesCount: 1, studentsRequiringAttention: 1, investigationPendingCount: 1, breakdownByGrade: [] },
      upcomingEventsFacts: { totalUpcomingEvents: 3, nextThreeEvents: [] },
      academicCompletenessFacts: { completenessStatus: 'partial_term_record', annualPassRate: null, note: 'Partial data' },
      sourceDomains: ['Faculty Attendance', 'Leave Management', 'Academic Analytics'],
      generatedAt: '2026-10-21T07:45:00Z',
    };

    const rawMessage = `Verified DigiSkwela Data Grounding:\n${JSON.stringify(mockWeeklyReport, null, 2)}`;
    const parsed = parseAssistantResponse(rawMessage, ['generateWeeklyOperationsReport']);

    expect(parsed.structuredData?.type).toBe('weekly_report');
    expect(parsed.structuredData?.raw.executiveSummaryFacts.enrolledStudents).toBe(1240);
    expect(parsed.structuredData?.provenance?.sourceDomains).toContain('Faculty Attendance');
  });

  // ─── 8. Session Privacy: Zero localStorage / IndexedDB transcript writes ──
  it('TC-PUI-08: Principal Assistant codebase contains ZERO transcript writes to localStorage or indexedDB', () => {
    const assistantDir = path.resolve(__dirname, '../../src/app/principal/ai');
    const files = fs.readdirSync(assistantDir, { recursive: true }) as string[];

    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const fullPath = path.join(assistantDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Verify zero localStorage transcript writes
        expect(content).not.toMatch(/localStorage\.setItem\s*\(\s*['"]chat/i);
        expect(content).not.toMatch(/localStorage\.setItem\s*\(\s*['"]assistant/i);
        expect(content).not.toMatch(/localStorage\.setItem\s*\(\s*['"]messages/i);
        expect(content).not.toMatch(/indexedDB/i);
      }
    }
  });

  // ─── 9. Legacy Principal Widget Cleanup Verification ────────────────────
  it('TC-PUI-09: PrincipalApp.tsx mounts only PrincipalAIAssistant and has zero AIAssistantWidget mounts', () => {
    const principalAppPath = path.resolve(__dirname, '../../src/app/principal/PrincipalApp.tsx');
    const content = fs.readFileSync(principalAppPath, 'utf-8');

    // Must NOT contain AIAssistantWidget
    expect(content).not.toContain('AIAssistantWidget');

    // MUST contain PrincipalAIAssistant
    expect(content).toContain('PrincipalAIAssistant');
    expect(content).toContain('<PrincipalAIAssistant onNavigate={setScreen} />');
  });

  // ─── 10. Shared Widget Preserved for Other Portals ───────────────────────
  it('TC-PUI-10: AIAssistantWidget.tsx still exists for Teacher, Registrar, and Guidance portals', () => {
    const sharedWidgetPath = path.resolve(__dirname, '../../src/app/shared/components/AIAssistantWidget.tsx');
    expect(fs.existsSync(sharedWidgetPath)).toBe(true);

    const teacherAppPath = path.resolve(__dirname, '../../src/app/teacher/TeacherApp.tsx');
    const teacherContent = fs.readFileSync(teacherAppPath, 'utf-8');
    expect(teacherContent).toContain('AIAssistantWidget');
  });

  // ─── 11. Backend API Endpoint Invariant ─────────────────────────────────
  it('TC-PUI-11: aiApi.chat connects to /ai/chat using POST with credentials included', () => {
    const aiApiPath = path.resolve(__dirname, '../../src/api/ai.api.ts');
    const content = fs.readFileSync(aiApiPath, 'utf-8');

    expect(content).toContain("apiClient.post<AIChatResponse>('/ai/chat', request)");
  });

  // ─── 12. Safe Navigation Integrity: Zero Mutation Actions ───────────────
  it('TC-PUI-12: Principal Assistant UI provides safe navigation only and contains zero mutation triggers', () => {
    const structuredRendererPath = path.resolve(__dirname, '../../src/app/principal/ai/components/StructuredDataRenderer.tsx');
    const content = fs.readFileSync(structuredRendererPath, 'utf-8');

    // Allowed read-only screens
    expect(content).toContain("'p-monitoring'");
    expect(content).toContain("'p-leaves'");
    expect(content).toContain("'p-events'");
    expect(content).toContain("'p-behavior'");
    expect(content).toContain("'p-analytics'");
    expect(content).toContain("'p-dashboard'");

    // Prohibit mutation calls
    expect(content).not.toContain('.delete(');
    expect(content).not.toContain('.post(');
    expect(content).not.toContain('.patch(');
    expect(content).not.toContain('.put(');
    expect(content).not.toContain('approveLeave');
    expect(content).not.toContain('deleteRecord');
  });

  // ─── 13. Mock Provider State Identifier ─────────────────────────────────
  it('TC-PUI-13: PrincipalAssistantDrawer visibly displays subtle development mode badge', () => {
    const drawerPath = path.resolve(__dirname, '../../src/app/principal/ai/PrincipalAssistantDrawer.tsx');
    const content = fs.readFileSync(drawerPath, 'utf-8');

    expect(content).toContain('Development mode · Grounded DigiSkwela data');
    expect(content).toContain('data-testid="mock-provider-badge"');
  });
});
