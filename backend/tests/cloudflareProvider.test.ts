import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudflareAIProvider } from '../src/ai/provider/cloudflareAIProvider.js';
import { getAIProvider } from '../src/ai/provider/aiProvider.factory.js';
import { aiConfig } from '../src/config/ai.config.js';
import { AIProviderError, AIToolDeclaration } from '../src/ai/provider/aiProvider.interface.js';

describe('DIGISKWELA — CLOUDFLARE WORKERS AI PROVIDER ADAPTER', () => {
  const originalMode = aiConfig.providerMode;
  const originalAccountId = aiConfig.cloudflare.accountId;
  const originalApiToken = aiConfig.cloudflare.apiToken;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    aiConfig.providerMode = originalMode;
    aiConfig.cloudflare.accountId = originalAccountId;
    aiConfig.cloudflare.apiToken = originalApiToken;
  });

  // ─── 1. Provider Contract & Identity ─────────────────────────────────────
  it('TC-CF-01: CloudflareAIProvider implements DigiSkwelaAIProvider contract', () => {
    const provider = new CloudflareAIProvider({
      accountId: 'test_account_id',
      apiToken: 'test_api_token',
      model: '@cf/openai/gpt-oss-120b',
    });

    expect(provider.name).toBe('CloudflareAIProvider');
    expect(provider.mode).toBe('cloudflare');
    expect(provider.model).toBe('@cf/openai/gpt-oss-120b');
    expect(typeof provider.generateResponse).toBe('function');
  });

  // ─── 2. Configuration Validation ─────────────────────────────────────────
  it('TC-CF-02: Throws PROVIDER_UNAVAILABLE if account ID is missing', async () => {
    const provider = new CloudflareAIProvider({
      accountId: undefined,
      apiToken: 'test_token',
    });

    await expect(provider.generateResponse({
      messages: [{ role: 'user', content: 'Hello' }]
    })).rejects.toThrow(AIProviderError);

    try {
      await provider.generateResponse({ messages: [{ role: 'user', content: 'Hello' }] });
    } catch (err: any) {
      expect(err.code).toBe('PROVIDER_UNAVAILABLE');
      expect(err.message).toContain('CLOUDFLARE_ACCOUNT_ID');
      expect(err.isRetryable).toBe(false);
    }
  });

  it('TC-CF-03: Throws PROVIDER_UNAVAILABLE if API token is missing', async () => {
    const provider = new CloudflareAIProvider({
      accountId: 'test_account_id',
      apiToken: undefined,
    });

    await expect(provider.generateResponse({
      messages: [{ role: 'user', content: 'Hello' }]
    })).rejects.toThrow(AIProviderError);

    try {
      await provider.generateResponse({ messages: [{ role: 'user', content: 'Hello' }] });
    } catch (err: any) {
      expect(err.code).toBe('PROVIDER_UNAVAILABLE');
      expect(err.message).toContain('CLOUDFLARE_API_TOKEN');
      expect(err.isRetryable).toBe(false);
    }
  });

  // ─── 3. Direct Conversational Completion ─────────────────────────────────
  it('TC-CF-04: Successfully completes conversational request and normalizes usage', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'cf_resp_001',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Good morning, Principal. Five faculty members are currently checked in.',
            },
            finish_reason: 'stop',
          }
        ],
        usage: {
          prompt_tokens: 45,
          completion_tokens: 15,
          total_tokens: 60,
        }
      }),
    });

    const provider = new CloudflareAIProvider({
      accountId: 'cf_acc_123',
      apiToken: 'cf_tok_abc',
      fetchFn: mockFetch as any,
    });

    const response = await provider.generateResponse({
      messages: [{ role: 'user', content: 'How many faculty are checked in?' }]
    });

    expect(response.message.role).toBe('assistant');
    expect(response.message.content).toBe('Good morning, Principal. Five faculty members are currently checked in.');
    expect(response.finishReason).toBe('stop');
    expect(response.usage).toEqual({
      promptTokens: 45,
      completionTokens: 15,
      totalTokens: 60,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ─── 4. Tool / Function Calling ──────────────────────────────────────────
  it('TC-CF-05: Emits structured tool calls when model selects authoritative tool', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'cf_resp_002',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_cf_01',
                  type: 'function',
                  function: {
                    name: 'getFacultyAttendanceAudit',
                    arguments: JSON.stringify({ date: '2026-10-22' }),
                  }
                }
              ]
            },
            finish_reason: 'tool_calls',
          }
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }
      }),
    });

    const provider = new CloudflareAIProvider({
      accountId: 'cf_acc_123',
      apiToken: 'cf_tok_abc',
      fetchFn: mockFetch as any,
    });

    const tools: AIToolDeclaration[] = [
      {
        id: 'tool_audit',
        name: 'getFacultyAttendanceAudit',
        description: 'Audit faculty gate attendance against approved leaves',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD' }
          }
        }
      }
    ];

    const response = await provider.generateResponse({
      messages: [{ role: 'user', content: 'Check faculty attendance.' }],
      tools,
    });

    expect(response.finishReason).toBe('tool_calls');
    expect(response.toolCalls).toBeDefined();
    expect(response.toolCalls?.length).toBe(1);
    expect(response.toolCalls?.[0]).toEqual({
      id: 'call_cf_01',
      name: 'getFacultyAttendanceAudit',
      arguments: { date: '2026-10-22' },
    });
  });

  // ─── 5. Error Mapping & Hierarchy ────────────────────────────────────────
  it('TC-CF-06: Maps 429 status or quota message to RATE_LIMITED (isRetryable = true)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded: Workers AI daily neuron limit reached',
    });

    const provider = new CloudflareAIProvider({
      accountId: 'cf_acc_123',
      apiToken: 'cf_tok_abc',
      fetchFn: mockFetch as any,
    });

    try {
      await provider.generateResponse({ messages: [{ role: 'user', content: 'Hello' }] });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect(err.code).toBe('RATE_LIMITED');
      expect(err.isRetryable).toBe(true);
    }
  });

  it('TC-CF-07: Maps 502/503 service unavailable to PROVIDER_UNAVAILABLE (isRetryable = true)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Cloudflare Workers AI temporarily unavailable',
    });

    const provider = new CloudflareAIProvider({
      accountId: 'cf_acc_123',
      apiToken: 'cf_tok_abc',
      fetchFn: mockFetch as any,
    });

    try {
      await provider.generateResponse({ messages: [{ role: 'user', content: 'Hello' }] });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect(err.code).toBe('PROVIDER_UNAVAILABLE');
      expect(err.isRetryable).toBe(true);
    }
  });

  it('TC-CF-08: Maps 401/403 authentication error to UNKNOWN_ERROR (isRetryable = false)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid authentication token',
    });

    const provider = new CloudflareAIProvider({
      accountId: 'cf_acc_123',
      apiToken: 'cf_tok_abc',
      fetchFn: mockFetch as any,
    });

    try {
      await provider.generateResponse({ messages: [{ role: 'user', content: 'Hello' }] });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect(err.code).toBe('UNKNOWN_ERROR');
      expect(err.isRetryable).toBe(false);
    }
  });

  it('TC-CF-09: Factory resolves CloudflareAIProvider when AI_PROVIDER_MODE=cloudflare', () => {
    aiConfig.providerMode = 'cloudflare';
    aiConfig.cloudflare.accountId = 'test_acc';
    aiConfig.cloudflare.apiToken = 'test_tok';

    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(CloudflareAIProvider);
    expect(provider.mode).toBe('cloudflare');
  });
});
