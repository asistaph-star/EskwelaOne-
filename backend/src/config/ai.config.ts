/**
 * DigiSkwela AI Configuration
 * 
 * Free-Tier AI Policy:
 * - Paid AI APIs are strictly forbidden by default.
 * - AI_ALLOW_PAID_PROVIDER must remain false unless explicitly authorized.
 * - Runtime limits are configurable, tunable safe defaults.
 */

import './env.js';
import { AIProviderMode } from '../ai/provider/aiProvider.interface.js';

export interface AIConfig {
  providerMode: AIProviderMode;
  allowPaidProvider: boolean;
  groq: {
    apiKey?: string;
    model: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  };
  cloudflare: {
    accountId?: string;
    apiToken?: string;
    model: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  };
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
  chatgptPlan?: {
    model?: string;
    timeoutMs: number;
    callbackUrl: string;
  };
}

export const aiConfig: AIConfig = {
  // Provider mode: 'mock' (default for testing), 'groq', 'cloudflare', 'groq_cloudflare', 'disabled'
  providerMode: (process.env.AI_PROVIDER_MODE as AIProviderMode) || 'mock',

  // HARD BILLING POLICY: Paid AI usage is forbidden.
  allowPaidProvider: process.env.AI_ALLOW_PAID_PROVIDER === 'true',

  // Groq Cloud Free Plan Configuration
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.AI_GROQ_MODEL || 'openai/gpt-oss-120b',
    temperature: parseFloat(process.env.AI_GROQ_TEMPERATURE || '0.2'),
    maxTokens: parseInt(process.env.AI_GROQ_MAX_TOKENS || '1500', 10),
    timeoutMs: parseInt(process.env.AI_GROQ_TIMEOUT_MS || '15000', 10),
  },

  // Cloudflare Workers AI Free Plan Configuration
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    model: process.env.CLOUDFLARE_AI_MODEL || '@cf/openai/gpt-oss-120b',
    temperature: parseFloat(process.env.CLOUDFLARE_AI_TEMPERATURE || '0.2'),
    maxTokens: parseInt(process.env.CLOUDFLARE_AI_MAX_TOKENS || '1500', 10),
    timeoutMs: parseInt(process.env.CLOUDFLARE_AI_TIMEOUT_MS || '15000', 10),
  },

  // Configurable runtime boundaries
  limits: {
    maxTurns: parseInt(process.env.AI_MAX_TURNS || '10', 10),
    rateLimitPerMinute: parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE || (process.env.NODE_ENV === 'test' ? '100' : '10'), 10),
    rateLimitPerDay: parseInt(process.env.AI_RATE_LIMIT_PER_DAY || (process.env.NODE_ENV === 'test' ? '500' : '100'), 10),
    maxPromptLength: parseInt(process.env.AI_MAX_PROMPT_LENGTH || '2000', 10),
    maxResponseTokens: parseInt(process.env.AI_MAX_RESPONSE_TOKENS || '1500', 10),
    maxToolCallsPerTurn: parseInt(process.env.AI_MAX_TOOL_CALLS_PER_TURN || '6', 10),
    toolTimeoutMs: parseInt(process.env.AI_TOOL_TIMEOUT_MS || '5000', 10),
    maxToolResults: parseInt(process.env.AI_MAX_TOOL_RESULTS || '50', 10),
    providerTimeoutMs: parseInt(process.env.AI_PROVIDER_TIMEOUT_MS || '10000', 10),
  },
  chatgptPlan: {
    model: process.env.CHATGPT_PLAN_MODEL,
    timeoutMs: parseInt(process.env.CHATGPT_PLAN_TIMEOUT_MS || '30000', 10),
    callbackUrl: process.env.CHATGPT_PLAN_CALLBACK_URL || 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
  },
};

export const SCHOOL_NAME = process.env.SCHOOL_NAME || 'Calulut Integrated School';

