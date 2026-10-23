import { getAIProvider } from './provider/aiProvider.factory.js';
import { AIMessage, AIProviderError } from './provider/aiProvider.interface.js';
import { recordAIAuditLog } from './audit/aiAudit.service.js';
import { AuthenticatedUser } from '../common/middleware/auth.js';
import { AppError } from '../common/middleware/errorHandler.js';
import { generateId } from '../common/utils/uuid.js';
import { aiConfig } from '../config/ai.config.js';
import { digiSkwelaAgentHarness } from './harness/agentHarness.js';
import { ObligationMetricSummary, TurnTraceSpan } from './harness/agentHarness.interface.js';
import { 
  NormalizedStructuredData, 
  NormalizedProvenance, 
  NormalizedNavigationAction, 
  mapToolToNormalizedOutput 
} from './harness/normalizedOutput.js';

export * from './harness/normalizedOutput.js';

export interface ProcessChatRequestInput {
  messages: AIMessage[];
  portal: string;
  conversationId?: string;
  turnId?: string;
  sessionId?: string;
  traceId?: string;
}

export interface ProcessChatResponseOutput {
  turnId?: string;
  sessionId?: string;
  message: AIMessage;
  responseType: 'text' | 'structured';
  structuredData?: NormalizedStructuredData;
  provenance?: NormalizedProvenance;
  navigationActions?: NormalizedNavigationAction[];
  traceId: string;
  scopeDecision: string;
  toolsExecuted: string[];
  completion?: ObligationMetricSummary;
  traceSpans?: TurnTraceSpan[];
  origin?: 'STATIC_UI' | 'LOCAL_APPLICATION' | 'AI_PROVIDER' | 'ERROR_FALLBACK';
}

export const AIService = {
  /**
   * Main AI Orchestration Entrypoint — Delegates to DigiSkwelaAgentHarness
   */
  async processChat(
    input: ProcessChatRequestInput,
    authUser: AuthenticatedUser,
    correlationId?: string
  ): Promise<ProcessChatResponseOutput> {
    const startTime = Date.now();
    const traceId = input.traceId || correlationId || generateId();
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

    try {
      const turnResult = await digiSkwelaAgentHarness.runTurn({
        sessionId: input.sessionId,
        turnId: input.turnId,
        traceId,
        messages,
        portal,
        authUser,
        correlationId: correlationId || traceId,
      });

      return {
        turnId: turnResult.turnId,
        sessionId: turnResult.sessionId,
        message: turnResult.message,
        responseType: turnResult.responseType,
        structuredData: turnResult.structuredData,
        provenance: turnResult.provenance,
        navigationActions: turnResult.navigationActions,
        traceId: turnResult.traceId,
        scopeDecision: turnResult.scopeDecision,
        toolsExecuted: turnResult.toolsExecuted,
        completion: turnResult.completion,
        traceSpans: turnResult.traceSpans,
        origin: turnResult.origin,
      };
    } catch (err: any) {
      const isProviderErr = err instanceof AIProviderError;
      const provider = getAIProvider();

      await recordAIAuditLog({
        traceId,
        userId: authUser.id,
        role: userRole,
        portal,
        scopeDecision: isProviderErr ? (err.code as any) : 'ALLOWED',
        toolsRequested: [],
        toolsExecuted: [],
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
            : (err.code === 'FREE_QUOTA_EXHAUSTED' || (err.message && err.message.toLowerCase().includes('quota'))
                ? 'DigiSkwela AI is temporarily unavailable because the free AI service limit has been reached. Please try again later.'
                : 'DigiSkwela AI is temporarily unavailable because the free AI service limit has been reached. Please try again later.');

          return {
            turnId: input.turnId || `turn_${generateId()}`,
            sessionId: input.sessionId,
            message: {
              role: 'assistant',
              content
            },
            responseType: 'text',
            traceId,
            scopeDecision: 'RATE_LIMITED',
            toolsExecuted: [],
            origin: 'ERROR_FALLBACK',
          };
        }

        if (err.code === 'PROVIDER_TIMEOUT') {
          const content = provider.mode === 'chatgpt_plan' && err.message
            ? err.message
            : 'DigiSkwela AI is temporarily unavailable. Please try again later.';

          return {
            turnId: input.turnId || `turn_${generateId()}`,
            sessionId: input.sessionId,
            message: {
              role: 'assistant',
              content
            },
            responseType: 'text',
            traceId,
            scopeDecision: 'PROVIDER_UNAVAILABLE',
            toolsExecuted: [],
            origin: 'ERROR_FALLBACK',
          };
        }

        if (err.code === 'PROVIDER_UNAVAILABLE') {
          const content = provider.mode === 'chatgpt_plan' && err.message
            ? err.message
            : 'DigiSkwela AI service is currently unavailable. Please verify connection and try again.';

          return {
            turnId: input.turnId || `turn_${generateId()}`,
            sessionId: input.sessionId,
            message: {
              role: 'assistant',
              content
            },
            responseType: 'text',
            traceId,
            scopeDecision: 'PROVIDER_UNAVAILABLE',
            toolsExecuted: [],
            origin: 'ERROR_FALLBACK',
          };
        }

        if (err.code === 'INVALID_PROVIDER_RESPONSE' || err.code === 'UNKNOWN_ERROR') {
          const content = provider.mode === 'chatgpt_plan' && err.message
            ? err.message
            : 'DigiSkwela AI encountered an unexpected response from the AI service. Please try again.';

          return {
            turnId: input.turnId || `turn_${generateId()}`,
            sessionId: input.sessionId,
            message: {
              role: 'assistant',
              content
            },
            responseType: 'text',
            traceId,
            scopeDecision: err.code,
            toolsExecuted: [],
            origin: 'ERROR_FALLBACK',
          };
        }
      }

      throw err;
    }

  }
};
