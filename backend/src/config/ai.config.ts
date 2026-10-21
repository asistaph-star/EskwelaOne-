/**
 * DigiSkwela AI Configuration
 * 
 * Free-Tier AI Policy:
 * - Paid AI APIs are strictly forbidden by default.
 * - AI_ALLOW_PAID_PROVIDER must remain false unless explicitly authorized.
 * - Runtime limits are configurable, tunable safe defaults.
 */

export interface AIConfig {
  providerMode: 'mock' | 'groq' | 'disabled';
  allowPaidProvider: boolean;
  limits: {
    maxTurns: number;
    rateLimitPerMinute: number;
    rateLimitPerDay: number;
    maxPromptLength: number;
    maxResponseTokens: number;
    maxToolCallsPerTurn: number;
    toolTimeoutMs: number;
    maxToolResults: number;
    providerTimeoutMs: number;
  };
}

export const aiConfig: AIConfig = {
  // Provider mode: 'mock' (default for testing), 'groq' (future free-tier candidate), 'disabled'
  providerMode: (process.env.AI_PROVIDER_MODE as any) || 'mock',

  // HARD BILLING POLICY: Paid AI usage is forbidden.
  allowPaidProvider: process.env.AI_ALLOW_PAID_PROVIDER === 'true',

  // Configurable runtime boundaries
  limits: {
    maxTurns: parseInt(process.env.AI_MAX_TURNS || '10', 10),
    rateLimitPerMinute: parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE || '10', 10),
    rateLimitPerDay: parseInt(process.env.AI_RATE_LIMIT_PER_DAY || '100', 10),
    maxPromptLength: parseInt(process.env.AI_MAX_PROMPT_LENGTH || '2000', 10),
    maxResponseTokens: parseInt(process.env.AI_MAX_RESPONSE_TOKENS || '1500', 10),
    maxToolCallsPerTurn: parseInt(process.env.AI_MAX_TOOL_CALLS_PER_TURN || '3', 10),
    toolTimeoutMs: parseInt(process.env.AI_TOOL_TIMEOUT_MS || '5000', 10),
    maxToolResults: parseInt(process.env.AI_MAX_TOOL_RESULTS || '50', 10),
    providerTimeoutMs: parseInt(process.env.AI_PROVIDER_TIMEOUT_MS || '10000', 10),
  },
};
