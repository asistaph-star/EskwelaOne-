import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import prisma from '../src/config/database.js';
import { GroqAIProvider } from '../src/ai/provider/groqAIProvider.js';
import { getAIProvider } from '../src/ai/provider/aiProvider.factory.js';
import { aiConfig } from '../src/config/ai.config.js';
import { AIProviderError, AIToolDeclaration } from '../src/ai/provider/aiProvider.interface.js';
import { AIService } from '../src/ai/ai.service.js';
import { AuthenticatedUser } from '../src/common/middleware/auth.js';

describe('DIGISKWELA — MILESTONE 3 PHASE E: GROQ FREE-TIER PROVIDER ADAPTER', () => {
  const originalProviderMode = aiConfig.providerMode;
  const originalApiKey = aiConfig.groq.apiKey;
  const originalAllowPaid = aiConfig.allowPaidProvider;
  let principalUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.findFirst({ where: { email: 'principal@demo.com' } });
    if (user) {
      principalUserId = user.id;
    } else {
      const created = await prisma.user.create({
        data: {
          id: 'usr_prin_groq_test',
          email: 'principal_test@demo.com',
          password_hash: 'hashed',
          first_name: 'Principal',
          last_name: 'Test',
          status: 'active',
        },
      });
      principalUserId = created.id;
    }
  });

  afterAll(async () => {
    await prisma.aIAuditLog.deleteMany({ where: { user_id: principalUserId } });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    aiConfig.providerMode = originalProviderMode;
    aiConfig.groq.apiKey = originalApiKey;
    aiConfig.allowPaidProvider = originalAllowPaid;
  });

  // ─── 1. Provider Contract & Identity ─────────────────────────────────────
  it('TC-GROQ-01: GroqAIProvider implements DigiSkwelaAIProvider interface', () => {
    const provider = new GroqAIProvider({ apiKey: 'gsk_test_mock_key_123' });

    expect(provider.name).toBe('GroqAIProvider');
    expect(provider.mode).toBe('groq');
    expect(typeof provider.generateResponse).toBe('function');
    expect(provider.model).toBe('openai/gpt-oss-120b');
    expect(provider.temperature).toBe(0.2);
  });

  // ─── 2. Provider Factory Selection ───────────────────────────────────────
  it('TC-GROQ-02: aiProvider.factory resolves GroqAIProvider only when mode is "groq"', () => {
    // Mode: mock
    aiConfig.providerMode = 'mock';
    const mockProvider = getAIProvider();
    expect(mockProvider.mode).toBe('mock');

    // Mode: groq
    aiConfig.providerMode = 'groq';
    aiConfig.groq.apiKey = 'gsk_test_factory_key';
    const groqProvider = getAIProvider();
    expect(groqProvider.mode).toBe('groq');
    expect(groqProvider.name).toBe('GroqAIProvider');

    // Mode: disabled
    aiConfig.providerMode = 'disabled';
    expect(() => getAIProvider()).toThrowError(/disabled by administrative policy/);

    // Mode: unauthorized / paid mode (e.g., 'openai-paid')
    aiConfig.providerMode = 'openai-paid' as any;
    aiConfig.allowPaidProvider = false;
    expect(() => getAIProvider()).toThrowError(/Paid AI providers and automatic paid upgrades are forbidden/);
  });

  // ─── 3. Missing API Key Guard ────────────────────────────────────────────
  it('TC-GROQ-03: Missing GROQ_API_KEY throws safe PROVIDER_UNAVAILABLE error without crash', async () => {
    delete (aiConfig.groq as any).apiKey;
    const provider = new GroqAIProvider({ apiKey: undefined });

    await expect(provider.generateResponse({
      messages: [{ role: 'user', content: 'What is the attendance today?' }]
    })).rejects.toThrowError(AIProviderError);

    try {
      await provider.generateResponse({
        messages: [{ role: 'user', content: 'Hello' }]
      });
    } catch (err: any) {
      expect(err.code).toBe('PROVIDER_UNAVAILABLE');
      expect(err.message).toContain('GROQ_API_KEY is not configured');
    }
  });

  // ─── 4. Tool Declarations Formatting (Local Functions Only) ──────────────
  it('TC-GROQ-04: Tool declarations are translated strictly to function tools without built-in browser or code tools', async () => {
    let capturedCreateArgs: any = null;

    const mockClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation((args: any) => {
            capturedCreateArgs = args;
            return Promise.resolve({
              id: 'chatcmpl_mock_1',
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: 'Verified test response',
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: { prompt_tokens: 30, completion_tokens: 15, total_tokens: 45 },
            });
          }),
        },
      },
    };

    const provider = new GroqAIProvider({ client: mockClient, apiKey: 'gsk_test' });

    const tools: AIToolDeclaration[] = [
      {
        id: 'PRIN-AI-01',
        name: 'getSchoolOperationalFactSheet',
        description: 'Authoritative operational fact sheet',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
      },
      {
        id: 'PRIN-AI-02',
        name: 'getFacultyAttendanceAudit',
        description: 'Faculty attendance audit',
        parameters: {
          type: 'object',
          properties: {
            statusFilter: { type: 'string', enum: ['ALL', 'COMPLETED'] },
          },
          required: [],
          additionalProperties: false,
        },
      },
    ];

    await provider.generateResponse({
      messages: [{ role: 'user', content: 'What is the school pulse today?' }],
      tools,
    });

    expect(capturedCreateArgs).not.toBeNull();
    expect(capturedCreateArgs.model).toBe('openai/gpt-oss-120b');
    expect(capturedCreateArgs.tools).toHaveLength(2);

    // Verify all tools are of type 'function'
    capturedCreateArgs.tools.forEach((t: any) => {
      expect(t.type).toBe('function');
      expect(t.function.name).toBeDefined();
    });

    // Verify NO built-in tools are present
    const toolTypes = capturedCreateArgs.tools.map((t: any) => t.type);
    expect(toolTypes).not.toContain('browser_search');
    expect(toolTypes).not.toContain('code_interpreter');
    expect(toolTypes).not.toContain('mcp');

    // Verify tool_choice is 'auto'
    expect(capturedCreateArgs.tool_choice).toBe('auto');
  });

  // ─── 5. Local Tool Calling Response Normalization ────────────────────────
  it('TC-GROQ-05: Groq tool_calls are correctly parsed into normalized AIToolCall objects', async () => {
    const mockClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            id: 'chatcmpl_mock_tool',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_groq_att_123',
                      type: 'function',
                      function: {
                        name: 'getFacultyAttendanceAudit',
                        arguments: JSON.stringify({ statusFilter: 'ON_APPROVED_LEAVE' }),
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
          }),
        },
      },
    };

    const provider = new GroqAIProvider({ client: mockClient, apiKey: 'gsk_test' });

    const response = await provider.generateResponse({
      messages: [{ role: 'user', content: 'Which faculty are on approved leave?' }],
      tools: [],
    });

    expect(response.finishReason).toBe('tool_calls');
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls?.[0].id).toBe('call_groq_att_123');
    expect(response.toolCalls?.[0].name).toBe('getFacultyAttendanceAudit');
    expect(response.toolCalls?.[0].arguments).toEqual({ statusFilter: 'ON_APPROVED_LEAVE' });
    expect(response.usage).toEqual({ promptTokens: 50, completionTokens: 20, totalTokens: 70 });
  });

  // ─── 6. Conversational Narrative Response Normalization ───────────────────
  it('TC-GROQ-06: Groq narrative completion returns clean AIMessage and token usage', async () => {
    const mockClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            id: 'chatcmpl_mock_narrative',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Based on verified gate logs, 28 of 30 faculty members are currently on campus.',
                },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 60, completion_tokens: 25, total_tokens: 85 },
          }),
        },
      },
    };

    const provider = new GroqAIProvider({ client: mockClient, apiKey: 'gsk_test' });

    const response = await provider.generateResponse({
      messages: [{ role: 'user', content: 'Summarize the attendance records.' }],
    });

    expect(response.finishReason).toBe('stop');
    expect(response.toolCalls).toBeUndefined();
    expect(response.message.content).toBe('Based on verified gate logs, 28 of 30 faculty members are currently on campus.');
    expect(response.usage?.totalTokens).toBe(85);
  });

  // ─── 7. Error Mapping: 429 Rate Limit / Free Quota ────────────────────────
  it('TC-GROQ-07: 429 rate limit maps to retryable RATE_LIMITED AIProviderError', async () => {
    const rateLimitErr = new Error('Rate limit reached for model openai/gpt-oss-120b');
    (rateLimitErr as any).status = 429;

    const mockClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(rateLimitErr),
        },
      },
    };

    const provider = new GroqAIProvider({ client: mockClient, apiKey: 'gsk_test' });

    await expect(provider.generateResponse({
      messages: [{ role: 'user', content: 'Test query' }],
    })).rejects.toThrowError(AIProviderError);

    try {
      await provider.generateResponse({
        messages: [{ role: 'user', content: 'Test query' }],
      });
    } catch (err: any) {
      expect(err.code).toBe('RATE_LIMITED');
      expect(err.isRetryable).toBe(true);
      expect(err.message).toContain('Free Tier rate limit');
    }
  });

  // ─── 8. Error Mapping: Timeout ───────────────────────────────────────────
  it('TC-GROQ-08: Timeout maps to retryable PROVIDER_TIMEOUT AIProviderError', async () => {
    const timeoutErr = new Error('Request timed out');
    timeoutErr.name = 'APIConnectionTimeoutError';

    const mockClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(timeoutErr),
        },
      },
    };

    const provider = new GroqAIProvider({ client: mockClient, apiKey: 'gsk_test' });

    try {
      await provider.generateResponse({
        messages: [{ role: 'user', content: 'Test query' }],
      });
    } catch (err: any) {
      expect(err.code).toBe('PROVIDER_TIMEOUT');
      expect(err.isRetryable).toBe(true);
    }
  });

  // ─── 9. Error Mapping: Upstream Connection Error ─────────────────────────
  it('TC-GROQ-09: Connection failure maps to retryable PROVIDER_UNAVAILABLE AIProviderError', async () => {
    const connErr = new Error('Connection refused');
    connErr.name = 'APIConnectionError';

    const mockClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(connErr),
        },
      },
    };

    const provider = new GroqAIProvider({ client: mockClient, apiKey: 'gsk_test' });

    try {
      await provider.generateResponse({
        messages: [{ role: 'user', content: 'Test query' }],
      });
    } catch (err: any) {
      expect(err.code).toBe('PROVIDER_UNAVAILABLE');
      expect(err.isRetryable).toBe(true);
    }
  });

  // ─── 10. Error Mapping: Malformed Provider Response ───────────────────────
  it('TC-GROQ-10: Empty choices array maps to INVALID_PROVIDER_RESPONSE', async () => {
    const mockClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            id: 'chatcmpl_empty',
            choices: [],
          }),
        },
      },
    };

    const provider = new GroqAIProvider({ client: mockClient, apiKey: 'gsk_test' });

    try {
      await provider.generateResponse({
        messages: [{ role: 'user', content: 'Test query' }],
      });
    } catch (err: any) {
      expect(err.code).toBe('INVALID_PROVIDER_RESPONSE');
      expect(err.isRetryable).toBe(false);
    }
  });

  // ─── 11. Zero Paid Fallback Invariant ─────────────────────────────────────
  it('TC-GROQ-11: Hard Free-Tier Policy: allowPaidProvider is false by default and prohibits billing upgrades', () => {
    expect(aiConfig.allowPaidProvider).toBe(false);
    // Even if providerMode is changed, no paid APIs are permitted
    expect(aiConfig.providerMode).not.toBe('openai');
    expect(aiConfig.providerMode).not.toBe('anthropic');
  });

  // ─── 12. Full Orchestration Pipeline with Mocked Groq Transport ───────────
  it('TC-GROQ-12: AIService orchestrates two-turn tool dispatching through GroqAIProvider returning normalized contract', async () => {
    aiConfig.providerMode = 'groq';

    // Set up mock client for 2 turns:
    // Turn 1: Groq requests getSchoolOperationalFactSheet
    // Turn 2: Groq receives factual result and synthesizes grounded response
    let callCount = 0;
    const mockClient: any = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({
                id: 'cmpl_turn_1',
                choices: [
                  {
                    message: {
                      role: 'assistant',
                      content: null,
                      tool_calls: [
                        {
                          id: 'call_groq_facts_1',
                          type: 'function',
                          function: {
                            name: 'getSchoolOperationalFactSheet',
                            arguments: '{}',
                          },
                        },
                      ],
                    },
                    finish_reason: 'tool_calls',
                  },
                ],
                usage: { prompt_tokens: 40, completion_tokens: 15, total_tokens: 55 },
              });
            } else {
              return Promise.resolve({
                id: 'cmpl_turn_2',
                choices: [
                  {
                    message: {
                      role: 'assistant',
                      content: 'Here is the authoritative operational pulse for Calulut Integrated School.',
                    },
                    finish_reason: 'stop',
                  },
                ],
                usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
              });
            }
          }),
        },
      },
    };

    // Inject mocked Groq provider into factory
    const testGroqProvider = new GroqAIProvider({ client: mockClient, apiKey: 'gsk_test_key' });
    vi.spyOn(await import('../src/ai/provider/aiProvider.factory.js'), 'getAIProvider')
      .mockReturnValue(testGroqProvider);

    const testUser: AuthenticatedUser = {
      id: principalUserId,
      email: 'principal@demo.com',
      roles: ['Principal'],
      permissions: [
        'academic:read',
        'attendance:read',
        'behavior:read',
        'faculty_attendance:read',
        'leave:read',
        'event:read',
        'grade:read_all',
      ],
    };

    const result = await AIService.processChat(
      {
        messages: [{ role: 'user', content: 'Is there anything I should know about the school today?' }],
        portal: 'Principal',
      },
      testUser
    );

    // Verify DigiSkwela Normalized Chat Response Contract
    expect(result.responseType).toBe('structured');
    expect(result.message.content).toBe('Here is the authoritative operational pulse for Calulut Integrated School.');
    expect(result.structuredData).toBeDefined();
    expect(result.structuredData?.type).toBe('fact_sheet');
    expect(result.structuredData?.raw.students).toBeDefined();
    expect(result.structuredData?.raw.faculty).toBeDefined();
    expect(result.provenance?.sourceDomains).toContain('Executive Summary');
    expect(result.navigationActions?.[0].screen).toBe('p-dashboard');
    expect(result.toolsExecuted).toEqual(['getSchoolOperationalFactSheet']);
    expect(result.scopeDecision).toBe('ALLOWED');

    // Verify exactly 2 turns were executed
    expect(callCount).toBe(2);
  });
});
