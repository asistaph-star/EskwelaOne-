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
      let narrative = 'Here is the verified operational data retrieved from authoritative school records.';
      switch (lastToolMessage.name) {
        case 'getFacultyAttendanceAudit':
          narrative = "Here is today's faculty attendance audit based on verified gate records and leave logs.";
          break;
        case 'getSchoolOperationalFactSheet':
          narrative = 'Here is the authoritative daily executive operational fact sheet for Calulut Integrated School.';
          break;
        case 'getPendingLeaves':
          narrative = 'Here are the active pending leave applications requiring administrative review.';
          break;
        case 'getUpcomingEvents':
          narrative = 'Here are the upcoming school calendar events and schedules for the active period.';
          break;
        case 'getAdministrativeBehaviorSummary':
          narrative = 'Here is the administrative summary of student behavior incidents and disciplinary cases.';
          break;
        case 'getAcademicAnalytics':
          narrative = 'Here are the authorized academic performance analytics for Calulut Integrated School.';
          break;
        case 'generatePrincipalMeetingBrief':
          narrative = 'Here is your executive meeting brief compiled from authoritative school records.';
          break;
        case 'generateWeeklyOperationsReport':
          narrative = 'Here is the weekly operations summary report for Calulut Integrated School.';
          break;
      }

      return {
        message: {
          role: 'assistant',
          content: narrative
        },
        finishReason: 'stop',
        usage: { promptTokens: 45, completionTokens: 25, totalTokens: 70 }
      };
    }

    // 3. Tool Intent Matching & Conversational Context Resolution
    const availableTools = request.tools || [];
    const previousMessages = request.messages.slice(0, -1);

    // Check for conversational pronouns / follow-up references
    const isFollowUpQuery = /\b(them|which of them|who among them|who of them|any of them|those|what about them)\b/i.test(content);

    if (isFollowUpQuery) {
      // Inspect recent conversation turns for antecedent
      const hadFacultyAttendanceContext = previousMessages.some(m => {
        const c = (m.content || '').toLowerCase();
        return c.includes('faculty') || c.includes('attendance') || c.includes('check-in') || m.name === 'getFacultyAttendanceAudit';
      });

      if (hadFacultyAttendanceContext) {
        const attendanceTool = availableTools.find(t => t.name === 'getFacultyAttendanceAudit');
        if (attendanceTool) {
          let statusFilter: 'ALL' | 'COMPLETED' | 'TIME_OUT_PENDING' | 'ON_APPROVED_LEAVE' | 'NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND' = 'ALL';

          if (content.includes('leave') || content.includes('approved')) {
            statusFilter = 'ON_APPROVED_LEAVE';
          } else if (content.includes('no check-in') || content.includes('no gate') || content.includes('missing')) {
            statusFilter = 'NO_GATE_CHECK_IN_NO_APPROVED_LEAVE_FOUND';
          } else if (content.includes('time-out') || content.includes('time out') || content.includes('pending')) {
            statusFilter = 'TIME_OUT_PENDING';
          } else if (content.includes('completed')) {
            statusFilter = 'COMPLETED';
          }

          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [{
              id: 'call_mock_att_followup',
              name: attendanceTool.name,
              arguments: { statusFilter }
            }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 45, completionTokens: 15, totalTokens: 60 }
          };
        }
      }

      // Ambiguous reference without clear antecedent: Ask for clarification honestly rather than guessing
      return {
        message: {
          role: 'assistant',
          content: 'Could you please clarify who you are referring to? For example, are you asking about faculty attendance or staff leave applications?'
        },
        finishReason: 'stop',
        usage: { promptTokens: 25, completionTokens: 25, totalTokens: 50 }
      };
    }

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
      if (content.includes('fact sheet') || content.includes('pulse') || content.includes('operations') || content.includes('how many students') || content.includes('attention')) {
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
      if (content.includes('academic') || content.includes('grades') || content.includes('performance') || content.includes('pass rate') || content.includes('completeness')) {
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
      if (content.includes('event') || content.includes('calendar') || content.includes('schedule') || content.includes('coming up') || content.includes('this week')) {
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

      // Check for meeting brief intent
      if (content.includes('brief') || content.includes('meeting') || content.includes('prepare')) {
        const briefTool = availableTools.find(t => t.name === 'generatePrincipalMeetingBrief');
        if (briefTool) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [{ id: 'call_mock_brief_1', name: briefTool.name, arguments: { meetingType: 'GENERAL' } }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
          };
        }
      }

      // Check for weekly operations report intent
      if (content.includes('weekly') || content.includes('operations report') || content.includes('weekly report')) {
        const reportTool = availableTools.find(t => t.name === 'generateWeeklyOperationsReport');
        if (reportTool) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [{ id: 'call_mock_wrep_1', name: reportTool.name, arguments: {} }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
          };
        }
      }
    }

    // 4. Social / Courtesy Messages (Brief, natural responses without generic feature menus)
    if (/\b(thank\s*you|thanks|many\s*thanks|thank\s*u|salamat)\b/i.test(content)) {
      return {
        message: {
          role: 'assistant',
          content: 'You’re welcome.'
        },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 }
      };
    }

    if (/^(hello|hi|hey|good\s*(morning|afternoon|evening))\b/i.test(content)) {
      return {
        message: {
          role: 'assistant',
          content: 'Good day. How may I assist you with school operations?'
        },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 12, totalTokens: 22 }
      };
    }

    // 5. Default Informational Response
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
