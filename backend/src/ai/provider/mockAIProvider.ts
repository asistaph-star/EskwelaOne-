import { 
  DigiSkwelaAIProvider, 
  AICompletionRequest, 
  AICompletionResponse, 
  AIProviderError,
  AIToolCall
} from './aiProvider.interface.js';
import { SCHOOL_NAME } from '../../config/ai.config.js';

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
      // Duplicate Loop simulation trigger: model stubbornly keeps requesting the same tool
      if (content.includes('[simulate_duplicate_tool]')) {
        return {
          message: { role: 'assistant', content: '' },
          toolCalls: [{ id: 'call_mock_dup_1', name: 'getFacultyAttendanceAudit', arguments: {} }],
          finishReason: 'tool_calls',
          usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 }
        };
      }

      // Sequential reasoning trigger: if attendance tool just ran and query requests leave correlation
      if (
        (content.includes('[simulate_sequential_tool]') || content.includes('investigate leave status') || content.includes('check if on approved leave')) &&
        lastToolMessage.name === 'getFacultyAttendanceAudit'
      ) {
        const hasLeavesRun = request.messages.some(m => m.role === 'tool' && m.name === 'getPendingLeaves');
        const leaveTool = (request.tools || []).find(t => t.name === 'getPendingLeaves');
        if (!hasLeavesRun && leaveTool) {
          return {
            message: {
              role: 'assistant',
              content: 'Observed faculty check-in exception. Requesting pending leave records to correlate.'
            },
            toolCalls: [{
              id: 'call_mock_seq_leaves',
              name: leaveTool.name,
              arguments: { limit: 10 }
            }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 55, completionTokens: 20, totalTokens: 75 }
          };
        }
      }

      let narrative = 'Here is the verified operational data retrieved from authoritative school records.';
      switch (lastToolMessage.name) {
        case 'getFacultyAttendanceAudit':
          if (content.includes('cross-check') || content.includes('leaves') || content.includes('against')) {
            narrative = "Here is today's faculty attendance audit correlated with approved leave logs. Gate check-ins have been cross-checked against authorized leave records to identify operational coverage status.";
          } else {
            narrative = "Here is today's faculty attendance audit based on verified gate records and leave logs.";
          }
          break;
        case 'getSchoolOperationalFactSheet':
          if (content.includes('review') || content.includes('attention') || content.includes('unresolved') || content.includes('incomplete') || content.includes('exception')) {
            narrative = "Here are the operational items requiring administrative review today: 1 faculty leave application is pending approval, faculty attendance records have been cross-checked against approved leaves, 1 student behavior incident is currently active, and annual academic analytics remain partial pending complete term grade submissions.";
          } else {
            narrative = `Here is the authoritative daily executive operational fact sheet for ${SCHOOL_NAME}.`;
          }
          break;
        case 'getPendingLeaves':
          if (request.messages.some(m => m.role === 'tool' && m.name === 'getFacultyAttendanceAudit')) {
            narrative = "Here is today's faculty attendance audit correlated with approved leave logs. Gate check-ins have been cross-checked against authorized leave records to identify operational coverage status.";
          } else if (content.includes('how many') || content.includes('count')) {
            narrative = 'There is currently 1 faculty leave application pending administrative review in Leave Management.';
          } else if (content.includes('draft') || content.includes('communication') || content.includes('memo')) {
            narrative = 'Here is a draft communication regarding faculty leave coverage for your review:\n\nSubject: Administrative Notice: Faculty Leave Coordination and Class Coverage\n\nDear Faculty and Department Heads,\n\nPlease ensure all upcoming leave requests are submitted with advance notice to allow adequate classroom substitution and schedule adjustments.\n\nThank you for your cooperation in maintaining instructional continuity.\n\n(Draft for Principal review · Read-only AI assistance)';
          } else {
            narrative = 'Here are the active pending leave applications requiring administrative review.';
          }
          break;
        case 'getUpcomingEvents':
          narrative = 'Here are the upcoming school calendar events and schedules for the active period.';
          break;
        case 'getAdministrativeBehaviorSummary':
          narrative = 'Here is the administrative summary of student behavior incidents and disciplinary cases.';
          break;
        case 'getAcademicAnalytics':
          if (content.includes('why') || content.includes('prevent') || content.includes('incomplete') || content.includes('completeness')) {
            narrative = 'Annual academic analytics and school-wide pass rates require complete verified grade submissions across all four quarters (T1, T2, T3, T4). Because grade submissions are currently recorded for partial terms only, annual promotion metrics remain pending until all four quarters are completed and finalized.';
          } else if (content.includes('draft') || content.includes('reminder') || content.includes('communication') || content.includes('memo')) {
            narrative = 'Here is a draft reminder for faculty regarding grade submissions for your review:\n\nSubject: Reminder: Submission and Finalization of Term Grades\n\nDear Faculty Members,\n\nPlease be reminded to review and finalize all pending student grade submissions for the current term in your Gradebook. Complete grade entries across all subjects are required to enable school-wide academic evaluation and student records processing.\n\nPlease ensure all submissions are completed before the scheduled administrative deadline. Thank you for your continued dedication to academic excellence.\n\n(Draft for Principal review · Read-only AI assistance)';
          } else {
            narrative = `Here are the authorized academic performance analytics for ${SCHOOL_NAME}.`;
          }
          break;
        case 'generatePrincipalMeetingBrief':
          narrative = 'Here is your executive meeting brief compiled from authoritative school records.';
          break;
        case 'generateWeeklyOperationsReport':
          narrative = `Here is the weekly operations summary report for ${SCHOOL_NAME}.`;
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

    // 3. System Help & Contextual Navigation Guidance (Prioritize before tool execution)
    if (/\b(where\s*(can|do)\s*i|how\s*do\s*i|find\s*or\s*understand|system\s*help|how\s*can\s*i)\b/i.test(content)) {
      let helpText = 'Which DigiSkwela feature do you need help with?';

      if (content.includes('attendance') || content.includes('gate') || content.includes('check-in')) {
        helpText = 'You can review faculty attendance in Gate Attendance Monitoring. You can also view registered profiles and schedules in Teacher Management.';
      } else if (content.includes('leave') || content.includes('vacation')) {
        helpText = 'You can review, approve, or deny pending faculty leave applications in the Leave Management module under Administration.';
      } else if (content.includes('behavior') || content.includes('discipline') || content.includes('incident')) {
        helpText = 'You can view logged student disciplinary incidents and behavioral cases in the Behavioral Reports module under Operations.';
      } else if (content.includes('academic') || content.includes('grade') || content.includes('completeness')) {
        helpText = 'You can inspect grading progress and quarterly performance summaries in the Academic Analytics module under Administration.';
      }

      return {
        message: {
          role: 'assistant',
          content: helpText
        },
        finishReason: 'stop',
        usage: { promptTokens: 25, completionTokens: 35, totalTokens: 60 }
      };
    }

    if (availableTools.length > 0) {
      // 0. Parallel multi-tool dispatch trigger
      if (content.includes('[simulate_parallel_tools]') || (content.includes('cross-check') && content.includes('leaves') && content.includes('attendance'))) {
        const attendanceTool = availableTools.find(t => t.name === 'getFacultyAttendanceAudit');
        const leaveTool = availableTools.find(t => t.name === 'getPendingLeaves');
        if (attendanceTool && leaveTool) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [
              { id: 'call_mock_att_par_1', name: attendanceTool.name, arguments: {} },
              { id: 'call_mock_leave_par_2', name: leaveTool.name, arguments: { limit: 10 } }
            ],
            finishReason: 'tool_calls',
            usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 }
          };
        }
      }

      // 0.1 Sweep intent ("what needs my review/attention today")
      if (content.includes('what needs my review') || content.includes('what needs my attention') || content.includes('exceptions require my attention') || content.includes('what needs review') || content.includes('what needs attention')) {
        const sweepTools: AIToolCall[] = [];
        const att = availableTools.find(t => t.name === 'getFacultyAttendanceAudit');
        const leave = availableTools.find(t => t.name === 'getPendingLeaves');
        const beh = availableTools.find(t => t.name === 'getAdministrativeBehaviorSummary');
        const facts = availableTools.find(t => t.name === 'getSchoolOperationalFactSheet');
        if (att) sweepTools.push({ id: 'call_mock_sw_1', name: att.name, arguments: {} });
        if (leave) sweepTools.push({ id: 'call_mock_sw_2', name: leave.name, arguments: { limit: 10 } });
        if (beh) sweepTools.push({ id: 'call_mock_sw_3', name: beh.name, arguments: { limit: 10 } });
        if (facts) sweepTools.push({ id: 'call_mock_sw_4', name: facts.name, arguments: {} });
        if (sweepTools.length > 0) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: sweepTools,
            finishReason: 'tool_calls',
            usage: { promptTokens: 60, completionTokens: 40, totalTokens: 100 }
          };
        }
      }

      // 0.2 Multi-domain / composite multi-question dispatch
      const hasAtt = content.includes('faculty') || content.includes('attendance') || content.includes('check-in') || content.includes('gate');
      const hasLeave = content.includes('leave') || content.includes('vacation');
      const hasBeh = content.includes('behavior') || content.includes('discipline') || content.includes('incident');
      const hasAcad = content.includes('academic') || content.includes('grade') || content.includes('pass rate') || content.includes('completeness');
      const hasEvent = content.includes('event') || content.includes('calendar');

      const domainCount = (hasAtt ? 1 : 0) + (hasLeave ? 1 : 0) + (hasBeh ? 1 : 0) + (hasAcad ? 1 : 0) + (hasEvent ? 1 : 0);
      if (domainCount >= 2 && !content.includes('[simulate_sequential_tool]')) {
        const matchedTools: AIToolCall[] = [];
        if (hasAtt) {
          const t = availableTools.find(x => x.name === 'getFacultyAttendanceAudit');
          if (t) matchedTools.push({ id: 'call_mock_multi_att', name: t.name, arguments: {} });
        }
        if (hasLeave) {
          const t = availableTools.find(x => x.name === 'getPendingLeaves');
          if (t) matchedTools.push({ id: 'call_mock_multi_leave', name: t.name, arguments: { limit: 10 } });
        }
        if (hasBeh) {
          const t = availableTools.find(x => x.name === 'getAdministrativeBehaviorSummary');
          if (t) matchedTools.push({ id: 'call_mock_multi_beh', name: t.name, arguments: { limit: 10 } });
        }
        if (hasAcad) {
          const t = availableTools.find(x => x.name === 'getAcademicAnalytics');
          if (t) matchedTools.push({ id: 'call_mock_multi_acad', name: t.name, arguments: {} });
        }
        if (hasEvent) {
          const t = availableTools.find(x => x.name === 'getUpcomingEvents');
          if (t) matchedTools.push({ id: 'call_mock_multi_evt', name: t.name, arguments: {} });
        }
        if (matchedTools.length >= 2) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: matchedTools,
            finishReason: 'tool_calls',
            usage: { promptTokens: 60, completionTokens: 35, totalTokens: 95 }
          };
        }
      }

      // 1. Meeting brief intent (check before general 'faculty' keyword)
      if (content.includes('meeting') || content.includes('brief')) {
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

      // 2. Draft communication / memo intent
      if (content.includes('draft') || content.includes('communication') || content.includes('memo') || content.includes('reminder')) {
        const academicTool = availableTools.find(t => t.name === 'getAcademicAnalytics');
        if (academicTool) {
          return {
            message: { role: 'assistant', content: '' },
            toolCalls: [{ id: 'call_mock_draft_1', name: academicTool.name, arguments: {} }],
            finishReason: 'tool_calls',
            usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
          };
        }
      }

      // 3. Weekly operations report intent
      if (
        content.includes('weekly') || 
        content.includes('operations report') || 
        content.includes('weekly report') || 
        (content.includes('this week') && content.includes('operation')) ||
        content.includes('school operations')
      ) {
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

      // 4. Academic analytics intent (including explain-why completeness)
      if (content.includes('academic') || content.includes('grade') || content.includes('performance') || content.includes('pass rate') || content.includes('completeness') || content.includes('preventing') || content.includes('promotion rate') || content.includes('why')) {
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

      // 5. Attendance intent (including cross-checking against approved leaves)
      if (content.includes('attendance') || content.includes('check-in') || content.includes('gate records') || content.includes('cross-check') || content.includes('faculty')) {
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

      // 6. Leaves intent
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

      // 7. Events intent
      if (content.includes('event') || content.includes('calendar') || content.includes('schedule') || content.includes('coming up') || (content.includes('this week') && !content.includes('operation'))) {
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

      // 8. Behavior intent
      if (content.includes('behavior') || content.includes('discipline') || content.includes('incident')) {
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

      // 9. Fact sheet / operations / needs review / exceptions intent
      if (content.includes('fact sheet') || content.includes('pulse') || content.includes('operations') || content.includes('how many students') || content.includes('attention') || content.includes('review') || content.includes('unresolved') || content.includes('incomplete') || content.includes('exception')) {
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
