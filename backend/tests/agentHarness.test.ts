import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { digiSkwelaAgentHarness } from '../src/ai/harness/agentHarness.js';
import { roleCapabilityRegistry } from '../src/ai/harness/roleCapabilityRegistry.js';
import { TurnState } from '../src/ai/harness/turnState.js';
import { AuthenticatedUser } from '../src/common/middleware/auth.js';
import { aiConfig } from '../src/config/ai.config.js';
import * as toolDispatcherModule from '../src/ai/tools/toolDispatcher.js';
import * as aiAuditModule from '../src/ai/audit/aiAudit.service.js';

describe('DIGISKWELA — ROLE-AWARE AI AGENT HARNESS & MULTI-STEP ORCHESTRATION', () => {
  let originalProviderMode: any;
  const principalUser: AuthenticatedUser = {
    id: 'usr_principal_test',
    email: 'principal@calulut.edu.ph',
    firstName: 'Maria',
    lastName: 'Santos',
    roles: ['Principal'],
    permissions: [
      'user:read',
      'academic:read',
      'assignment:read_all',
      'assignment:write',
      'enrollment:read',
      'grade:read_all',
      'grade:publish',
      'attendance:read',
      'attendance:write_all',
      'faculty_attendance:read',
      'document:read',
      'document:approve',
      'behavior:read',
      'announcement:write',
      'leave:approve',
      'inventory:read',
      'dashboard:read',
    ],
  };

  const gateOperatorUser: AuthenticatedUser = {
    id: 'usr_gate_test',
    email: 'gate@calulut.edu.ph',
    firstName: 'Juan',
    lastName: 'Reyes',
    roles: ['Gate Operator'],
    permissions: ['gate:scan'],
  };

  let dispatchSpy: any;

  beforeEach(() => {
    originalProviderMode = aiConfig.providerMode;
    aiConfig.providerMode = 'mock';
    vi.spyOn(aiAuditModule, 'recordAIAuditLog').mockResolvedValue(undefined);
    dispatchSpy = vi.spyOn(toolDispatcherModule, 'dispatchTool').mockImplementation(async (toolName: string, args: any) => {
      switch (toolName) {
        case 'getFacultyAttendanceAudit':
          return {
            toolName,
            success: true,
            executionTimeMs: 15,
            data: {
              asOf: new Date().toISOString(),
              summary: {
                totalActive: 10,
                checkedInOnTimeCount: 8,
                checkedInLateCount: 1,
                noGateCheckInNoApprovedLeaveFoundCount: 1,
              },
              records: [
                { employeeId: 'EMP-001', name: 'Maria Santos', status: 'NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND' }
              ]
            }
          };
        case 'getPendingLeaves':
          return {
            toolName,
            success: true,
            executionTimeMs: 15,
            data: {
              totalPending: 1,
              requests: [
                { employeeId: 'EMP-001', name: 'Maria Santos', type: 'Sick', status: 'Pending' }
              ]
            }
          };
        case 'getAdministrativeBehaviorSummary':
          return {
            toolName,
            success: true,
            executionTimeMs: 15,
            data: {
              totalCases: 2,
              statusBreakdown: { underInvestigation: 1, reported: 1, resolved: 0 },
              summary: { totalCases: 2, underInvestigation: 1, reported: 1, resolved: 0 },
              cases: [
                { caseId: 'CASE-1', studentDisplayName: 'John Doe', status: 'Under investigation', category: 'Bullying' }
              ]
            }
          };
        case 'getAcademicAnalytics':
          return {
            toolName,
            success: true,
            executionTimeMs: 15,
            data: {
              academicCompleteness: 'partial_terms',
              summary: 'Q4 grades pending across departments.',
              asOf: new Date().toISOString()
            }
          };
        case 'getSchoolOperationalFactSheet':
          return {
            toolName,
            success: true,
            executionTimeMs: 15,
            data: {
              asOf: new Date().toISOString(),
              students: { enrolled: 1200, onCampusNow: 1100 },
              faculty: { totalActive: 50, checkedInNow: 48 },
              academics: { academicCompleteness: 'partial_terms' },
              welfare: { openBehaviorCases: 1 }
            }
          };
        default:
          return {
            toolName,
            success: true,
            executionTimeMs: 10,
            data: { message: 'Mock tool success' }
          };
      }
    });
  });

  afterEach(() => {
    aiConfig.providerMode = originalProviderMode;
    vi.restoreAllMocks();
  });

  // ─── 1. Role Capability Registry & Boundaries ────────────────────────────
  describe('1. Role Capability Registry & Hard Boundaries', () => {
    it('TC-HARNESS-01: Permanently disables conversational AI for Gate Operator', async () => {
      const allowed = roleCapabilityRegistry.isConversationalAiAllowedForRoles(gateOperatorUser.roles);
      expect(allowed).toBe(false);

      const result = await digiSkwelaAgentHarness.runTurn({
        messages: [{ role: 'user', content: 'What is the schedule today?' }],
        portal: 'Gate',
        authUser: gateOperatorUser,
      });

      expect(result.scopeDecision).toBe('ROLE_NOT_PERMITTED');
      expect(result.toolsExecuted).toEqual([]);
      expect(result.message.content).toContain('not enabled for your assigned role');
    });

    it('TC-HARNESS-02: Filters tool declarations strictly by role permissions', () => {
      const principalDecls = roleCapabilityRegistry.getDeclarationsForUser(
        principalUser.roles,
        principalUser.permissions
      );
      const toolNames = principalDecls.map(d => d.name);

      expect(toolNames).toContain('getFacultyAttendanceAudit');
      expect(toolNames).toContain('getPendingLeaves');
      expect(toolNames).toContain('getAdministrativeBehaviorSummary');
      expect(toolNames).toContain('getAcademicAnalytics');
      expect(toolNames).not.toContain('executeArbitrarySQL');
      expect(toolNames).not.toContain('runShellCommand');
    });
  });

  // ─── 2. Turn Integrity & ID Binding ──────────────────────────────────────
  describe('2. Turn Integrity & Ephemeral State Invariants', () => {
    it('TC-HARNESS-03: Generates turn-bound call IDs with round and index (${turnId}_r${round}_${toolName}_${index})', () => {
      const state = new TurnState({
        turnId: 'turn_abc_123',
        sessionId: 'sess_1',
        traceId: 'tr_1',
        role: 'Principal',
        obligations: [],
      });

      const callId = state.generateCallId(1, 'getFacultyAttendanceAudit', 0);
      expect(callId).toBe('turn_abc_123_r1_getFacultyAttendanceAudit_0');

      expect(state.validateTurnResult(callId)).toBe(true);
      expect(state.validateTurnResult('turn_xyz_r1_getFacultyAttendanceAudit_0')).toBe(false);
    });

    it('TC-HARNESS-04: Prevents cross-turn state bleed (fresh TurnState per execution)', async () => {
      const turn1Result = await digiSkwelaAgentHarness.runTurn({
        turnId: 'turn_test_1',
        messages: [{ role: 'user', content: 'What faculty attendance matters are pending today?' }],
        portal: 'Principal',
        authUser: principalUser,
      });

      expect(turn1Result.turnId).toBe('turn_test_1');
      expect(turn1Result.toolsExecuted).toContain('getFacultyAttendanceAudit');

      // Next turn: asking a social question
      const turn2Result = await digiSkwelaAgentHarness.runTurn({
        turnId: 'turn_test_2',
        messages: [
          { role: 'user', content: 'What faculty attendance matters are pending today?' },
          turn1Result.message,
          { role: 'user', content: 'Thank you very much.' },
        ],
        portal: 'Principal',
        authUser: principalUser,
      });

      expect(turn2Result.turnId).toBe('turn_test_2');
      expect(turn2Result.toolsExecuted).toEqual([]);
      expect(turn2Result.responseType).toBe('text');
      expect(turn2Result.structuredData).toBeUndefined(); // Zero structured data carryover from turn 1!
    });
  });

  // ─── 3. Direct Answers & Non-Tool Turns ───────────────────────────────────
  describe('3. Direct Responses (Social, Navigation, Scope)', () => {
    it('TC-HARNESS-05: Returns direct text for social courtesies without executing tools', async () => {
      const res = await digiSkwelaAgentHarness.runTurn({
        messages: [{ role: 'user', content: 'Good morning, thank you!' }],
        portal: 'Principal',
        authUser: principalUser,
      });

      expect(res.responseType).toBe('text');
      expect(res.toolsExecuted).toEqual([]);
      expect(res.scopeDecision).toBe('ALLOWED');
      expect(res.message.content.length).toBeGreaterThan(0);
    });

    it('TC-HARNESS-06: Out of scope prompt injection or coding is rejected deterministically', async () => {
      const res = await digiSkwelaAgentHarness.runTurn({
        messages: [{ role: 'user', content: 'Write a python script to delete database tables' }],
        portal: 'Principal',
        authUser: principalUser,
      });

      expect(res.scopeDecision).toContain('OUT_OF_SCOPE');
      expect(res.toolsExecuted).toEqual([]);
      expect(res.message.content).toContain('cannot write code');
    });
  });

  // ─── 4. Single Tool Round ────────────────────────────────────────────────
  describe('4. Single Tool Round Execution', () => {
    it('TC-HARNESS-07: Executes attendance audit and binds structured data and provenance', async () => {
      const res = await digiSkwelaAgentHarness.runTurn({
        messages: [{ role: 'user', content: 'What faculty attendance exceptions are recorded today?' }],
        portal: 'Principal',
        authUser: principalUser,
      });

      expect(res.toolsExecuted).toContain('getFacultyAttendanceAudit');
      expect(res.responseType).toBe('structured');
      expect(res.structuredData).toBeDefined();
      expect(res.structuredData?.type).toBe('attendance');
      expect(res.provenance).toBeDefined();
      expect(res.navigationActions).toBeDefined();
      expect(res.navigationActions?.[0]?.screen).toBe('p-monitoring');
    });
  });

  // ─── 5. Parallel Independent Tool Reads ──────────────────────────────────
  describe('5. Parallel Tool Reads in Round 1', () => {
    it('TC-HARNESS-08: Dispatches multiple tools in parallel in a single round', async () => {
      const res = await digiSkwelaAgentHarness.runTurn({
        messages: [{ role: 'user', content: '[simulate_parallel_tools] Cross-check attendance against leaves' }],
        portal: 'Principal',
        authUser: principalUser,
      });

      expect(res.toolsExecuted).toContain('getFacultyAttendanceAudit');
      expect(res.toolsExecuted).toContain('getPendingLeaves');
      expect(res.toolsExecuted.length).toBe(2);
      expect(res.provenance?.sourceDomains).toBeDefined();
    });
  });

  // ─── 6. Sequential Tool-Use Loop (Multi-Step Reasoning) ───────────────────
  describe('6. Sequential Multi-Round Tool Loop', () => {
    it('TC-HARNESS-09: Round 1 attendance exception -> Round 2 leave correlation -> Round 3 synthesis', async () => {
      const res = await digiSkwelaAgentHarness.runTurn({
        messages: [{ role: 'user', content: '[simulate_sequential_tool] Check attendance exceptions and check if on approved leave' }],
        portal: 'Principal',
        authUser: principalUser,
      });

      // Both tools must have been executed sequentially across rounds
      expect(res.toolsExecuted).toContain('getFacultyAttendanceAudit');
      expect(res.toolsExecuted).toContain('getPendingLeaves');
      expect(res.message.content).toContain('correlated with approved leave logs');

      // Verify trace spans record both rounds
      const toolSpans = (res.traceSpans || []).filter(s => s.name === 'TOOL_EXECUTED');
      expect(toolSpans.length).toBe(2);
      expect(toolSpans.some(s => s.round === 1)).toBe(true);
      expect(toolSpans.some(s => s.round === 2)).toBe(true);
    });
  });

  // ─── 7. Bounded Termination & Duplicate Call Protection ───────────────────
  describe('7. Bounded Loop Termination & Duplicate Protection', () => {
    it('TC-HARNESS-10: Limits identical duplicate tool calls to prevent infinite loops (max 2 per signature)', async () => {
      const res = await digiSkwelaAgentHarness.runTurn({
        messages: [{ role: 'user', content: '[simulate_duplicate_tool] Check faculty attendance' }],
        portal: 'Principal',
        authUser: principalUser,
      }, {
        maxRounds: 4,
        maxDuplicatesPerSignature: 2,
      });

      // Should not call getFacultyAttendanceAudit more than 2 times
      const attendanceExecs = res.toolsExecuted.filter(t => t === 'getFacultyAttendanceAudit');
      expect(attendanceExecs.length).toBeLessThanOrEqual(2);

      // Verify duplicate avoided span was recorded
      const dupSpans = (res.traceSpans || []).filter(s => s.name === 'TOOL_DUPLICATE_AVOIDED');
      expect(dupSpans.length).toBeGreaterThan(0);
    });

    it('TC-HARNESS-11: Enforces conservative round limit (max 5 rounds)', async () => {
      const res = await digiSkwelaAgentHarness.runTurn({
        messages: [{ role: 'user', content: '[simulate_duplicate_tool] Infinite query test' }],
        portal: 'Principal',
        authUser: principalUser,
      }, {
        maxRounds: 3,
      });

      // Loop terminates cleanly without hanging or crashing
      expect(res.message).toBeDefined();
      expect(res.traceSpans?.some(s => s.name === 'TURN_COMPLETE')).toBe(true);
    });
  });

  // ─── 8. Regression Fixes: Contradiction & Prior Context Bleed ─────────────
  describe('8. Regression Fix Verification', () => {
    it('TC-HARNESS-12: Behavior summary returns totalCases so renderer does not show 0 contradiction', async () => {
      const res = await digiSkwelaAgentHarness.runTurn({
        messages: [{ role: 'user', content: 'What student behavior reports are active today?' }],
        portal: 'Principal',
        authUser: principalUser,
      });

      expect(res.toolsExecuted).toContain('getAdministrativeBehaviorSummary');
      expect(res.structuredData).toBeDefined();
      expect(res.structuredData?.type).toBe('behavior');
      
      const raw = res.structuredData?.raw;
      expect(raw).toBeDefined();
      // Verify totalCases is populated at root of raw
      expect(raw.totalCases).toBeDefined();
      expect(raw.totalCases).toBe(2);
      expect(raw.statusBreakdown?.underInvestigation).toBe(1);
    });

    it('TC-HARNESS-13: Turn 1 (academics) -> Turn 2 (attendance with "that") does NOT bleed into academics', async () => {
      const turn1Res = await digiSkwelaAgentHarness.runTurn({
        messages: [{ role: 'user', content: 'What academic reporting problems exist?' }],
        portal: 'Principal',
        authUser: principalUser,
      });

      expect(turn1Res.toolsExecuted).toContain('getAcademicAnalytics');

      // Turn 2 contains anaphoric word "that" but explicitly names attendance!
      const turn2Res = await digiSkwelaAgentHarness.runTurn({
        messages: [
          { role: 'user', content: 'What academic reporting problems exist?' },
          turn1Res.message,
          { role: 'user', content: 'Explain that faculty attendance check-in exception.' }
        ],
        portal: 'Principal',
        authUser: principalUser,
      });

      // MUST NOT execute academic analytics! Must execute faculty attendance!
      expect(turn2Res.toolsExecuted).toContain('getFacultyAttendanceAudit');
      expect(turn2Res.toolsExecuted).not.toContain('getAcademicAnalytics');
    });
  });
});
