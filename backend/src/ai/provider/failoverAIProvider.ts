import {
  DigiSkwelaAIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
  AIProviderMode
} from './aiProvider.interface.js';
import { GroqAIProvider } from './groqAIProvider.js';
import { CloudflareAIProvider } from './cloudflareAIProvider.js';

export interface FailoverProviderOptions {
  primary?: DigiSkwelaAIProvider;
  secondary?: DigiSkwelaAIProvider;
}

/**
 * Checks whether an error qualifies for controlled provider failover.
 * 
 * ALLOWED:
 * - Rate limit exceeded (429)
 * - Free quota exhausted
 * - Provider unavailable (502, 503, connection dropped)
 * - Provider timeout (request timeout reached)
 * - Explicitly retryable upstream network errors
 * 
 * STRICTLY FORBIDDEN FROM FAILING OVER:
 * - Authentication / configuration failure (401, 403, missing keys)
 * - Scope Guard refusals
 * - RBAC / permission denials
 * - Zod validation errors
 * - Application / business logic errors
 * - Internal programming errors
 */
export function isEligibleForProviderFailover(err: unknown): boolean {
  if (err instanceof AIProviderError) {
    if (
      err.code === 'RATE_LIMITED' ||
      err.code === 'FREE_QUOTA_EXHAUSTED' ||
      err.code === 'PROVIDER_UNAVAILABLE' ||
      err.code === 'PROVIDER_TIMEOUT'
    ) {
      return true;
    }
    // Only failover if explicitly marked as retryable upstream error
    return Boolean(err.isRetryable);
  }
  return false;
}

/**
 * FailoverAIProvider — Controlled Free-Tier Provider Chain
 * 
 * Primary: Groq (openai/gpt-oss-120b)
 * Secondary: Cloudflare Workers AI (@cf/openai/gpt-oss-120b)
 * Terminal: Normalized AI Unavailable Response
 * 
 * Strictly preserves:
 * - Single-chain execution (no circular failover loops)
 * - Zero automatic paid fallback or credit purchases
 * - Zero MockAIProvider fallback in live runtime mode
 * - Authorization, RBAC, Scope Guard, and Data Minimization
 */
export class FailoverAIProvider implements DigiSkwelaAIProvider {
  public readonly name = 'FailoverAIProvider(Groq->Cloudflare)';
  public readonly mode: AIProviderMode = 'groq_cloudflare';

  public readonly primary: DigiSkwelaAIProvider;
  public readonly secondary: DigiSkwelaAIProvider;

  constructor(options?: FailoverProviderOptions) {
    this.primary = options?.primary || new GroqAIProvider();
    this.secondary = options?.secondary || new CloudflareAIProvider();
  }

  get model(): string {
    return this.primary.model || 'openai/gpt-oss-120b';
  }

  async generateResponse(request: AICompletionRequest): Promise<AICompletionResponse> {
    // 1. Attempt Primary Provider (Groq)
    try {
      const response = await this.primary.generateResponse(request);

      return {
        ...response,
        failoverMetadata: {
          occurred: false,
          primaryProvider: this.primary.name,
          finalProvider: this.primary.name,
          model: this.primary.model,
        },
      };
    } catch (primaryErr: any) {
      // 2. Evaluate Eligibility for Failover
      if (!isEligibleForProviderFailover(primaryErr)) {
        // DO NOT FAIL OVER for authentication errors, invalid configs, or non-availability errors
        throw primaryErr;
      }

      const failoverReason = primaryErr instanceof AIProviderError ? primaryErr.code : 'PROVIDER_UNAVAILABLE';

      // 3. Attempt Secondary Provider (Cloudflare Workers AI)
      try {
        const secondaryResponse = await this.secondary.generateResponse(request);

        return {
          ...secondaryResponse,
          failoverMetadata: {
            occurred: true,
            primaryProvider: this.primary.name,
            finalProvider: this.secondary.name,
            reason: failoverReason,
            model: this.secondary.model,
          },
        };
      } catch (secondaryErr: any) {
        // 4. Maximum Chain Reached: Both providers failed.
        // Strictly terminate chain: NEVER loop back, NEVER fallback to mock.
        if (secondaryErr instanceof AIProviderError) {
          throw secondaryErr;
        }

        throw new AIProviderError(
          'PROVIDER_UNAVAILABLE',
          `Primary provider (${this.primary.name}) failed with ${failoverReason}, and secondary provider (${this.secondary.name}) also failed.`,
          true
        );
      }
    }
  }
}
