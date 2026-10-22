import { getAIProvider } from './provider/aiProvider.factory.js';
import { AIMessage, AIProviderError } from './provider/aiProvider.interface.js';
import { evaluateScope } from './security/scopeGuard.js';
import { toolRegistry } from './tools/toolRegistry.js';
import { dispatchTool } from './tools/toolDispatcher.js';
import { recordAIAuditLog } from './audit/aiAudit.service.js';
import { AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { generateId } from '../common/utils/uuid.js';
import { aiConfig } from '../config/ai.config.js';
import { normalizeAssistantText } from './utils/normalizeResponseText.js';
import { buildRequestPlan } from './orchestration/requestPlanner.js';
import { executePlan } from './orchestration/planExecutor.js';
import { aggregateFacts } from './orchestration/aggregator.js';
import { buildSynthesisDirective } from './orchestration/synthesisDirective.js';
import { validateAndRemedyCompleteness } from './orchestration/completenessValidator.js';

export interface ProcessChatRequestInput {
  messages: AIMessage[];
  portal: string;
}

export interface NormalizedProvenance {
  sourceDomains: string[];
  asOf?: string;
}

export interface NormalizedNavigationAction {
  label: string;
  screen: string;
  description?: string;
}

export interface NormalizedStructuredData {
  type: 'fact_sheet' | 'attendance' | 'leaves' | 'events' | 'behavior' | 'academics' | 'meeting_brief' | 'weekly_report' | 'generic';
  raw: any;
  provenance?: NormalizedProvenance;
}

export interface ProcessChatResponseOutput {
  message: AIMessage;
  responseType: 'text' | 'structured';
  structuredData?: NormalizedStructuredData;
  provenance?: NormalizedProvenance;
  navigationActions?: NormalizedNavigationAction[];
  traceId: string;
  scopeDecision: string;
  toolsExecuted: string[];
  sessionId?: string;
}

function mapToolToNormalizedOutput(toolName: string, data: any): {
  structuredData: NormalizedStructuredData;
  provenance?: NormalizedProvenance;
  navigationActions?: NormalizedNavigationAction[];
} {
  let type: NormalizedStructuredData['type'] = 'generic';
  let navAction: NormalizedNavigationAction | undefined = undefined;

  switch (toolName) {
    case 'getFacultyAttendanceAudit':
      type = 'attendance';
      navAction = {
        label: 'Open Gate Attendance Monitoring',
        screen: 'p-monitoring',
        description: 'Open Gate Attendance Monitoring tab',
      };
      break;
    case 'getSchoolOperationalFactSheet':
      type = 'fact_sheet';
      navAction = {
        label: 'Open Dashboard Overview',
        screen: 'p-dashboard',
        description: 'Open Dashboard Overview',
      };
      break;
    case 'getPendingLeaves':
      type = 'leaves';
      navAction = {
        label: 'Open Leave Management',
        screen: 'p-leaves',
        description: 'Open Leave Management tab',
      };
      break;
    case 'getUpcomingEvents':
      type = 'events';
      navAction = {
        label: 'Open School Events',
        screen: 'p-events',
        description: 'Open School Events tab',
      };
      break;
    case 'getAdministrativeBehaviorSummary':
      type = 'behavior';
      navAction = {
        label: 'View Behavioral Reports',
        screen: 'p-behavior',
        description: 'Open Behavioral Reports tab',
      };
      break;
    case 'getAcademicAnalytics':
      type = 'academics';
      navAction = {
        label: 'Open Academic Analytics',
        screen: 'p-analytics',
        description: 'Open Academic Analytics tab',
      };
      break;
    case 'generatePrincipalMeetingBrief':
      type = 'meeting_brief';
      navAction = {
        label: 'Open Dashboard Overview',
        screen: 'p-dashboard',
        description: 'Open Dashboard Overview',
      };
      break;
    case 'generateWeeklyOperationsReport':
      type = 'weekly_report';
      navAction = {
        label: 'Open Dashboard Overview',
        screen: 'p-dashboard',
        description: 'Open Dashboard Overview',
      };
      break;
  }

  let provenance: NormalizedProvenance | undefined = undefined;
  if (data?.provenance && Array.isArray(data.provenance.sourceDomains)) {
    provenance = {
      sourceDomains: data.provenance.sourceDomains,
      asOf: data.provenance.asOf || data.provenance.generatedAt || data.asOf,
    };
  } else if (Array.isArray(data?.sourceDomains)) {
    provenance = {
      sourceDomains: data.sourceDomains,
      asOf: data.asOf || data.generatedAt,
    };
  }

  return {
    structuredData: {
      type,
      raw: data,
      provenance,
    },
    provenance,
    navigationActions: navAction ? [navAction] : undefined,
  };
}

export const AIService = {
  /**
   * Main AI Orchestration Pipeline
   */
  async processChat(
    input: ProcessChatRequestInput,
    authUser: AuthenticatedUser,
    correlationId?: string
  ): Promise<ProcessChatResponseOutput> {
    const startTime = Date.now();
    const traceId = generateId();
    const userRole = authUser.roles[0] || 'Unknown';
    const portal = input.portal || 'Unknown';

    // 1. Validate Input Messages and Turn Limits
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      throw new AppError(400, 'BAD_REQUEST', 'Conversation messages must be a non-empty array.');
    }

    // Enforce configurable turn window limit
    const messages = input.messages.slice(-aiConfig.limits.maxTurns);
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const promptText = lastUserMsg?.content || '';

    // Enforce prompt length boundary
    if (promptText.length > aiConfig.limits.maxPromptLength) {
      throw new AppError(
        400, 
        'PROMPT_TOO_LONG', 
        `Prompt exceeds maximum allowed length of ${aiConfig.limits.maxPromptLength} characters.`
      );
    }

    // 2. Server-Side Scope Guard Validation
    const scopeResult = evaluateScope(promptText);
    if (!scopeResult.allowed) {
      // Record rejected scope decision in audit log (zero tool execution)
      await recordAIAuditLog({
        traceId,
        userId: authUser.id,
        role: userRole,
        portal,
        scopeDecision: 'OUT_OF_SCOPE',
        toolsRequested: [],
        toolsExecuted: [],
        status: 'SECURITY_BLOCKED',
        providerMode: aiConfig.providerMode,
        latencyMs: Date.now() - startTime,
      });

      return {
        message: {
          role: 'assistant',
          content: scopeResult.userMessage || 'Request is out of scope for DigiSkwela operations.'
        },
        responseType: 'text',
        traceId,
        scopeDecision: scopeResult.reason || 'OUT_OF_SCOPE',
        toolsExecuted: []
      };
    }

    // 3. Resolve Role-Specific Tool Allowlist (Server-Derived Identity)
    const authorizedDeclarations = toolRegistry.getDeclarationsForUser(
      authUser.roles, 
      authUser.permissions
    );
    const allowedToolNamesSet = new Set(authorizedDeclarations.map(t => t.name));

    const provider = getAIProvider();
    const toolsRequested: string[] = [];
    const toolsExecuted: string[] = [];
    let tokenUsage: any = null;

    try {
      // 3.1 Principal Intelligent Orchestration Pipeline
      const plan = buildRequestPlan(messages, userRole, portal, allowedToolNamesSet);

      if (plan) {
        if (plan.intent === 'OUT_OF_SCOPE') {
          await recordAIAuditLog({
            traceId,
            userId: authUser.id,
            role: userRole,
            portal,
            scopeDecision: 'OUT_OF_SCOPE',
            toolsRequested: [],
            toolsExecuted: [],
            status: 'SUCCESS',
            providerMode: provider.mode,
            latencyMs: Date.now() - startTime,
            tokenUsage: {
              requestedMode: aiConfig.providerMode,
              primaryProvider: provider.name,
              finalProvider: provider.name,
              failoverOccurred: false,
              failoverReason: null,
              model: provider.model || null,
            }
          });

          return {
            message: {
              role: 'assistant',
              content: plan.directResponseContent || 'Request is out of scope for DigiSkwela operations.'
            },
            responseType: 'text',
            traceId,
            scopeDecision: 'OUT_OF_SCOPE',
            toolsExecuted: []
          };
        }

        if (plan.intent === 'SOCIAL') {
          await recordAIAuditLog({
            traceId,
            userId: authUser.id,
            role: userRole,
            portal,
            scopeDecision: 'ALLOWED',
            toolsRequested: [],
            toolsExecuted: [],
            status: 'SUCCESS',
            providerMode: provider.mode,
            latencyMs: Date.now() - startTime,
            tokenUsage: {
              requestedMode: aiConfig.providerMode,
              primaryProvider: provider.name,
              finalProvider: provider.name,
              failoverOccurred: false,
              failoverReason: null,
              model: provider.model || null,
            }
          });

          return {
            message: {
              role: 'assistant',
              content: plan.directResponseContent || 'You’re welcome.'
            },
            responseType: 'text',
            traceId,
            scopeDecision: 'ALLOWED',
            toolsExecuted: []
          };
        }

        if (plan.intent === 'NAVIGATION') {
          await recordAIAuditLog({
            traceId,
            userId: authUser.id,
            role: userRole,
            portal,
            scopeDecision: 'ALLOWED',
            toolsRequested: [],
            toolsExecuted: [],
            status: 'SUCCESS',
            providerMode: provider.mode,
            latencyMs: Date.now() - startTime,
            tokenUsage: {
              requestedMode: aiConfig.providerMode,
              primaryProvider: provider.name,
              finalProvider: provider.name,
              failoverOccurred: false,
              failoverReason: null,
              model: provider.model || null,
            }
          });

          return {
            message: {
              role: 'assistant',
              content: plan.directResponseContent || 'Which DigiSkwela feature do you need help with?'
            },
            responseType: 'text',
            navigationActions: plan.navigationAction ? [plan.navigationAction] : undefined,
            traceId,
            scopeDecision: 'ALLOWED',
            toolsExecuted: []
          };
        }

        if (plan.intent === 'CLARIFICATION') {
          await recordAIAuditLog({
            traceId,
            userId: authUser.id,
            role: userRole,
            portal,
            scopeDecision: 'ALLOWED',
            toolsRequested: [],
            toolsExecuted: [],
            status: 'SUCCESS',
            providerMode: provider.mode,
            latencyMs: Date.now() - startTime,
            tokenUsage: {
              requestedMode: aiConfig.providerMode,
              primaryProvider: provider.name,
              finalProvider: provider.name,
              failoverOccurred: false,
              failoverReason: null,
              model: provider.model || null,
            }
          });

          return {
            message: {
              role: 'assistant',
              content: plan.clarificationMessage || 'Could you please clarify who you are referring to?'
            },
            responseType: 'text',
            traceId,
            scopeDecision: 'ALLOWED',
            toolsExecuted: []
          };
        }

        if (plan.toolsToExecute.length > 0) {
          const executionOutput = await executePlan(
            plan.toolsToExecute,
            authUser,
            correlationId,
            portal,
            allowedToolNamesSet
          );

          toolsRequested.push(...executionOutput.toolsRequested);
          toolsExecuted.push(...executionOutput.toolsExecuted);

          const aggregateData = aggregateFacts(plan, executionOutput.executedResults);

          const conversationWithTools = [...messages];
          const directive = buildSynthesisDirective(plan, aggregateData);
          conversationWithTools.unshift(directive);

          conversationWithTools.push({
            role: 'assistant',
            content: '',
            toolCalls: executionOutput.deterministicToolCalls
          });

          for (const item of executionOutput.executedResults) {
            conversationWithTools.push({
              role: 'tool',
              name: item.name,
              toolCallId: item.toolCallId,
              content: item.success ? JSON.stringify(item.result) : JSON.stringify({ error: item.error || 'Execution failed' })
            });
          }

          // Provider Synthesis Turn (Groq, Cloudflare, or Mock)
          const finalTurn = await provider.generateResponse({
            messages: conversationWithTools,
            tools: authorizedDeclarations,
            context: {
              portal,
              authenticatedRole: userRole,
              allowedToolNames: authorizedDeclarations.map(t => t.name)
            }
          });

          if (finalTurn.usage) {
            tokenUsage = finalTurn.usage;
          }

          const primaryResult = executionOutput.executedResults.find(r => r.name === plan.primaryToolName && r.success)?.result 
            || executionOutput.executedResults.find(r => r.success)?.result;

          if ((!finalTurn.message.content || finalTurn.message.content.trim() === '') && primaryResult) {
            finalTurn.message.content = 'Here is the verified operational data retrieved from authoritative school records.';
          }

          let structuredData: NormalizedStructuredData | undefined = undefined;
          let provenance: NormalizedProvenance | undefined = undefined;
          let navigationActions: NormalizedNavigationAction[] | undefined = undefined;

          if (primaryResult) {
            const mapping = mapToolToNormalizedOutput(plan.primaryToolName, primaryResult);
            structuredData = mapping.structuredData;
            provenance = mapping.provenance;
            navigationActions = mapping.navigationActions;

            if (aggregateData.mergedSourceDomains.length > 0) {
              provenance = {
                sourceDomains: aggregateData.mergedSourceDomains,
                asOf: provenance?.asOf || new Date().toISOString()
              };
              if (structuredData) {
                structuredData.provenance = provenance;
              }
            }
          }

          const normalizedContent = normalizeAssistantText(finalTurn.message.content || '', {
            hasStructuredData: Boolean(structuredData),
            toolName: plan.primaryToolName,
            skipFeatureMenuRule: plan.skipFeatureMenuRule,
          });

          const validated = validateAndRemedyCompleteness(
            normalizedContent,
            plan,
            executionOutput.executedResults,
            aggregateData,
            plan.primaryToolName,
            Boolean(structuredData),
            navigationActions
          );

          const activeFailover = finalTurn.failoverMetadata;
          await recordAIAuditLog({
            traceId,
            userId: authUser.id,
            role: userRole,
            portal,
            scopeDecision: 'ALLOWED',
            toolsRequested,
            toolsExecuted,
            status: 'SUCCESS',
            providerMode: provider.mode,
            latencyMs: Date.now() - startTime,
            tokenUsage: {
              ...(tokenUsage || {}),
              requestedMode: aiConfig.providerMode,
              primaryProvider: activeFailover?.primaryProvider || provider.name,
              finalProvider: activeFailover?.finalProvider || provider.name,
              failoverOccurred: Boolean(activeFailover?.occurred),
              failoverReason: activeFailover?.reason || null,
              model: activeFailover?.model || provider.model || null,
              orchestration: {
                intent: plan.intent,
                obligationsTotal: validated.auditMetrics.obligationsTotal,
                domainObligationsTotal: validated.auditMetrics.domainObligationsTotal,
                operationObligationsTotal: validated.auditMetrics.operationObligationsTotal,
                satisfiedCount: validated.auditMetrics.satisfiedCount,
                satisfiedDomainCount: validated.auditMetrics.satisfiedDomainCount,
                satisfiedOperationCount: validated.auditMetrics.satisfiedOperationCount,
                remediedCount: validated.auditMetrics.remediedCount,
                unmetCount: validated.auditMetrics.unmetCount,
                completionState: validated.auditMetrics.completionState,
              }
            }
          });

          return {
            message: {
              ...finalTurn.message,
              content: validated.finalizedContent,
            },
            responseType: structuredData ? 'structured' : 'text',
            structuredData,
            provenance,
            navigationActions,
            traceId,
            scopeDecision: 'ALLOWED',
            toolsExecuted
          };
        }
      }

      // 4. Initial Provider Turn (Dynamic single-tool dispatch for non-composite queries)
      const firstTurn = await provider.generateResponse({
        messages,
        tools: authorizedDeclarations,
        context: {
          portal,
          authenticatedRole: userRole,
          allowedToolNames: authorizedDeclarations.map(t => t.name)
        }
      });

      if (firstTurn.usage) {
        tokenUsage = firstTurn.usage;
      }

      // 5. Handle Tool Invocations if requested
      if (firstTurn.toolCalls && firstTurn.toolCalls.length > 0) {
        const toolCallsToExecute = firstTurn.toolCalls.slice(0, aiConfig.limits.maxToolCallsPerTurn);
        const conversationWithTools = [...messages, firstTurn.message];
        let lastToolResult: any = null;
        let lastToolName: string | null = null;

        for (const call of toolCallsToExecute) {
          toolsRequested.push(call.name);

          // Dispatch through server authorization & domain services
          const result = await dispatchTool(call.name, call.arguments, {
            user: authUser,
            correlationId,
            portal
          });

          toolsExecuted.push(call.name);
          lastToolResult = result.data;
          lastToolName = call.name;

          conversationWithTools.push({
            role: 'tool',
            name: call.name,
            toolCallId: call.id,
            content: JSON.stringify(result.data)
          });
        }

        // 6. Grounded Synthesis Turn
        let finalTurn = await provider.generateResponse({
          messages: conversationWithTools,
          tools: authorizedDeclarations,
          context: { portal, authenticatedRole: userRole }
        });

        // If the model requested another tool call and hasn't exceeded limits, execute it
        if (finalTurn.toolCalls && finalTurn.toolCalls.length > 0 && toolsExecuted.length < aiConfig.limits.maxToolCallsPerTurn) {
          conversationWithTools.push(finalTurn.message);
          for (const call of finalTurn.toolCalls.slice(0, aiConfig.limits.maxToolCallsPerTurn - toolsExecuted.length)) {
            toolsRequested.push(call.name);
            const result = await dispatchTool(call.name, call.arguments, {
              user: authUser,
              correlationId,
              portal
            });
            toolsExecuted.push(call.name);
            lastToolResult = result.data;
            lastToolName = call.name;

            conversationWithTools.push({
              role: 'tool',
              name: call.name,
              toolCallId: call.id,
              content: JSON.stringify(result.data)
            });
          }

          finalTurn = await provider.generateResponse({
            messages: conversationWithTools,
            tools: authorizedDeclarations,
            context: { portal, authenticatedRole: userRole }
          });
        }

        // Guarantee non-empty grounded narrative if tool execution succeeded
        if ((!finalTurn.message.content || finalTurn.message.content.trim() === '') && lastToolResult) {
          finalTurn.message.content = 'Here is the verified operational data retrieved from authoritative school records.';
        }

        if (finalTurn.usage && tokenUsage) {
          tokenUsage = {
            promptTokens: tokenUsage.promptTokens + finalTurn.usage.promptTokens,
            completionTokens: tokenUsage.completionTokens + finalTurn.usage.completionTokens,
            totalTokens: tokenUsage.totalTokens + finalTurn.usage.totalTokens,
          };
        }

        const activeFailover = finalTurn.failoverMetadata || firstTurn.failoverMetadata;
        await recordAIAuditLog({
          traceId,
          userId: authUser.id,
          role: userRole,
          portal,
          scopeDecision: 'ALLOWED',
          toolsRequested,
          toolsExecuted,
          status: 'SUCCESS',
          providerMode: provider.mode,
          latencyMs: Date.now() - startTime,
          tokenUsage: {
            ...(tokenUsage || {}),
            requestedMode: aiConfig.providerMode,
            primaryProvider: activeFailover?.primaryProvider || provider.name,
            finalProvider: activeFailover?.finalProvider || provider.name,
            failoverOccurred: Boolean(activeFailover?.occurred),
            failoverReason: activeFailover?.reason || null,
            model: activeFailover?.model || provider.model || null,
          }
        });

        let structuredData: NormalizedStructuredData | undefined = undefined;
        let provenance: NormalizedProvenance | undefined = undefined;
        let navigationActions: NormalizedNavigationAction[] | undefined = undefined;

        if (lastToolResult && lastToolName) {
          const mapping = mapToolToNormalizedOutput(lastToolName, lastToolResult);
          structuredData = mapping.structuredData;
          provenance = mapping.provenance;
          navigationActions = mapping.navigationActions;
        }

        const normalizedContent = normalizeAssistantText(finalTurn.message.content || '', {
          hasStructuredData: Boolean(structuredData),
          toolName: lastToolName || undefined,
        });

        return {
          message: {
            ...finalTurn.message,
            content: normalizedContent,
          },
          responseType: 'structured',
          structuredData,
          provenance,
          navigationActions,
          traceId,
          scopeDecision: 'ALLOWED',
          toolsExecuted
        };
      }

      // No tool calls needed; return direct response
      const activeFailover = firstTurn.failoverMetadata;
      await recordAIAuditLog({
        traceId,
        userId: authUser.id,
        role: userRole,
        portal,
        scopeDecision: 'ALLOWED',
        toolsRequested: [],
        toolsExecuted: [],
        status: 'SUCCESS',
        providerMode: provider.mode,
        latencyMs: Date.now() - startTime,
        tokenUsage: {
          ...(tokenUsage || {}),
          requestedMode: aiConfig.providerMode,
          primaryProvider: activeFailover?.primaryProvider || provider.name,
          finalProvider: activeFailover?.finalProvider || provider.name,
          failoverOccurred: Boolean(activeFailover?.occurred),
          failoverReason: activeFailover?.reason || null,
          model: activeFailover?.model || provider.model || null,
        }
      });

      let navigationActions: NormalizedNavigationAction[] | undefined = undefined;
      const lowerReply = (firstTurn.message.content || '').toLowerCase();
      const lowerQuery = (lastUserMsg?.content || '').toLowerCase();

      if (lowerQuery.includes('attendance') || lowerReply.includes('gate attendance monitoring')) {
        navigationActions = [{
          label: 'Open Gate Attendance Monitoring',
          screen: 'p-monitoring',
          description: 'Open Gate Attendance Monitoring tab',
        }];
      } else if (lowerQuery.includes('leave') || lowerReply.includes('leave management')) {
        navigationActions = [{
          label: 'Open Leave Management',
          screen: 'p-leaves',
          description: 'Open Leave Management tab',
        }];
      } else if (lowerQuery.includes('behavior') || lowerReply.includes('behavioral reports')) {
        navigationActions = [{
          label: 'View Behavioral Reports',
          screen: 'p-behavior',
          description: 'Open Behavioral Reports tab',
        }];
      } else if (lowerQuery.includes('academic') || lowerReply.includes('academic analytics')) {
        navigationActions = [{
          label: 'Open Academic Analytics',
          screen: 'p-analytics',
          description: 'Open Academic Analytics tab',
        }];
      }

      const normalizedDirectContent = normalizeAssistantText(firstTurn.message.content || '');

      return {
        message: {
          ...firstTurn.message,
          content: normalizedDirectContent,
        },
        responseType: 'text',
        navigationActions,
        traceId,
        scopeDecision: 'ALLOWED',
        toolsExecuted: []
      };

    } catch (err: any) {
      const isProviderErr = err instanceof AIProviderError;
      const status = isProviderErr ? 'ERROR' : 'ERROR';

      await recordAIAuditLog({
        traceId,
        userId: authUser.id,
        role: userRole,
        portal,
        scopeDecision: isProviderErr ? (err.code as any) : 'ALLOWED',
        toolsRequested,
        toolsExecuted,
        status: 'ERROR',
        providerMode: provider.mode,
        latencyMs: Date.now() - startTime,
        tokenUsage: {
          requestedMode: aiConfig.providerMode,
          primaryProvider: provider.name,
          finalProvider: provider.name,
          failoverOccurred: false,
          failoverReason: isProviderErr ? err.code : 'UNKNOWN_ERROR',
          model: provider.model || null,
        }
      });

      // FREE-TIER POLICY ENFORCEMENT: Never trigger automatic paid fallback!
      if (isProviderErr) {
        if (err.code === 'RATE_LIMITED' || err.code === 'FREE_QUOTA_EXHAUSTED') {
          const content = provider.mode === 'chatgpt_plan' && err.message
            ? err.message
            : 'DigiSkwela AI is temporarily unavailable because the free AI service limit has been reached. Please try again later.';

          return {
            message: {
              role: 'assistant',
              content
            },
            responseType: 'text',
            traceId,
            scopeDecision: 'RATE_LIMITED',
            toolsExecuted
          };
        }

        if (err.code === 'PROVIDER_TIMEOUT' || err.code === 'PROVIDER_UNAVAILABLE') {
          const content = provider.mode === 'chatgpt_plan' && err.message
            ? err.message
            : 'DigiSkwela AI is temporarily unavailable. Please try again later.';

          return {
            message: {
              role: 'assistant',
              content
            },
            responseType: 'text',
            traceId,
            scopeDecision: 'PROVIDER_UNAVAILABLE',
            toolsExecuted
          };
        }
      }

      throw err;
    }
  }
};
