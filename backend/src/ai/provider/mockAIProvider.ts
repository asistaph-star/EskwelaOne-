import { 
  DigiSkwelaAIProvider, 
  AICompletionRequest, 
  AICompletionResponse, 
  AIProviderError 
} from './aiProvider.interface.js';

/**
 * MockAIProvider — Deterministic, Local Development & Architecture Test Adapter
 * 
 * Invariants:
 * - ZERO external network calls
 * - ZERO API keys required
 * - ZERO financial cost
 * - Fully deterministic behavior for automated test suites
 * - Tests tool dispatching, RBAC, scope validation, and audit logging
 */
export class MockAIProvider implements DigiSkwelaAIProvider {
  public readonly name = 'MockAIProvider';
  public readonly mode = 'mock' as const;

  async generateResponse(request: AICompletionRequest): Promise<AICompletionResponse> {
    const lastUserMessage = [...request.messages].reverse().find(m => m.role === 'user');
    const content = (lastUserMessage?.content || '').trim().toLowerCase();

    // 1. Simulation Triggers for Test Coverage
    if (content.includes('[simulate_rate_limit]')) {
      throw new AIProviderError('RATE_LIMITED', 'Simulated Groq Free Tier rate limit exceeded.', true);
    }
    if (content.includes('[simulate_quota_exhausted]')) {
      throw new AIProviderError('FREE_QUOTA_EXHAUSTED', 'Simulated free monthly quota exhausted.', false);
    }
    if (content.includes('[simulate_provider_unavailable]')) {
      throw new AIProviderError('PROVIDER_UNAVAILABLE', 'Simulated upstream provider downtime.', true);
    }
    if (content.includes('[simulate_timeout]')) {
      throw new AIProviderError('PROVIDER_TIMEOUT', 'Simulated upstream response timeout.', true);
    }
    if (content.includes('[simulate_invalid_response]')) {
      throw new AIProviderError('INVALID_PROVIDER_RESPONSE', 'Simulated malformed model response.', false);
    }

    // 2. Check if a tool output was just returned
    const lastToolMessage = [...request.messages].reverse().find(m => m.role === 'tool');
    if (lastToolMessage) {
      try {
        const parsed = JSON.parse(lastToolMessage.content);
        return {
          message: {
            role: 'assistant',
            content: `Verified DigiSkwela Data Grounding:\n${JSON.stringify(parsed, null, 2)}`
          },
          finishReason: 'stop',
          usage: { promptTokens: 45, completionTokens: 30, totalTokens: 75 }
        };
      } catch {
        return {
          message: {
            role: 'assistant',
            content: `Verified DigiSkwela Data Grounding:\n${lastToolMessage.content}`
          },
          finishReason: 'stop',
          usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 }
        };
      }
    }

    // 3. Tool Intent Matching (Deterministic evaluation testing)
    const availableTools = request.tools || [];

    if (availableTools.length > 0) {
      // Check for attendance intent
      if (content.includes('attendance') || content.includes('check-in') || content.includes('faculty')) {
        const attendanceTool = availableTools.find(t => t.name === 'getFacultyAttendanceAudit');
        if (attendanceTool) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [{ id: 'call_mock_att_1', name: attendanceTool.name, arguments: {} }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
          };
        }
      }

      // Check for fact sheet / operations intent
      if (content.includes('fact sheet') || content.includes('pulse') || content.includes('operations') || content.includes('how many students')) {
        const factSheetTool = availableTools.find(t => t.name === 'getSchoolOperationalFactSheet');
        if (factSheetTool) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [{ id: 'call_mock_facts_1', name: factSheetTool.name, arguments: {} }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
          };
        }
      }

      // Check for leaves intent
      if (content.includes('leave') || content.includes('vacation') || content.includes('pending')) {
        const leaveTool = availableTools.find(t => t.name === 'getPendingLeaves');
        if (leaveTool) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [{ id: 'call_mock_leave_1', name: leaveTool.name, arguments: {} }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
          };
        }
      }

      // Check for academic analytics intent
      if (content.includes('academic') || content.includes('grades') || content.includes('performance') || content.includes('pass rate')) {
        const academicTool = availableTools.find(t => t.name === 'getAcademicAnalytics');
        if (academicTool) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [{ id: 'call_mock_acad_1', name: academicTool.name, arguments: {} }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
          };
        }
      }

      // Check for events intent
      if (content.includes('event') || content.includes('calendar') || content.includes('schedule')) {
        const eventTool = availableTools.find(t => t.name === 'getUpcomingEvents');
        if (eventTool) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [{ id: 'call_mock_event_1', name: eventTool.name, arguments: {} }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
          };
        }
      }

      // Check for behavior intent
      if (content.includes('behavior') || content.includes('discipline') || content.includes('incidents')) {
        const behaviorTool = availableTools.find(t => t.name === 'getAdministrativeBehaviorSummary');
        if (behaviorTool) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [{ id: 'call_mock_behav_1', name: behaviorTool.name, arguments: {} }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
          };
        }
      }
    }

    // 4. Default Informational Response
    return {
      message: {
        role: 'assistant',
        content: 'I am the DigiSkwela Assistant in deterministic testing mode. I can help query authorized school operations, faculty attendance, pending leaves, and academic analytics.'
      },
      finishReason: 'stop',
      usage: { promptTokens: 25, completionTokens: 25, totalTokens: 50 }
    };
  }
}
