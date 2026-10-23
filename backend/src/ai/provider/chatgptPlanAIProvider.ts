import crypto from 'crypto';
import {
  DigiSkwelaAIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderMode,
  AIProviderError,
  AIToolCall,
  AIToolDeclaration,
  AIMessage
} from './aiProvider.interface.js';
import { chatGPTTokenStorage, ChatGPTTokenStorage } from '../chatgpt/chatgptTokenStorage.js';
import { chatGPTOAuthService, ChatGPTOAuthService } from '../chatgpt/chatgptOAuth.service.js';
import { aiConfig } from '../../config/ai.config.js';

export interface ChatGPTDiscoveredModel {
  slug: string;
  displayName: string;
  visibility?: string;
}

export interface ChatGPTResponsesRequestPayload {
  model: string;
  store: false;
  stream: true;
  instructions?: string;
  input: Array<any>;
  tools?: Array<{
    type: 'function';
    name: string;
    description: string;
    parameters: any;
  }>;
}

/**
 * ChatGPT Plan AI Provider Adapter
 * 
 * Formal Invariants:
 * - Powered exclusively by official "Sign in with ChatGPT" OAuth plan delegation.
 * - ZERO OpenAI API-key requirements; strictly NO paid fallback.
 * - Endpoint: `POST https://api.openai.com/v1/responses` with `store: false` and `stream: true`.
 * - Strips all preview-unsupported fields (temperature, top_p, max_output_tokens, metadata, conversation).
 * - Implements dynamic model discovery via `GET https://api.openai.com/v1/models`.
 * - Normalized provider response contract preserving DigiSkwela turn integrity.
 */
export class ChatGPTPlanAIProvider implements DigiSkwelaAIProvider {
  public readonly name = 'ChatGPTPlanAIProvider';
  public readonly mode: AIProviderMode = 'chatgpt_plan';
  public model?: string;

  private readonly storage: ChatGPTTokenStorage;
  private readonly oauthService: ChatGPTOAuthService;
  private readonly responsesUrl = 'https://api.openai.com/v1/responses';
  private readonly modelsUrl = 'https://api.openai.com/v1/models';
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options?: {
    storage?: ChatGPTTokenStorage;
    oauthService?: ChatGPTOAuthService;
    model?: string;
    timeoutMs?: number;
    fetchFn?: typeof fetch;
  }) {
    this.assertBillingSafety();
    this.storage = options?.storage || chatGPTTokenStorage;
    this.oauthService = options?.oauthService || chatGPTOAuthService;
    this.model = options?.model || aiConfig.chatgptPlan?.model || undefined;
    this.timeoutMs = options?.timeoutMs || aiConfig.chatgptPlan?.timeoutMs || 30000;
    this.fetchFn = options?.fetchFn || globalThis.fetch;
  }

  /**
   * Hard Billing Safety Invariant:
   * ChatGPT Plan provider operates strictly on user-delegated OAuth plan credentials.
   * Paid AI providers, credit billing, and API keys are permanently forbidden.
   */
  public assertBillingSafety(): void {
    if (aiConfig.allowPaidProvider) {
      throw new AIProviderError(
        'PAID_PROVIDER_REJECTED',
        'ChatGPT Plan provider requires allowPaidProvider to be false. Paid AI usage is forbidden.'
      );
    }
  }

  /**
   * Extracts error details from raw OpenAI responses or SSE stream error payloads.
   */
  private parseOpenAIError(raw: any): { code?: string; message?: string } {
    if (!raw) return {};
    let parsed = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { message: raw };
      }
    }
    if (parsed.error && typeof parsed.error === 'object') {
      return {
        code: parsed.error.code || parsed.error.type,
        message: parsed.error.message,
      };
    }
    if (typeof parsed.error === 'string') {
      return { code: parsed.error, message: parsed.error };
    }
    if (parsed.code) {
      return { code: parsed.code, message: parsed.message };
    }
    return {};
  }

  /**
   * Maps official OpenAI ChatGPT plan error codes to normalized DigiSkwela AIProviderError.
   * Strictly enforces billing safety and stops inference immediately on exhaustion.
   */
  private mapOpenAIError(status: number, errorDetails: { code?: string; message?: string }): AIProviderError {
    const code = errorDetails.code;
    const msg = errorDetails.message;

    // 1. Quota / Usage Limit Exceeded (NO RETRY, STOP INFERENCE, NEVER SWITCH TO PAID API)
    if (code === 'subscription_sharing_usage_limit_exceeded' || status === 429) {
      return new AIProviderError(
        'FREE_QUOTA_EXHAUSTED',
        'Your ChatGPT plan usage limit has been reached for this time window. Manage usage in ChatGPT Settings or try again later.',
        false
      );
    }

    // 2. User Not Eligible for Plan Sharing (STOP INFERENCE, REPORT ELIGIBILITY RESTRICTION)
    if (code === 'subscription_sharing_user_not_eligible') {
      return new AIProviderError(
        'PROVIDER_UNAVAILABLE',
        'The connected ChatGPT account is not eligible for plan sharing. A ChatGPT Plus, Team, or Pro plan is required.',
        false
      );
    }

    // 3. Usage Evaluation Temporarily Unavailable (ELIGIBLE FOR BOUNDED RETRY ONLY)
    if (code === 'subscription_sharing_usage_unavailable') {
      return new AIProviderError(
        'PROVIDER_UNAVAILABLE',
        'ChatGPT plan usage is temporarily unavailable from OpenAI. Please try again shortly.',
        true // eligible for internal bounded retry
      );
    }

    // 4. Revocation / Expiration
    if (status === 401 || code === 'invalid_token') {
      return new AIProviderError(
        'PROVIDER_UNAVAILABLE',
        'ChatGPT authorization expired or revoked. Please sign in again.',
        false
      );
    }

    // 5. Upstream Service Unavailable
    if (status === 503) {
      return new AIProviderError(
        'PROVIDER_UNAVAILABLE',
        'ChatGPT plan usage is temporarily unavailable. Please retry later.',
        true
      );
    }

    return new AIProviderError(
      'INVALID_PROVIDER_RESPONSE',
      `ChatGPT Plan API error (${status}): ${msg || code || 'Unknown error'}`,
      status >= 500
    );
  }

  /**
   * Discovers available models for the authenticated ChatGPT account.
   */
  public async discoverModels(): Promise<ChatGPTDiscoveredModel[]> {
    const accessToken = await this.getValidAccessToken();

    try {
      const res = await this.fetchFn(this.modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        throw new AIProviderError(
          'PROVIDER_UNAVAILABLE',
          `Failed to fetch ChatGPT model catalog: HTTP ${res.status}`
        );
      }

      const body: any = await res.json();
      const rawList: any[] = Array.isArray(body?.models)
        ? body.models
        : Array.isArray(body?.data)
          ? body.data
          : [];

      const discovered: ChatGPTDiscoveredModel[] = rawList
        .filter(m => !m.visibility || m.visibility === 'list')
        .map(m => ({
          slug: m.slug || m.id,
          displayName: m.display_name || m.name || m.slug || m.id,
          visibility: m.visibility,
        }));

      return discovered;
    } catch (err: any) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError('PROVIDER_UNAVAILABLE', `Model discovery failed: ${err.message}`);
    }
  }

  /**
   * Resolves a valid access token, refreshing if needed.
   */
  private async getValidAccessToken(): Promise<string> {
    const creds = this.storage.loadCredentials();
    if (!creds || !creds.accessToken) {
      throw new AIProviderError(
        'FREE_QUOTA_EXHAUSTED',
        'No active ChatGPT plan session found. Please sign in with ChatGPT.'
      );
    }

    // Check scope
    if (!creds.scope || !creds.scope.includes('chatgpt.tokens.use.direct')) {
      throw new AIProviderError(
        'FREE_QUOTA_EXHAUSTED',
        'ChatGPT plan inference is not authorized (missing chatgpt.tokens.use.direct scope).'
      );
    }

    // Refresh if expired or within 60s of expiration
    const now = Date.now();
    if (creds.expiresAt - now < 60000 && creds.refreshToken) {
      const refreshResult = await this.oauthService.refreshAccessToken();
      if (!refreshResult.success) {
        throw new AIProviderError(
          'PROVIDER_UNAVAILABLE',
          `Token refresh failed: ${refreshResult.error}. Please re-authenticate.`,
          false
        );
      }
      const refreshed = this.storage.loadCredentials();
      return refreshed!.accessToken;
    }

    if (creds.expiresAt <= now) {
      throw new AIProviderError(
        'PROVIDER_UNAVAILABLE',
        'ChatGPT session has expired. Please sign in again.',
        false
      );
    }

    return creds.accessToken;
  }

  /**
   * Formats tool declarations into flattened Responses API function schema.
   */
  private formatTools(declarations?: AIToolDeclaration[]) {
    if (!declarations || declarations.length === 0) return undefined;
    return declarations.map(d => ({
      type: 'function' as const,
      name: d.name,
      description: d.description,
      parameters: d.parameters,
    }));
  }

  /**
   * Sanitizes internal call IDs to strictly adhere to OpenAI Responses API's <= 64 char string constraint.
   */
  private toSafeWireCallId(rawId: string): string {
    if (!rawId) return 'call_default';
    if (rawId.length <= 48) return rawId;
    const hash = crypto.createHash('sha256').update(rawId).digest('hex').slice(0, 16);
    const suffix = rawId.split('_').pop() || '0';
    return `call_${hash}_${suffix}`.slice(0, 48);
  }

  /**
   * Maps DigiSkwela conversation messages into the Responses API `input` item structure.
   */
  private formatInputItems(messages: AIMessage[]): { instructions?: string; input: any[] } {
    let instructions: string | undefined = undefined;
    const inputItems: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Responses API uses top-level 'instructions' for system guidance
        instructions = instructions ? `${instructions}\n\n${msg.content}` : msg.content;
        continue;
      }

      if (msg.role === 'user') {
        inputItems.push({
          role: 'user',
          content: msg.content,
        });
        continue;
      }

      if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          // Model function_call items
          for (const tc of msg.toolCalls) {
            const wireCallId = this.toSafeWireCallId(tc.id);
            inputItems.push({
              type: 'function_call',
              id: `fc_${wireCallId}`.slice(0, 64),
              call_id: wireCallId,
              name: tc.name,
              arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
            });
          }
        } else if (msg.content) {
          inputItems.push({
            role: 'assistant',
            content: msg.content,
          });
        }
        continue;
      }

      if (msg.role === 'tool') {
        const rawCallId = msg.toolCallId || 'call_0';
        const wireCallId = this.toSafeWireCallId(rawCallId);
        const toolName = msg.name || 'unspecified_tool';
        const hasMatchingCall = inputItems.some(item => item.type === 'function_call' && item.call_id === wireCallId);

        if (!hasMatchingCall) {
          // Wire protocol normalization: OpenAI Responses API requires every function_call_output
          // to be preceded by a corresponding function_call item in input.
          inputItems.push({
            type: 'function_call',
            id: `fc_${wireCallId}`.slice(0, 64),
            call_id: wireCallId,
            name: toolName,
            arguments: '{}',
          });
        }

        // Function output item matching call_id
        inputItems.push({
          type: 'function_call_output',
          call_id: wireCallId,
          output: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        });
      }
    }

    return { instructions, input: inputItems };
  }

  /**
   * Main generation entrypoint
   */
  public async generateResponse(request: AICompletionRequest): Promise<AICompletionResponse> {
    this.assertBillingSafety();
    const accessToken = await this.getValidAccessToken();

    // 1. Resolve model: configured slug, or discover
    let activeModel = this.model;
    if (!activeModel) {
      const catalog = await this.discoverModels();
      if (catalog.length === 0) {
        throw new AIProviderError(
          'PROVIDER_UNAVAILABLE',
          'No models returned from ChatGPT account catalog.'
        );
      }
      activeModel = catalog[0].slug;
      this.model = activeModel;
    }

    // 2. Prepare payload conforming to Responses API ChatGPT Plan contract
    const { instructions, input } = this.formatInputItems(request.messages);
    const formattedTools = this.formatTools(request.tools);

    const payload: ChatGPTResponsesRequestPayload = {
      model: activeModel,
      store: false, // Mandatory
      stream: true, // Mandatory
      input,
    };

    if (instructions) {
      payload.instructions = instructions;
    }

    if (formattedTools && formattedTools.length > 0) {
      payload.tools = formattedTools;
    }

    // 3. Execute with bounded retry
    // OpenAI guidance: brief retry on subscription_sharing_usage_unavailable, max 2 attempts total, then stop.
    const maxAttempts = 2;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        return await this.executeSingleStreamRequest(accessToken, payload);
      } catch (err: any) {
        const isUsageUnavailable =
          err instanceof AIProviderError &&
          err.isRetryable &&
          err.message.includes('temporarily unavailable');

        if (isUsageUnavailable && attempt < maxAttempts) {
          // Bounded backoff delay before single retry
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        // Once exhausted or for any non-retryable error, stop inference permanently
        if (err instanceof AIProviderError) {
          throw new AIProviderError(err.code, err.message, false);
        }
        throw err;
      }
    }

    throw new AIProviderError(
      'PROVIDER_UNAVAILABLE',
      'ChatGPT plan usage is temporarily unavailable. Bounded retry exhausted.',
      false
    );
  }

  /**
   * Executes a single SSE streaming request to the Responses API.
   */
  private async executeSingleStreamRequest(
    accessToken: string,
    payload: ChatGPTResponsesRequestPayload
  ): Promise<AICompletionResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchFn(this.responsesUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new AIProviderError(
          'PROVIDER_TIMEOUT',
          `ChatGPT Plan request timed out after ${this.timeoutMs}ms.`,
          true
        );
      }
      throw new AIProviderError('PROVIDER_UNAVAILABLE', `ChatGPT Plan network error: ${err.message}`, true);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      let errText = '';
      try {
        errText = await res.text();
      } catch {
        // ignore
      }

      const parsed = this.parseOpenAIError(errText);
      throw this.mapOpenAIError(res.status, parsed);
    }

    // Consume SSE stream
    return await this.consumeResponsesStream(res);
  }

  /**
   * Consumes and parses the Server-Sent Events stream from the Responses API.
   */
  private async consumeResponsesStream(res: Response): Promise<AICompletionResponse> {
    const rawText = await res.text();
    const lines = rawText.split(/\r?\n/);

    let accumulatedContent = '';
    const collectedToolCalls: AIToolCall[] = [];
    let usage: any = undefined;
    let completedResponse: any = undefined;

    let currentEvent = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
        continue;
      }

      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') break;

        let data: any;
        try {
          data = JSON.parse(dataStr);
        } catch {
          continue;
        }

        // Check for error events in SSE stream
        if (currentEvent === 'error' || currentEvent === 'response.failed' || data?.error || data?.response?.error) {
          const rawErr = data?.error || data?.response?.error || data;
          const details = this.parseOpenAIError(rawErr);
          throw this.mapOpenAIError(400, details);
        }

        // Handle incremental text deltas
        if (currentEvent === 'response.output_text.delta' || currentEvent === 'response.text.delta') {
          if (typeof data?.delta === 'string') {
            accumulatedContent += data.delta;
          }
        }

        // Handle streaming completed output items (e.g. function_call or message)
        if (currentEvent === 'response.output_item.done' || data?.type === 'response.output_item.done') {
          const item = data?.item;
          if (item?.type === 'function_call') {
            let args: Record<string, any> = {};
            try {
              args = typeof item.arguments === 'string' ? JSON.parse(item.arguments) : item.arguments || {};
            } catch {
              args = {};
            }
            const callId = item.call_id || item.id || `call_${Date.now()}`;
            if (!collectedToolCalls.some(tc => tc.id === callId)) {
              collectedToolCalls.push({
                id: callId,
                name: item.name,
                arguments: args,
              });
            }
          } else if (item?.type === 'message' && Array.isArray(item?.content)) {
            for (const part of item.content) {
              if (part?.type === 'output_text' && part?.text && !accumulatedContent) {
                accumulatedContent = part.text;
              }
            }
          }
        }

        // Handle response.completed final aggregate
        if (currentEvent === 'response.completed' || data?.type === 'response.completed') {
          completedResponse = data.response || data;
        }
      }
    }

    // If response.completed provided aggregate output items, extract from it
    if (completedResponse) {
      if (completedResponse.usage) {
        usage = {
          promptTokens: completedResponse.usage.input_tokens || completedResponse.usage.prompt_tokens || 0,
          completionTokens: completedResponse.usage.output_tokens || completedResponse.usage.completion_tokens || 0,
          totalTokens: completedResponse.usage.total_tokens || 0,
        };
      }

      if (Array.isArray(completedResponse.output)) {
        for (const item of completedResponse.output) {
          if (item.type === 'message' && Array.isArray(item.content)) {
            for (const part of item.content) {
              if (part.type === 'output_text' && part.text) {
                if (!accumulatedContent) accumulatedContent = part.text;
              }
            }
          }

          if (item.type === 'function_call') {
            let args: Record<string, any> = {};
            try {
              args = typeof item.arguments === 'string' ? JSON.parse(item.arguments) : item.arguments || {};
            } catch {
              args = {};
            }
            collectedToolCalls.push({
              id: item.call_id || item.id || `call_${Date.now()}`,
              name: item.name,
              arguments: args,
            });
          }
        }
      }
    }

    const hasToolCalls = collectedToolCalls.length > 0;
    return {
      message: {
        role: 'assistant',
        content: accumulatedContent,
        toolCalls: hasToolCalls ? collectedToolCalls : undefined,
      },
      toolCalls: hasToolCalls ? collectedToolCalls : undefined,
      usage,
      finishReason: hasToolCalls ? 'tool_calls' : 'stop',
    };
  }
}
