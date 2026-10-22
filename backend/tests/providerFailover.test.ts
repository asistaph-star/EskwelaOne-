import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import prisma from '../src/config/database.js';
import { FailoverAIProvider, isEligibleForProviderFailover } from '../src/ai/provider/failoverAIProvider.js';
import { getAIProvider } from '../src/ai/provider/aiProvider.factory.js';
import { aiConfig } from '../src/config/ai.config.js';
import { 
  AIProviderError, 
  DigiSkwelaAIProvider, 
  AICompletionRequest, 
  AICompletionResponse 
} from '../src/ai/provider/aiProvider.interface.js';
import { AIService } from '../src/ai/ai.service.js';
import { AuthenticatedUser } from '../src/common/middleware/auth.js';

describe('DIGISKWELA — SECTION 16: PROVIDER FAILOVER TEST MATRIX', () => {
  const originalProviderMode = aiConfig.providerMode;
  const originalAllowPaid = aiConfig.allowPaidProvider;
  let principalUser: AuthenticatedUser;
  let teacherUser: AuthenticatedUser;

  beforeAll(async () => {
    let pUser = await prisma.user.findFirst({ where: { email: 'principal@demo.com' } });
    if (!pUser) {
      pUser = await prisma.user.create({
        data: {
          id: 'usr_prin_failover_test',
          email: 'principal_failover@demo.com',
          password_hash: 'hashed',
          first_name: 'Principal',
          last_name: 'FailoverTest',
          status: 'active',
        },
      });
    }

    principalUser = {
      id: pUser.id,
      email: pUser.email,
      roles: ['Principal'],
      permissions: ['*'],
      status: 'active',
    };

    let tUser = await prisma.user.findFirst({ where: { email: 'teacher@demo.com' } });
    if (!tUser) {
      tUser = await prisma.user.create({
        data: {
          id: 'usr_teacher_failover_test',
          email: 'teacher_failover@demo.com',
          password_hash: 'hashed',
          first_name: 'Teacher',
          last_name: 'FailoverTest',
          status: 'active',
        },
      });
    }

    teacherUser = {
      id: tUser.id,
      email: tUser.email,
      roles: ['Teacher'],
      permissions: ['attendance:mark'],
      status: 'active',
    };
  });

  afterAll(async () => {
    await prisma.aIAuditLog.deleteMany({
      where: { user_id: { in: [principalUser.id, teacherUser.id] } }
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    aiConfig.providerMode = 'groq_cloudflare';
    aiConfig.allowPaidProvider = false;
  });

  afterEach(() => {
    aiConfig.providerMode = originalProviderMode;
    aiConfig.allowPaidProvider = originalAllowPaid;
  });

  // Helper to create mock DigiSkwelaAIProvider
  function createMockProvider(
    name: string,
    mode: any,
    behavior: (req: AICompletionRequest) => Promise<AICompletionResponse>
  ): DigiSkwelaAIProvider {
    return {
      name,
      mode,
      model: `${name}-model`,
      generateResponse: vi.fn().mockImplementation(behavior),
    };
  }

  // ─── Scenario A: Groq Success ─────────────────────────────────────────────
  it('TC-FAILOVER-A: Groq succeeds -> Cloudflare is NOT called', async () => {
    const mockGroq = createMockProvider('GroqAIProvider', 'groq', async () => ({
      message: { role: 'assistant', content: 'Groq successfully answered the query.' },
      finishReason: 'stop',
      usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
    }));

    const mockCloudflare = createMockProvider('CloudflareAIProvider', 'cloudflare', async () => {
      throw new Error('Cloudflare should never be called when Groq succeeds');
    });

    const failoverProvider = new FailoverAIProvider({
      primary: mockGroq,
      secondary: mockCloudflare,
    });

    const response = await failoverProvider.generateResponse({
      messages: [{ role: 'user', content: 'What needs my review today?' }],
    });

    expect(response.message.content).toBe('Groq successfully answered the query.');
    expect(response.failoverMetadata).toBeDefined();
    expect(response.failoverMetadata?.occurred).toBe(false);
    expect(response.failoverMetadata?.primaryProvider).toBe('GroqAIProvider');
    expect(response.failoverMetadata?.finalProvider).toBe('GroqAIProvider');
    expect(mockGroq.generateResponse).toHaveBeenCalledTimes(1);
    expect(mockCloudflare.generateResponse).not.toHaveBeenCalled();
  });

  // ─── Scenario B: Groq Quota Exceeded ──────────────────────────────────────
  it('TC-FAILOVER-B: Groq quota exceeded -> Cloudflare runs and succeeds', async () => {
    const mockGroq = createMockProvider('GroqAIProvider', 'groq', async () => {
      throw new AIProviderError('RATE_LIMITED', 'Groq daily free token quota exceeded.', true);
    });

    const mockCloudflare = createMockProvider('CloudflareAIProvider', 'cloudflare', async () => ({
      message: { role: 'assistant', content: 'Cloudflare successfully responded after Groq quota exhaustion.' },
      finishReason: 'stop',
      usage: { promptTokens: 35, completionTokens: 12, totalTokens: 47 },
    }));

    const failoverProvider = new FailoverAIProvider({
      primary: mockGroq,
      secondary: mockCloudflare,
    });

    const response = await failoverProvider.generateResponse({
      messages: [{ role: 'user', content: 'Check pending leave requests.' }],
    });

    expect(response.message.content).toBe('Cloudflare successfully responded after Groq quota exhaustion.');
    expect(response.failoverMetadata?.occurred).toBe(true);
    expect(response.failoverMetadata?.primaryProvider).toBe('GroqAIProvider');
    expect(response.failoverMetadata?.finalProvider).toBe('CloudflareAIProvider');
    expect(response.failoverMetadata?.reason).toBe('RATE_LIMITED');
    expect(mockGroq.generateResponse).toHaveBeenCalledTimes(1);
    expect(mockCloudflare.generateResponse).toHaveBeenCalledTimes(1);
  });

  // ─── Scenario C: Groq Temporary Unavailable ───────────────────────────────
  it('TC-FAILOVER-C: Groq temporary unavailable (502/503) -> Cloudflare runs', async () => {
    const mockGroq = createMockProvider('GroqAIProvider', 'groq', async () => {
      throw new AIProviderError('PROVIDER_UNAVAILABLE', 'Groq 503 Bad Gateway', true);
    });

    const mockCloudflare = createMockProvider('CloudflareAIProvider', 'cloudflare', async () => ({
      message: { role: 'assistant', content: 'Cloudflare handled temporary upstream outage.' },
      finishReason: 'stop',
    }));

    const failoverProvider = new FailoverAIProvider({
      primary: mockGroq,
      secondary: mockCloudflare,
    });

    const response = await failoverProvider.generateResponse({
      messages: [{ role: 'user', content: 'Show school status.' }],
    });

    expect(response.message.content).toBe('Cloudflare handled temporary upstream outage.');
    expect(response.failoverMetadata?.occurred).toBe(true);
    expect(response.failoverMetadata?.reason).toBe('PROVIDER_UNAVAILABLE');
    expect(mockCloudflare.generateResponse).toHaveBeenCalledTimes(1);
  });

  // ─── Scenario D: Groq Timeout ─────────────────────────────────────────────
  it('TC-FAILOVER-D: Groq timeout -> Cloudflare runs according to bounded timeout', async () => {
    const mockGroq = createMockProvider('GroqAIProvider', 'groq', async () => {
      throw new AIProviderError('PROVIDER_TIMEOUT', 'Groq request timed out after 15000ms.', true);
    });

    const mockCloudflare = createMockProvider('CloudflareAIProvider', 'cloudflare', async () => ({
      message: { role: 'assistant', content: 'Cloudflare answered after Groq timed out.' },
      finishReason: 'stop',
    }));

    const failoverProvider = new FailoverAIProvider({
      primary: mockGroq,
      secondary: mockCloudflare,
    });

    const response = await failoverProvider.generateResponse({
      messages: [{ role: 'user', content: 'Prepare briefing.' }],
    });

    expect(response.message.content).toBe('Cloudflare answered after Groq timed out.');
    expect(response.failoverMetadata?.occurred).toBe(true);
    expect(response.failoverMetadata?.reason).toBe('PROVIDER_TIMEOUT');
    expect(mockCloudflare.generateResponse).toHaveBeenCalledTimes(1);
  });

  // ─── Scenario E: Groq Authentication / Config Failure ─────────────────────
  it('TC-FAILOVER-E: Groq authentication/config failure -> NO failover', async () => {
    const mockGroq = createMockProvider('GroqAIProvider', 'groq', async () => {
      throw new AIProviderError(
        'UNKNOWN_ERROR',
        'Groq authentication error. Please verify backend GROQ_API_KEY configuration.',
        false // Not retryable
      );
    });

    const mockCloudflare = createMockProvider('CloudflareAIProvider', 'cloudflare', async () => {
      throw new Error('Cloudflare should NOT run on auth/config defects');
    });

    const failoverProvider = new FailoverAIProvider({
      primary: mockGroq,
      secondary: mockCloudflare,
    });

    await expect(failoverProvider.generateResponse({
      messages: [{ role: 'user', content: 'Hello' }],
    })).rejects.toThrow(AIProviderError);

    expect(mockGroq.generateResponse).toHaveBeenCalledTimes(1);
    expect(mockCloudflare.generateResponse).not.toHaveBeenCalled();
  });

  // ─── Scenario F: Scope Guard Refusal ──────────────────────────────────────
  it('TC-FAILOVER-F: Scope Guard refusal -> NO provider failover', async () => {
    const outOfScopePrompt = 'Write a Python script to scrape Facebook photos.';

    const response = await AIService.processChat(
      {
        messages: [{ role: 'user', content: outOfScopePrompt }],
        portal: 'principal',
      },
      principalUser
    );

    expect(response.scopeDecision).toBe('OUT_OF_SCOPE_CODING');
    expect(response.message.content).toContain('DigiSkwela AI is an administrative school assistant and cannot write code');
    expect(response.toolsExecuted).toHaveLength(0);
  });

  // ─── Scenario G: RBAC Denial ──────────────────────────────────────────────
  it('TC-FAILOVER-G: RBAC denial -> unauthorized tools not accessible, NO failover', async () => {
    const factory = await import('../src/ai/provider/aiProvider.factory.js');
    const mockProvider = createMockProvider('MockRBACProvider', 'groq', async (req) => {
      // Confirm that authorizedDeclarations passed to provider do NOT include Principal tools
      const toolNames = (req.tools || []).map(t => t.name);
      expect(toolNames).not.toContain('getFacultyAttendanceAudit');
      expect(toolNames).not.toContain('getPendingLeaves');
      return {
        message: { role: 'assistant', content: 'Your schedule can be viewed in the teacher portal.' },
        finishReason: 'stop',
      };
    });
    vi.spyOn(factory, 'getAIProvider').mockReturnValue(mockProvider);

    const res = await AIService.processChat(
      {
        messages: [{ role: 'user', content: 'Where do I find my schedule?' }],
        portal: 'teacher',
      },
      teacherUser
    );

    expect(res.scopeDecision).toBe('ALLOWED');
    expect(res.toolsExecuted).toHaveLength(0);
  });

  // ─── Scenario H: Tool Validation Failure ──────────────────────────────────
  it('TC-FAILOVER-H: Tool argument validation failure does NOT trigger provider failover', () => {
    // Non-provider error should never qualify for failover
    const toolValidationError = new Error('Zod validation error: Invalid date format');
    expect(isEligibleForProviderFailover(toolValidationError)).toBe(false);

    const rbacError = new Error('FORBIDDEN: User does not have principal role');
    expect(isEligibleForProviderFailover(rbacError)).toBe(false);
  });

  // ─── Scenario I: Both Providers Unavailable ───────────────────────────────
  it('TC-FAILOVER-I: Both providers unavailable -> returns normalized AI unavailable', async () => {
    const mockGroq = createMockProvider('GroqAIProvider', 'groq', async () => {
      throw new AIProviderError('RATE_LIMITED', 'Groq quota exceeded', true);
    });

    const mockCloudflare = createMockProvider('CloudflareAIProvider', 'cloudflare', async () => {
      throw new AIProviderError('RATE_LIMITED', 'Cloudflare quota exceeded', true);
    });

    const failoverProvider = new FailoverAIProvider({
      primary: mockGroq,
      secondary: mockCloudflare,
    });

    await expect(failoverProvider.generateResponse({
      messages: [{ role: 'user', content: 'Check operations.' }],
    })).rejects.toThrow(AIProviderError);

    expect(mockGroq.generateResponse).toHaveBeenCalledTimes(1);
    expect(mockCloudflare.generateResponse).toHaveBeenCalledTimes(1);
  });

  // ─── Scenario J: Cloudflare Tool Execution Integration ────────────────────
  it('TC-FAILOVER-J: Cloudflare executes authorized tools and persists audit metadata', async () => {
    const mockGroq = createMockProvider('GroqAIProvider', 'groq', async () => {
      throw new AIProviderError('RATE_LIMITED', 'Groq quota exhausted', true);
    });

    const mockCloudflare = createMockProvider('CloudflareAIProvider', 'cloudflare', async (req) => {
      // First turn: requests tool
      const hasToolResult = req.messages.some(m => m.role === 'tool');
      if (!hasToolResult) {
        return {
          message: { role: 'assistant', content: '' },
          toolCalls: [
            {
              id: 'call_cf_leave_01',
              name: 'getPendingLeaves',
              arguments: {},
            }
          ],
          finishReason: 'tool_calls',
          usage: { promptTokens: 50, completionTokens: 15, totalTokens: 65 },
        };
      }

      // Second turn: synthesizes grounded answer
      return {
        message: {
          role: 'assistant',
          content: 'One leave request is currently pending Principal review.',
        },
        finishReason: 'stop',
        usage: { promptTokens: 120, completionTokens: 25, totalTokens: 145 },
      };
    });

    const failoverProvider = new FailoverAIProvider({
      primary: mockGroq,
      secondary: mockCloudflare,
    });

    // Verify turn 1
    const turn1 = await failoverProvider.generateResponse({
      messages: [{ role: 'user', content: 'How many pending leaves?' }],
    });

    expect(turn1.toolCalls).toHaveLength(1);
    expect(turn1.toolCalls?.[0].name).toBe('getPendingLeaves');
    expect(turn1.failoverMetadata?.occurred).toBe(true);
    expect(turn1.failoverMetadata?.finalProvider).toBe('CloudflareAIProvider');

    // Verify turn 2
    const turn2 = await failoverProvider.generateResponse({
      messages: [
        { role: 'user', content: 'How many pending leaves?' },
        turn1.message,
        {
          role: 'tool',
          name: 'getPendingLeaves',
          toolCallId: 'call_cf_leave_01',
          content: JSON.stringify({ pendingCount: 1, leaves: [] })
        }
      ],
    });

    expect(turn2.message.content).toBe('One leave request is currently pending Principal review.');
    expect(turn2.failoverMetadata?.occurred).toBe(true);
  });

  // ─── Scenario K: No Mock Fallback in Combined Live Mode ───────────────────
  it('TC-FAILOVER-K: MockAIProvider is NEVER triggered in combined live mode', () => {
    aiConfig.providerMode = 'groq_cloudflare';
    const provider = getAIProvider();

    expect(provider).toBeInstanceOf(FailoverAIProvider);
    expect(provider.mode).toBe('groq_cloudflare');

    const failoverInstance = provider as FailoverAIProvider;
    expect(failoverInstance.primary.name).toBe('GroqAIProvider');
    expect(failoverInstance.secondary.name).toBe('CloudflareAIProvider');
    expect(failoverInstance.primary.mode).not.toBe('mock');
    expect(failoverInstance.secondary.mode).not.toBe('mock');
  });

  // ─── Scenario L: Single Chain (No Circular Loop) ──────────────────────────
  it('TC-FAILOVER-L: Bounded single chain — secondary error terminates immediately without looping', async () => {
    let groqAttempts = 0;
    let cfAttempts = 0;

    const mockGroq = createMockProvider('GroqAIProvider', 'groq', async () => {
      groqAttempts++;
      throw new AIProviderError('RATE_LIMITED', 'Groq limit', true);
    });

    const mockCloudflare = createMockProvider('CloudflareAIProvider', 'cloudflare', async () => {
      cfAttempts++;
      throw new AIProviderError('PROVIDER_UNAVAILABLE', 'CF 503', true);
    });

    const failoverProvider = new FailoverAIProvider({
      primary: mockGroq,
      secondary: mockCloudflare,
    });

    await expect(failoverProvider.generateResponse({
      messages: [{ role: 'user', content: 'Hello' }]
    })).rejects.toThrow('CF 503');

    // Exactly 1 attempt per provider — absolutely NO retry loop
    expect(groqAttempts).toBe(1);
    expect(cfAttempts).toBe(1);
  });
});
