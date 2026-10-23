import { 
  AICompletionRequest, 
  AICompletionResponse, 
  AIMessage, 
  AIToolCall, 
  AITokenUsage, 
  DigiSkwelaAIProvider 
} from '../provider/aiProvider.interface.js';
import { getAIProvider } from '../provider/aiProvider.factory.js';
import { evaluateScope } from '../security/scopeGuard.js';
import { roleCapabilityRegistry } from './roleCapabilityRegistry.js';
import { TurnState } from './turnState.js';
import { 
  AgentTurnInput, 
  AgentTurnResult, 
  ObligationMetricSummary 
} from './agentHarness.interface.js';
import { dispatchTool } from '../tools/toolDispatcher.js';
import { buildRequestPlan, PrincipalRequestPlan } from '../orchestration/requestPlanner.js';
import { aggregateFacts, AggregationResult } from '../orchestration/aggregator.js';
import { buildSynthesisDirective } from '../orchestration/synthesisDirective.js';
import { validateAndRemedyCompleteness } from '../orchestration/completenessValidator.js';
import { normalizeAssistantText } from '../utils/normalizeResponseText.js';
import { recordAIAuditLog } from '../audit/aiAudit.service.js';
import { generateId } from '../../common/utils/uuid.js';
import { aiConfig } from '../../config/ai.config.js';
import { 
  NormalizedStructuredData, 
  NormalizedProvenance, 
  NormalizedNavigationAction,
  mapToolToNormalizedOutput 
} from './normalizedOutput.js';

export interface HarnessExecutionOptions {
  maxRounds?: number;
  maxToolsPerTurn?: number;
  maxDuplicatesPerSignature?: number;
}

/**
 * DigiSkwelaAgentHarness — Unified Role-Aware Agent Orchestrator & Bounded Tool-Use Loop
 * 
 * Formal Invariants:
 * 1. Single shared orchestrator across all roles (no per-role brains).
 * 2. RoleCapabilityRegistry enforces authorization before exposing declarations to the model.
 * 3. Server-side RBAC enforcement in dispatchTool (JWT roles/permissions are source of truth).
 * 4. Bounded iterative tool loop (max 5 rounds, max 10 tools, max 2 duplicate signatures).
 * 5. Sequential multi-step reasoning & parallel independent tool execution.
 * 6. Turn integrity: turn-bound tool call IDs (${turnId}_r${round}_${toolName}_${index}) & fresh turn state.
 * 7. Deterministic completeness validation as the final grounding guarantee.
 */
export class DigiSkwelaAgentHarness {
  private defaultMaxRounds = 5;
  private defaultMaxToolsPerTurn = 10;
  private defaultMaxDuplicatesPerSignature = 2;

  /**
   * Primary entry point: Executes a single, role-aware, turn-bound agent interaction.
   */
  public async runTurn(
    input: AgentTurnInput,
    options?: HarnessExecutionOptions
  ): Promise<AgentTurnResult> {
    const startTime = Date.now();
    const turnId = input.turnId || `turn_${generateId()}`;
    const sessionId = input.sessionId || `sess_${generateId()}`;
    const traceId = (input.traceId || generateId()).slice(0, 36);
    const portal = input.portal || 'Principal';
    const authUser = input.authUser;
    const userRoles = authUser.roles || [];
    const userPermissions = authUser.permissions || [];
    const primaryRole = userRoles[0] || 'Unknown';
    const correlationId = input.correlationId || traceId;

    const maxRounds = options?.maxRounds || (aiConfig.limits as any)?.maxRounds || this.defaultMaxRounds;
    const maxToolsPerTurn = options?.maxToolsPerTurn || aiConfig.limits?.maxToolCallsPerTurn || this.defaultMaxToolsPerTurn;
    const maxDuplicatesPerSignature = options?.maxDuplicatesPerSignature || this.defaultMaxDuplicatesPerSignature;

    // ─── 1. Role Capability Check (Hard Role Boundary) ───────────────────
    if (!roleCapabilityRegistry.isConversationalAiAllowedForRoles(userRoles)) {
      return {
        sessionId,
        turnId,
        traceId,
        message: {
          role: 'assistant',
          content: 'Conversational AI is not enabled for your assigned role. Please use the designated portal interfaces for your duties.',
        },
        responseType: 'text',
        toolsExecuted: [],
        scopeDecision: 'ROLE_NOT_PERMITTED',
        traceSpans: [
          {
            name: 'ROLE_BOUNDARY_REJECT',
            status: 'BLOCKED',
            durationMs: 0,
            timestamp: new Date().toISOString(),
          }
        ]
      };
    }

    // ─── 2. Scope Guard Check (Domain Boundary) ─────────────────────────
    const lastUserMsg = [...input.messages].reverse().find(m => m.role === 'user');
    const rawUserPrompt = (lastUserMsg?.content || '').trim();

    const scopeResult = evaluateScope(rawUserPrompt);
    if (!scopeResult.allowed) {
      await recordAIAuditLog({
        traceId,
        userId: authUser.id,
        role: primaryRole,
        portal,
        scopeDecision: scopeResult.reason || 'OUT_OF_SCOPE',
        toolsRequested: [],
        toolsExecuted: [],
        status: 'SUCCESS',
        providerMode: 'mock',
        latencyMs: Date.now() - startTime,
        tokenUsage: null
      });

      return {
        sessionId,
        turnId,
        traceId,
        message: {
          role: 'assistant',
          content: scopeResult.userMessage || 'Request is out of scope for DigiSkwela operations.'
        },
        responseType: 'text',
        scopeDecision: scopeResult.reason || 'OUT_OF_SCOPE',
        toolsExecuted: [],
        traceSpans: [
          {
            name: 'SCOPE_GUARD_REJECT',
            status: scopeResult.reason || 'OUT_OF_SCOPE',
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          }
        ]
      };
    }

    // ─── 3. Authorized Tool Declarations ────────────────────────────────
    const authorizedDeclarations = roleCapabilityRegistry.getDeclarationsForUser(
      userRoles,
      userPermissions
    );
    const authorizedToolNamesSet = new Set(authorizedDeclarations.map(d => d.name));

    // ─── 4. Request Planner Integration (Deterministic Plan & Fast Paths) ─
    const plan = buildRequestPlan(input.messages, primaryRole, portal, authorizedToolNamesSet);

    if (plan) {
      if (plan.intent === 'OUT_OF_SCOPE') {
        await recordAIAuditLog({
          traceId,
          userId: authUser.id,
          role: primaryRole,
          portal,
          scopeDecision: 'OUT_OF_SCOPE',
          toolsRequested: [],
          toolsExecuted: [],
          status: 'SUCCESS',
          providerMode: aiConfig.providerMode,
          latencyMs: Date.now() - startTime,
          tokenUsage: null
        });

        return {
          sessionId,
          turnId,
          traceId,
          message: {
            role: 'assistant',
            content: plan.directResponseContent || 'Request is out of scope for DigiSkwela operations.'
          },
          responseType: 'text',
          scopeDecision: 'OUT_OF_SCOPE',
          toolsExecuted: []
        };
      }

      if (plan.intent === 'SOCIAL') {
        await recordAIAuditLog({
          traceId,
          userId: authUser.id,
          role: primaryRole,
          portal,
          scopeDecision: 'ALLOWED',
          toolsRequested: [],
          toolsExecuted: [],
          status: 'SUCCESS',
          providerMode: aiConfig.providerMode,
          latencyMs: Date.now() - startTime,
          tokenUsage: null
        });

        return {
          sessionId,
          turnId,
          traceId,
          message: {
            role: 'assistant',
            content: plan.directResponseContent || 'You’re welcome.'
          },
          responseType: 'text',
          scopeDecision: 'ALLOWED',
          toolsExecuted: []
        };
      }

      if (plan.intent === 'NAVIGATION') {
        await recordAIAuditLog({
          traceId,
          userId: authUser.id,
          role: primaryRole,
          portal,
          scopeDecision: 'ALLOWED',
          toolsRequested: [],
          toolsExecuted: [],
          status: 'SUCCESS',
          providerMode: aiConfig.providerMode,
          latencyMs: Date.now() - startTime,
          tokenUsage: null
        });

        return {
          sessionId,
          turnId,
          traceId,
          message: {
            role: 'assistant',
            content: plan.directResponseContent || 'Which DigiSkwela feature do you need help with?'
          },
          responseType: 'text',
          navigationActions: plan.navigationAction ? [plan.navigationAction] : undefined,
          scopeDecision: 'ALLOWED',
          toolsExecuted: []
        };
      }

      if (plan.intent === 'CLARIFICATION') {
        await recordAIAuditLog({
          traceId,
          userId: authUser.id,
          role: primaryRole,
          portal,
          scopeDecision: 'ALLOWED',
          toolsRequested: [],
          toolsExecuted: [],
          status: 'SUCCESS',
          providerMode: aiConfig.providerMode,
          latencyMs: Date.now() - startTime,
          tokenUsage: null
        });

        return {
          sessionId,
          turnId,
          traceId,
          message: {
            role: 'assistant',
            content: plan.clarificationMessage || 'Could you please clarify who you are referring to?'
          },
          responseType: 'text',
          scopeDecision: 'ALLOWED',
          toolsExecuted: []
        };
      }
    }

    // ─── 5. Ephemeral Turn State Initialization ─────────────────────────
    const turnState = new TurnState({
      turnId,
      sessionId,
      traceId,
      role: primaryRole,
      obligations: plan?.obligations || []
    });

    const provider = input.provider || getAIProvider();
    const conversationWithTools: AIMessage[] = [...input.messages];
    let tokenUsageCombined: AITokenUsage | null = null;
    let finalTurnResponse: AICompletionResponse | null = null;
    let currentRound = 1;

    const isSimulation = input.messages.some(m => (m.content || '').includes('[simulate_'));
    const isChatGPTPlan = provider.mode === 'chatgpt_plan' || (provider.name && provider.name.toLowerCase().includes('chatgpt'));

    // Grounding: If planned operational tools exist for this domain request, dispatch them initially
    // (Excluded for ChatGPT Plan which strictly enforces model-initiated function call history under Responses API)
    if (!isSimulation && !isChatGPTPlan && plan?.toolsToExecute && plan.toolsToExecute.length > 0 && turnState.toolsExecuted.length === 0) {
      turnState.addSpan('PLANNED_TOOLS_DISPATCH', { round: 1, status: 'DISPATCHING' });

      for (let idx = 0; idx < plan.toolsToExecute.length; idx++) {
        if (turnState.toolsExecuted.length >= maxToolsPerTurn) break;

        const pt = plan.toolsToExecute[idx];
        const toolName = pt.name;
        const toolArgs = pt.args || {};
        const callId = turnState.generateCallId(1, toolName, idx);

        if (!roleCapabilityRegistry.isToolAuthorizedForUser(toolName, userRoles, userPermissions)) {
          turnState.addSpan('TOOL_UNAUTHORIZED_BLOCKED', { round: 1, toolName, callId, status: 'FORBIDDEN' });
          conversationWithTools.push({
            role: 'tool',
            name: toolName,
            toolCallId: callId,
            content: JSON.stringify({ error: `Tool '${toolName}' is not authorized for your role.` })
          });
          continue;
        }

        const toolStartTime = Date.now();
        let execResult: any = null;
        let success = true;
        let errorMessage: string | undefined = undefined;

        try {
          const dispatchRes = await dispatchTool(toolName, toolArgs, {
            user: authUser,
            correlationId,
            portal
          });
          execResult = dispatchRes.data;
        } catch (err: any) {
          success = false;
          errorMessage = err.message || 'Tool execution failed';
        }
        const toolDuration = Date.now() - toolStartTime;

        turnState.recordToolExecution({
          name: toolName,
          args: toolArgs,
          result: execResult,
          success,
          error: errorMessage,
          toolCallId: callId
        });

        turnState.addSpan('TOOL_EXECUTED', {
          round: 1,
          toolName,
          callId,
          durationMs: toolDuration,
          status: success ? 'SUCCESS' : 'FAILED'
        });

        conversationWithTools.push({
          role: 'tool',
          name: toolName,
          toolCallId: callId,
          content: success ? JSON.stringify(execResult) : JSON.stringify({ error: errorMessage })
        });
      }

      if (plan && plan.obligations?.length > 0) {
        const aggregateData = aggregateFacts(plan, turnState.executedResults);
        const directiveMsg = buildSynthesisDirective(plan, aggregateData);
        conversationWithTools.push(directiveMsg);
      }
    }

    // ─── 6. Bounded Iterative Tool-Use Loop ──────────────────────────────
    while (currentRound <= maxRounds) {
      turnState.addSpan(`ROUND_${currentRound}_START`, { round: currentRound });

      const roundStartTime = Date.now();
      const modelResponse = await provider.generateResponse({
        messages: conversationWithTools,
        tools: authorizedDeclarations,
        context: {
          portal,
          authenticatedRole: primaryRole,
          allowedToolNames: Array.from(authorizedToolNamesSet),
        }
      });
      const roundDuration = Date.now() - roundStartTime;

      if (modelResponse.usage) {
        if (!tokenUsageCombined) {
          tokenUsageCombined = { ...modelResponse.usage };
        } else {
          tokenUsageCombined.promptTokens += modelResponse.usage.promptTokens || 0;
          tokenUsageCombined.completionTokens += modelResponse.usage.completionTokens || 0;
          tokenUsageCombined.totalTokens += modelResponse.usage.totalTokens || 0;
        }
      }

      turnState.addSpan(`ROUND_${currentRound}_MODEL_RESPONSE`, {
        round: currentRound,
        durationMs: roundDuration,
        status: modelResponse.toolCalls?.length ? 'TOOL_CALLS' : 'TEXT'
      });

      const toolCalls = modelResponse.toolCalls;

      // If the model did NOT request tool calls, this is the final synthesis turn
      if (!toolCalls || toolCalls.length === 0) {
        finalTurnResponse = modelResponse;
        break;
      }

      // Check if turn tool call budget reached
      if (turnState.toolsExecuted.length >= maxToolsPerTurn) {
        turnState.addSpan('MAX_TOOLS_BUDGET_REACHED', { round: currentRound, status: 'HALTED' });
        finalTurnResponse = modelResponse;
        break;
      }

      // Record assistant turn in message history
      conversationWithTools.push(modelResponse.message);

      // Execute each tool call requested by model in this round
      for (let idx = 0; idx < toolCalls.length; idx++) {
        if (turnState.toolsExecuted.length >= maxToolsPerTurn) {
          break;
        }

        const tc = toolCalls[idx];
        const toolName = tc.name;
        const toolArgs = tc.arguments || {};
        const callId = turnState.generateCallId(currentRound, toolName, idx);

        // A. Server-Side Role Authorization Check
        if (!roleCapabilityRegistry.isToolAuthorizedForUser(toolName, userRoles, userPermissions)) {
          turnState.addSpan('TOOL_UNAUTHORIZED_BLOCKED', { round: currentRound, toolName, callId, status: 'FORBIDDEN' });
          conversationWithTools.push({
            role: 'tool',
            name: toolName,
            toolCallId: tc.id || callId,
            content: JSON.stringify({ error: `Tool '${toolName}' is not authorized for your role.` })
          });
          continue;
        }

        // B. Duplicate Call Guard (Max 2 identical signatures per turn)
        if (turnState.isDuplicateCallExceeded(toolName, toolArgs, maxDuplicatesPerSignature)) {
          turnState.duplicateToolCallsAvoided++;
          turnState.addSpan('TOOL_DUPLICATE_AVOIDED', { round: currentRound, toolName, callId, status: 'SKIPPED' });
          const cachedResult = turnState.findCachedResult(toolName, toolArgs);
          conversationWithTools.push({
            role: 'tool',
            name: toolName,
            toolCallId: tc.id || callId,
            content: JSON.stringify(cachedResult || { error: `Duplicate call to '${toolName}' avoided.` })
          });
          continue;
        }

        // C. Server-Side Tool Execution under RBAC
        const toolStartTime = Date.now();
        let execResult: any = null;
        let success = true;
        let errorMessage: string | undefined = undefined;

        try {
          const dispatchRes = await dispatchTool(toolName, toolArgs, {
            user: authUser,
            correlationId,
            portal
          });
          execResult = dispatchRes.data;
        } catch (err: any) {
          success = false;
          errorMessage = err.message || 'Tool execution failed';
        }
        const toolDuration = Date.now() - toolStartTime;

        turnState.recordToolExecution({
          name: toolName,
          args: toolArgs,
          result: execResult,
          success,
          error: errorMessage,
          toolCallId: callId
        });

        turnState.addSpan('TOOL_EXECUTED', {
          round: currentRound,
          toolName,
          callId,
          durationMs: toolDuration,
          status: success ? 'SUCCESS' : 'FAILED'
        });

        conversationWithTools.push({
          role: 'tool',
          name: toolName,
          toolCallId: tc.id || callId,
          content: success ? JSON.stringify(execResult) : JSON.stringify({ error: errorMessage })
        });
      }

      if (plan && plan.obligations?.length > 0 && turnState.toolsExecuted.length > 0) {
        const hasDirective = conversationWithTools.some(m => m.role === 'system' && m.content.includes('OPERATIONAL OBLIGATIONS'));
        if (!hasDirective) {
          const aggregateData = aggregateFacts(plan, turnState.executedResults);
          const directiveMsg = buildSynthesisDirective(plan, aggregateData);
          conversationWithTools.push(directiveMsg);
        }
      }

      currentRound++;
    }

    // If loop reached max rounds without final text synthesis turn, perform final synthesis
    if (!finalTurnResponse || !finalTurnResponse.message?.content) {
      if (plan && plan.obligations?.length > 0) {
        const aggregateData = aggregateFacts(plan, turnState.executedResults);
        const directiveMsg = buildSynthesisDirective(plan, aggregateData);
        conversationWithTools.push(directiveMsg);
      }

      turnState.addSpan('FINAL_SYNTHESIS_ROUND', { round: currentRound });
      finalTurnResponse = await provider.generateResponse({
        messages: conversationWithTools,
        tools: authorizedDeclarations,
        context: {
          portal,
          authenticatedRole: primaryRole,
          allowedToolNames: Array.from(authorizedToolNamesSet),
        }
      });
    }

    const resolvedResponse: AICompletionResponse = finalTurnResponse || {
      message: { role: 'assistant', content: '' },
      usage: tokenUsageCombined || undefined,
      finishReason: 'stop',
    };

    // ─── 7. Grounded Baseline & Contradiction Protection ────────────────
    const successfulResults = turnState.executedResults.filter(r => r.success);
    if ((!resolvedResponse.message.content || resolvedResponse.message.content.trim() === '') && successfulResults.length > 0) {
      resolvedResponse.message.content = 'Here is the verified operational data retrieved from authoritative school records.';
    }

    // ─── 8. Completeness Validation & Fact Aggregation ───────────────────
    let structuredData: NormalizedStructuredData | undefined = undefined;
    let provenance: NormalizedProvenance | undefined = undefined;
    let navigationActions: NormalizedNavigationAction[] | undefined = undefined;
    let finalizedContent = resolvedResponse.message.content || '';
    let completionMetrics: ObligationMetricSummary | undefined = undefined;

    const primaryToolName = plan?.primaryToolName || turnState.toolsExecuted[0] || '';
    const primaryResult = successfulResults.find(r => r.name === primaryToolName)?.result || successfulResults[0]?.result;

    if (primaryResult && primaryToolName) {
      const mapping = mapToolToNormalizedOutput(primaryToolName, primaryResult);
      structuredData = mapping.structuredData;
      provenance = mapping.provenance;
      navigationActions = mapping.navigationActions;
    }

    if (plan) {
      const aggregateData = aggregateFacts(plan, turnState.executedResults);

      if (aggregateData.mergedSourceDomains.length > 0) {
        provenance = {
          sourceDomains: aggregateData.mergedSourceDomains,
          asOf: provenance?.asOf || new Date().toISOString()
        };
        if (structuredData) {
          structuredData.provenance = provenance;
        }
      }

      const normalized = normalizeAssistantText(finalizedContent, {
        hasStructuredData: Boolean(structuredData),
        toolName: primaryToolName || undefined,
        skipFeatureMenuRule: plan.skipFeatureMenuRule,
      });

      const validated = validateAndRemedyCompleteness(
        normalized,
        plan,
        turnState.executedResults,
        aggregateData,
        primaryToolName,
        Boolean(structuredData),
        navigationActions
      );

      finalizedContent = validated.finalizedContent;
      completionMetrics = validated.auditMetrics;
    } else {
      finalizedContent = normalizeAssistantText(finalizedContent, {
        hasStructuredData: Boolean(structuredData),
        toolName: primaryToolName || undefined,
      });
    }

    // ─── 9. Record Audit Log ─────────────────────────────────────────────
    const activeFailover = resolvedResponse.failoverMetadata;
    await recordAIAuditLog({
      traceId,
      userId: authUser.id,
      role: primaryRole,
      portal,
      scopeDecision: 'ALLOWED',
      toolsRequested: turnState.toolsRequested,
      toolsExecuted: turnState.toolsExecuted,
      status: 'SUCCESS',
      providerMode: provider.mode,
      latencyMs: Date.now() - startTime,
      tokenUsage: {
        ...(tokenUsageCombined || {}),
        requestedMode: aiConfig.providerMode,
        primaryProvider: activeFailover?.primaryProvider || provider.name,
        finalProvider: activeFailover?.finalProvider || provider.name,
        failoverOccurred: Boolean(activeFailover?.occurred),
        failoverReason: activeFailover?.reason || null,
        model: activeFailover?.model || provider.model || null,
        turnId,
        roundsExecuted: currentRound,
        orchestration: completionMetrics ? {
          ...completionMetrics,
          intent: plan?.intent,
          obligationsTotal: plan?.obligations?.length || completionMetrics.obligationsTotal || 0,
        } : (plan ? {
          intent: plan.intent,
          obligationsTotal: plan.obligations?.length || 0,
        } : undefined),
      }
    });

    turnState.addSpan('TURN_COMPLETE', {
      durationMs: Date.now() - startTime,
      status: 'SUCCESS'
    });

    return {
      sessionId,
      turnId,
      traceId,
      message: {
        role: 'assistant',
        content: finalizedContent,
      },
      responseType: structuredData ? 'structured' : 'text',
      structuredData,
      provenance,
      navigationActions,
      toolsExecuted: turnState.toolsExecuted,
      scopeDecision: 'ALLOWED',
      completion: completionMetrics,
      traceSpans: turnState.traceSpans
    };
  }
}

export const digiSkwelaAgentHarness = new DigiSkwelaAgentHarness();
