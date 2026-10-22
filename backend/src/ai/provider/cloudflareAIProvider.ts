import { 
  DigiSkwelaAIProvider, 
  AICompletionRequest, 
  AICompletionResponse, 
  AIToolCall,
  AIProviderError 
} from './aiProvider.interface.js';
import { DIGISKWELA_SYSTEM_PROMPT } from './groqAIProvider.js';
import { aiConfig } from '../../config/ai.config.js';

export interface CloudflareProviderOptions {
  accountId?: string;
  apiToken?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * CloudflareAIProvider — Backend-only Provider Adapter for Cloudflare Workers AI
 * 
 * Free-Tier Invariants:
 * - Uses Cloudflare Workers AI Free Tier (model: @cf/openai/gpt-oss-120b).
 * - Zero paid fallback; rate limit or quota exhaustion returns clean free-tier limit state.
 * - Local function tool-calling only; all built-in tools disabled.
 * - Server-side authorization & DTO minimization precede all model data ingestion.
 * - Zero provider secrets or raw responses leaked to the frontend.
 */
export class CloudflareAIProvider implements DigiSkwelaAIProvider {
  public readonly name = 'CloudflareAIProvider';
  public readonly mode = 'cloudflare' as const;

  public readonly accountId?: string;
  private readonly apiToken?: string;
  public readonly model: string;
  public readonly temperature: number;
  public readonly maxTokens: number;
  public readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options?: CloudflareProviderOptions) {
    this.accountId = options && 'accountId' in options ? options.accountId : aiConfig.cloudflare.accountId;
    this.apiToken = options && 'apiToken' in options ? options.apiToken : aiConfig.cloudflare.apiToken;
    this.model = options?.model || aiConfig.cloudflare.model || '@cf/openai/gpt-oss-120b';
    this.temperature = options?.temperature ?? aiConfig.cloudflare.temperature ?? 0.2;
    this.maxTokens = options?.maxTokens ?? aiConfig.cloudflare.maxTokens ?? 1500;
    this.timeoutMs = options?.timeoutMs ?? aiConfig.cloudflare.timeoutMs ?? 15000;
    this.fetchFn = options?.fetchFn || globalThis.fetch;
  }

  async generateResponse(request: AICompletionRequest): Promise<AICompletionResponse> {
    // 1. Enforce Free-Tier Policy: Verify account ID & token availability
    if (!this.accountId) {
      throw new AIProviderError(
        'PROVIDER_UNAVAILABLE',
        'CLOUDFLARE_ACCOUNT_ID is not configured in the backend environment. Cloudflare provider cannot be invoked without a valid account ID.',
        false
      );
    }

    if (!this.apiToken) {
      throw new AIProviderError(
        'PROVIDER_UNAVAILABLE',
        'CLOUDFLARE_API_TOKEN is not configured in the backend environment. Cloudflare provider cannot be invoked without a valid free-tier API token.',
        false
      );
    }

    // 2. Format Messages with Authoritative System Prompt
    const cfMessages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string | null;
      tool_call_id?: string;
      name?: string;
      tool_calls?: any[];
    }> = [
      { role: 'system', content: DIGISKWELA_SYSTEM_PROMPT }
    ];

    for (const msg of request.messages) {
      if (msg.role === 'tool') {
        cfMessages.push({
          role: 'tool',
          tool_call_id: msg.toolCallId || 'call_0',
          name: msg.name,
          content: msg.content,
        });
      } else if (msg.role === 'assistant') {
        const toolCallsFormatted = msg.toolCalls && msg.toolCalls.length > 0
          ? msg.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments || {})
              }
            }))
          : undefined;

        cfMessages.push({
          role: 'assistant',
          content: msg.content || (toolCallsFormatted ? null : ''),
          tool_calls: toolCallsFormatted,
        });
      } else if (msg.role === 'user') {
        cfMessages.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.role === 'system') {
        cfMessages.push({
          role: 'system',
          content: msg.content,
        });
      }
    }

    // 3. Format Tool Declarations (Function Tools Only — Zero Built-in Tools)
    const formattedTools = (request.tools || []).map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/v1/chat/completions`;
    const payload: any = {
      model: this.model,
      messages: cfMessages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    };

    if (formattedTools.length > 0) {
      payload.tools = formattedTools;
      payload.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let res: Response;
      try {
        res = await this.fetchFn(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          throw new AIProviderError(
            'PROVIDER_TIMEOUT',
            `Cloudflare request timed out after ${this.timeoutMs}ms.`,
            true
          );
        }
        if (fetchErr.code === 'ECONNREFUSED' || fetchErr.code === 'ENOTFOUND') {
          throw new AIProviderError(
            'PROVIDER_UNAVAILABLE',
            'Cloudflare upstream service is currently unreachable.',
            true
          );
        }
        throw fetchErr;
      }

      if (!res.ok) {
        let errBodyText = '';
        try {
          errBodyText = await res.text();
        } catch {
          errBodyText = '';
        }

        const lowerErr = errBodyText.toLowerCase();

        // 429 Too Many Requests or Free Quota Exceeded
        if (res.status === 429 || lowerErr.includes('rate limit') || lowerErr.includes('quota') || lowerErr.includes('exceeded limit')) {
          throw new AIProviderError(
            'RATE_LIMITED',
            'Cloudflare Free Tier rate limit or quota reached.',
            true
          );
        }

        // Timeout upstream
        if (res.status === 408 || res.status === 504 || lowerErr.includes('timeout')) {
          throw new AIProviderError(
            'PROVIDER_TIMEOUT',
            `Cloudflare request timed out after ${this.timeoutMs}ms.`,
            true
          );
        }

        // Service Unavailable or bad gateway
        if (res.status === 502 || res.status === 503) {
          throw new AIProviderError(
            'PROVIDER_UNAVAILABLE',
            'Cloudflare upstream service is currently unreachable.',
            true
          );
        }

        // Authentication failure
        if (res.status === 401 || res.status === 403) {
          throw new AIProviderError(
            'UNKNOWN_ERROR',
            'Cloudflare authentication error. Please verify backend CLOUDFLARE_API_TOKEN configuration.',
            false
          );
        }

        // Malformed request
        if (res.status === 400) {
          throw new AIProviderError(
            'INVALID_PROVIDER_RESPONSE',
            `Cloudflare returned 400 Bad Request: ${errBodyText.slice(0, 200)}`,
            false
          );
        }

        throw new AIProviderError(
          'INVALID_PROVIDER_RESPONSE',
          `Cloudflare provider call failed with status ${res.status}: ${errBodyText.slice(0, 200)}`,
          false
        );
      }

      const data = (await res.json()) as any;
      const choice = data.choices?.[0];

      if (!choice || !choice.message) {
        throw new AIProviderError(
          'INVALID_PROVIDER_RESPONSE',
          'Cloudflare returned an empty or malformed completion choice.',
          false
        );
      }

      const toolCalls: AIToolCall[] = [];
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        for (const tc of choice.message.tool_calls) {
          if (tc.type === 'function' && tc.function) {
            let parsedArgs = {};
            try {
              parsedArgs = typeof tc.function.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : (tc.function.arguments || {});
            } catch {
              parsedArgs = {};
            }
            toolCalls.push({
              id: tc.id || `call_${toolCalls.length}`,
              name: tc.function.name,
              arguments: parsedArgs,
            });
          }
        }
      }

      return {
        message: {
          role: 'assistant',
          content: choice.message.content || '',
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        } : undefined,
      };

    } catch (err: any) {
      if (err instanceof AIProviderError) {
        throw err;
      }
      throw new AIProviderError(
        'INVALID_PROVIDER_RESPONSE',
        `Cloudflare provider call failed: ${err.message || 'Unknown error'}`,
        false
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
