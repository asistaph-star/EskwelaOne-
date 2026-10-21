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
        label: 'View Faculty Attendance',
        screen: 'p-monitoring',
        description: 'Open Faculty Attendance monitoring tab',
      };
      break;
    case 'getSchoolOperationalFactSheet':
      type = 'fact_sheet';
      navAction = {
        label: 'View Executive Dashboard',
        screen: 'p-dashboard',
        description: 'Open Executive Dashboard',
      };
      break;
    case 'getPendingLeaves':
      type = 'leaves';
      navAction = {
        label: 'View Leave Approvals',
        screen: 'p-leaves',
        description: 'Open Leave Management tab',
      };
      break;
    case 'getUpcomingEvents':
      type = 'events';
      navAction = {
        label: 'View School Calendar',
        screen: 'p-events',
        description: 'Open Calendar & Events tab',
      };
      break;
    case 'getAdministrativeBehaviorSummary':
      type = 'behavior';
      navAction = {
        label: 'View Behavior Records',
        screen: 'p-behavior',
        description: 'Open Student Behavior tab',
      };
      break;
    case 'getAcademicAnalytics':
      type = 'academics';
      navAction = {
        label: 'View Academic Analytics',
        screen: 'p-analytics',
        description: 'Open Academic Performance tab',
      };
      break;
    case 'generatePrincipalMeetingBrief':
      type = 'meeting_brief';
      navAction = {
        label: 'View Executive Summary',
        screen: 'p-dashboard',
        description: 'Open Executive Briefing',
      };
      break;
    case 'generateWeeklyOperationsReport':
      type = 'weekly_report';
      navAction = {
        label: 'View Operations Reports',
        screen: 'p-dashboard',
        description: 'Open Executive Reports',
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

    const provider = getAIProvider();
    const toolsRequested: string[] = [];
    const toolsExecuted: string[] = [];
    let tokenUsage: any = null;

    try {
      // 4. Initial Provider Turn
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
        const finalTurn = await provider.generateResponse({
          messages: conversationWithTools,
          tools: authorizedDeclarations,
          context: { portal, authenticatedRole: userRole }
        });

        if (finalTurn.usage && tokenUsage) {
          tokenUsage = {
            promptTokens: tokenUsage.promptTokens + finalTurn.usage.promptTokens,
            completionTokens: tokenUsage.completionTokens + finalTurn.usage.completionTokens,
            totalTokens: tokenUsage.totalTokens + finalTurn.usage.totalTokens,
          };
        }

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
          tokenUsage
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

        return {
          message: finalTurn.message,
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
        tokenUsage
      });

      return {
        message: firstTurn.message,
        responseType: 'text',
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
        scopeDecision: 'ALLOWED',
        toolsRequested,
        toolsExecuted,
        status: 'ERROR',
        providerMode: provider.mode,
        latencyMs: Date.now() - startTime,
      });

      // FREE-TIER POLICY ENFORCEMENT: Never trigger automatic paid fallback!
      if (isProviderErr) {
        if (err.code === 'RATE_LIMITED' || err.code === 'FREE_QUOTA_EXHAUSTED') {
          return {
            message: {
              role: 'assistant',
              content: 'DigiSkwela AI is temporarily unavailable because the free AI service limit has been reached. Please try again later.'
            },
            responseType: 'text',
            traceId,
            scopeDecision: 'RATE_LIMITED',
            toolsExecuted
          };
        }

        if (err.code === 'PROVIDER_TIMEOUT' || err.code === 'PROVIDER_UNAVAILABLE') {
          return {
            message: {
              role: 'assistant',
              content: 'DigiSkwela AI is temporarily unavailable. Please try again later.'
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
