import { describe, it, expect, beforeEach, vi } from 'vitest';
import { digiSkwelaAgentHarness } from '../src/ai/harness/agentHarness.js';
import { AuthenticatedUser } from '../src/common/middleware/auth.js';
import * as toolDispatcherModule from '../src/ai/tools/toolDispatcher.js';
import * as aiAuditModule from '../src/ai/audit/aiAudit.service.js';
import { DigiSkwelaAIProvider } from '../src/ai/provider/aiProvider.interface.js';

describe('DIGISKWELA — MULTI-TOOL RUNTIME PROVENANCE COVERAGE (TESTS A - F)', () => {
  const teacherUser: AuthenticatedUser = {
    id: 'demo-teacher-1',
    email: 'maria.clara@sindalan.edu.ph',
    firstName: 'Maria',
    lastName: 'Clara',
    status: 'ACTIVE',
    roles: ['Teacher'],
    permissions: [
      'user:read',
      'academic:read',
      'assignment:read_own',
      'grade:read',
      'attendance:read',
    ],
  };

  const principalUser: AuthenticatedUser = {
    id: 'demo-principal-1',
    email: 'principal@sindalan.edu.ph',
    firstName: 'Juan',
    lastName: 'Luna',
    status: 'ACTIVE',
    roles: ['Principal'],
    permissions: [
      'user:read',
      'academic:read',
      'faculty_attendance:read',
      'leave:approve',
      'attendance:read',
      'dashboard:read',
    ],
  };

  beforeEach(() => {
    vi.spyOn(aiAuditModule, 'recordAIAuditLog').mockResolvedValue(undefined);
  });

  // ─── TEST A: Dynamic Teacher multi-tool provenance ─────────────────────────
  it('Test A: Dynamic Teacher multi-tool provenance contains both sources exactly once', async () => {
    vi.spyOn(toolDispatcherModule, 'dispatchTool').mockImplementation(async (toolName: string) => {
      if (toolName === 'getMyTeachingOperations') {
        return {
          toolName,
          success: true,
          executionTimeMs: 15,
          data: { assignments: [], appointmentsToday: [], unreviewedExcuseLetters: [] }
        } as any;
      }
      if (toolName === 'getMyIncompleteGrades') {
        return {
          toolName,
          success: true,
          executionTimeMs: 12,
          data: { classes: [], summary: { totalMissingScoresCount: 6 } }
        } as any;
      }
      return { toolName, success: false, executionTimeMs: 5, error: 'Unknown tool' } as any;
    });

    let round = 0;
    const mockProvider: DigiSkwelaAIProvider = {
      name: 'MockProvider',
      mode: 'mock',
      generateResponse: async () => {
        round++;
        if (round === 1) {
          return {
            finishReason: 'tool_calls',
            message: { role: 'assistant', content: '' },
            toolCalls: [
              { id: 'call_1', name: 'getMyTeachingOperations', arguments: {} },
              { id: 'call_2', name: 'getMyIncompleteGrades', arguments: {} }
            ]
          };
        }
        return {
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'You have one excuse letter pending review and 6 unrecorded scores in Grade 10 Rizal.'
          }
        };
      }
    };

    const res = await digiSkwelaAgentHarness.runTurn({
      messages: [{ role: 'user', content: 'Anything I should wrap up before the school day ends?' }],
      portal: 'Teacher',
      authUser: teacherUser,
      provider: mockProvider,
    });

    expect(res.toolsExecuted).toEqual(['getMyTeachingOperations', 'getMyIncompleteGrades']);
    expect(res.provenance).toBeDefined();
    expect(res.provenance?.sourceDomains).toEqual(['getMyTeachingOperations', 'getMyIncompleteGrades']);
  });

  // ─── TEST B: Sequential Teacher tool discovery ──────────────────────────────
  it('Test B: Sequential Teacher tool discovery across rounds preserves both sources', async () => {
    vi.spyOn(toolDispatcherModule, 'dispatchTool').mockImplementation(async (toolName: string) => {
      if (toolName === 'getMyTeachingOperations') {
        return {
          toolName,
          success: true,
          executionTimeMs: 10,
          data: { assignments: [{ sectionName: 'Rizal', sectionId: 'sec-1', subjectId: 'subj-1' }] }
        } as any;
      }
      if (toolName === 'getMyClassPerformance') {
        return {
          toolName,
          success: true,
          executionTimeMs: 10,
          data: { sectionName: 'Rizal', averageScore: 84.5 }
        } as any;
      }
      return { toolName, success: false, executionTimeMs: 5, error: 'Unknown tool' } as any;
    });

    let round = 0;
    const mockProvider: DigiSkwelaAIProvider = {
      name: 'MockProvider',
      mode: 'mock',
      generateResponse: async () => {
        round++;
        if (round === 1) {
          return {
            finishReason: 'tool_calls',
            message: { role: 'assistant', content: '' },
            toolCalls: [
              { id: 'call_r1', name: 'getMyTeachingOperations', arguments: {} }
            ]
          };
        }
        if (round === 2) {
          return {
            finishReason: 'tool_calls',
            message: { role: 'assistant', content: '' },
            toolCalls: [
              { id: 'call_r2', name: 'getMyClassPerformance', arguments: { sectionId: 'sec-1', subjectId: 'subj-1' } }
            ]
          };
        }
        return {
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'Your Rizal class has an average score of 84.5% with all assignments tracked.'
          }
        };
      }
    };

    const res = await digiSkwelaAgentHarness.runTurn({
      messages: [{ role: 'user', content: 'How is my Rizal class performing lately?' }],
      portal: 'Teacher',
      authUser: teacherUser,
      provider: mockProvider,
    });

    expect(res.toolsExecuted).toEqual(['getMyTeachingOperations', 'getMyClassPerformance']);
    expect(res.provenance).toBeDefined();
    expect(res.provenance?.sourceDomains).toEqual(['getMyTeachingOperations', 'getMyClassPerformance']);
  });

  // ─── TEST C: Failed tool exclusion ──────────────────────────────────────────
  it('Test C: Failed tool exclusion ensures unsuccessful tools are not advertised as sources', async () => {
    vi.spyOn(toolDispatcherModule, 'dispatchTool').mockImplementation(async (toolName: string) => {
      if (toolName === 'getMyTeachingOperations') {
        return {
          toolName,
          success: true,
          executionTimeMs: 15,
          data: { assignments: [], appointmentsToday: [], unreviewedExcuseLetters: [] }
        } as any;
      }
      if (toolName === 'getMyIncompleteGrades') {
        throw new Error('Database connection failed during grade retrieval');
      }
      return { toolName, success: false, executionTimeMs: 5, error: 'Unknown tool' } as any;
    });

    let round = 0;
    const mockProvider: DigiSkwelaAIProvider = {
      name: 'MockProvider',
      mode: 'mock',
      generateResponse: async () => {
        round++;
        if (round === 1) {
          return {
            finishReason: 'tool_calls',
            message: { role: 'assistant', content: '' },
            toolCalls: [
              { id: 'call_1', name: 'getMyTeachingOperations', arguments: {} },
              { id: 'call_2', name: 'getMyIncompleteGrades', arguments: {} }
            ]
          };
        }
        return {
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'Here are your teaching operations for today.'
          }
        };
      }
    };

    const res = await digiSkwelaAgentHarness.runTurn({
      messages: [{ role: 'user', content: 'What is my current status?' }],
      portal: 'Teacher',
      authUser: teacherUser,
      provider: mockProvider,
    });

    // Verified: provenance only includes the successful tool and excludes the failed tool
    expect(res.provenance?.sourceDomains).toEqual(['getMyTeachingOperations']);
    expect(res.provenance?.sourceDomains).not.toContain('getMyIncompleteGrades');
  });

  // ─── TEST D: Principal specialized provenance ───────────────────────────────
  it('Test D: Principal specialized provenance retains designed labels, card types, and navigation', async () => {
    vi.spyOn(toolDispatcherModule, 'dispatchTool').mockImplementation(async (toolName: string) => {
      if (toolName === 'getFacultyAttendanceAudit') {
        return {
          toolName,
          success: true,
          executionTimeMs: 25,
          data: {
            asOfDate: '2026-10-24',
            summary: { totalActiveFaculty: 30, completedCount: 25 },
            records: [],
            sourceDomains: ['Faculty Attendance', 'Leave Management'],
          }
        } as any;
      }
      return { toolName, success: false, executionTimeMs: 5, error: 'Unknown tool' } as any;
    });

    let round = 0;
    const mockProvider: DigiSkwelaAIProvider = {
      name: 'MockProvider',
      mode: 'mock',
      generateResponse: async () => {
        round++;
        if (round === 1) {
          return {
            finishReason: 'tool_calls',
            message: { role: 'assistant', content: '' },
            toolCalls: [
              { id: 'call_p1', name: 'getFacultyAttendanceAudit', arguments: {} }
            ]
          };
        }
        return {
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'Here is today faculty attendance audit.'
          }
        };
      }
    };

    const res = await digiSkwelaAgentHarness.runTurn({
      messages: [{ role: 'user', content: 'Show faculty attendance audit' }],
      portal: 'Principal',
      authUser: principalUser,
      provider: mockProvider,
    });

    // Provenance uses specialized labels from tool data
    expect(res.provenance?.sourceDomains).toEqual(['Faculty Attendance', 'Leave Management']);
    // Structured card type is preserved
    expect(res.structuredData).toBeDefined();
    expect(res.structuredData?.type).toBe('attendance');
    expect(res.structuredData?.provenance?.sourceDomains).toEqual(['Faculty Attendance', 'Leave Management']);
    // Navigation action preserved
    expect(res.navigationActions).toBeDefined();
    expect(res.navigationActions?.[0]?.screen).toBe('p-monitoring');
  });

  // ─── TEST E: Single-tool behavior ───────────────────────────────────────────
  it('Test E: Single-tool response exposes exactly one appropriate provenance source', async () => {
    vi.spyOn(toolDispatcherModule, 'dispatchTool').mockImplementation(async (toolName: string) => {
      if (toolName === 'getMyTeachingOperations') {
        return {
          toolName,
          success: true,
          executionTimeMs: 15,
          data: { assignments: [], appointmentsToday: [], unreviewedExcuseLetters: [] }
        } as any;
      }
      return { toolName, success: false, executionTimeMs: 5, error: 'Unknown tool' } as any;
    });

    let round = 0;
    const mockProvider: DigiSkwelaAIProvider = {
      name: 'MockProvider',
      mode: 'mock',
      generateResponse: async () => {
        round++;
        if (round === 1) {
          return {
            finishReason: 'tool_calls',
            message: { role: 'assistant', content: '' },
            toolCalls: [
              { id: 'call_1', name: 'getMyTeachingOperations', arguments: {} }
            ]
          };
        }
        return {
          finishReason: 'stop',
          message: { role: 'assistant', content: 'Operations overview ready.' }
        };
      }
    };

    const res = await digiSkwelaAgentHarness.runTurn({
      messages: [{ role: 'user', content: 'What are my operations today?' }],
      portal: 'Teacher',
      authUser: teacherUser,
      provider: mockProvider,
    });

    expect(res.provenance).toBeDefined();
    expect(res.provenance?.sourceDomains).toHaveLength(1);
    expect(res.provenance?.sourceDomains).toEqual(['getMyTeachingOperations']);
  });

  // ─── TEST F: Deduplication ──────────────────────────────────────────────────
  it('Test F: Deduplication prevents the same source from appearing multiple times across calls', async () => {
    vi.spyOn(toolDispatcherModule, 'dispatchTool').mockImplementation(async (toolName: string) => {
      if (toolName === 'getMyTeachingOperations') {
        return {
          toolName,
          success: true,
          executionTimeMs: 15,
          data: { assignments: [], appointmentsToday: [], unreviewedExcuseLetters: [] }
        } as any;
      }
      return { toolName, success: false, executionTimeMs: 5, error: 'Unknown tool' } as any;
    });

    let round = 0;
    const mockProvider: DigiSkwelaAIProvider = {
      name: 'MockProvider',
      mode: 'mock',
      generateResponse: async () => {
        round++;
        if (round === 1) {
          return {
            finishReason: 'tool_calls',
            message: { role: 'assistant', content: '' },
            toolCalls: [
              { id: 'call_1', name: 'getMyTeachingOperations', arguments: {} }
            ]
          };
        }
        if (round === 2) {
          return {
            finishReason: 'tool_calls',
            message: { role: 'assistant', content: '' },
            toolCalls: [
              { id: 'call_2', name: 'getMyTeachingOperations', arguments: {} }
            ]
          };
        }
        return {
          finishReason: 'stop',
          message: { role: 'assistant', content: 'Final checked answer.' }
        };
      }
    };

    const res = await digiSkwelaAgentHarness.runTurn({
      messages: [{ role: 'user', content: 'Double-check my operations' }],
      portal: 'Teacher',
      authUser: teacherUser,
      provider: mockProvider,
    });

    expect(res.toolsExecuted).toEqual(['getMyTeachingOperations', 'getMyTeachingOperations']);
    expect(res.provenance?.sourceDomains).toEqual(['getMyTeachingOperations']);
    expect(res.provenance?.sourceDomains).toHaveLength(1);
  });
});
