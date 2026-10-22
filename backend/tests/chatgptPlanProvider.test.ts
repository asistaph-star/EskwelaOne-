/**
 * DIGISKWELA — CHATGPT PLAN PROVIDER QUALIFICATION TEST SUITE
 * 
 * Verifies the isolated ChatGPT Plus / Plan OAuth provider adapter,
 * PKCE authorization code exchange, stable host ID, credential safety,
 * Responses API streaming contract, model discovery, and error normalization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ChatGPTOAuthService } from '../src/ai/chatgpt/chatgptOAuth.service.js';
import { ChatGPTTokenStorage } from '../src/ai/chatgpt/chatgptTokenStorage.js';
import { getOrCreateHostId } from '../src/ai/chatgpt/chatgptHostId.js';
import { ChatGPTPlanAIProvider } from '../src/ai/provider/chatgptPlanAIProvider.js';
import { AIProviderError } from '../src/ai/provider/aiProvider.interface.js';

describe('DIGISKWELA — CHATGPT PLAN PROVIDER QUALIFICATION', () => {
  const testStorageDir = path.resolve(process.cwd(), 'storage', 'test_chatgpt');
  const testTokensPath = path.join(testStorageDir, 'tokens.json');
  const testHostIdPath = path.join(testStorageDir, 'host_id.json');

  let storage: ChatGPTTokenStorage;

  beforeEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testStorageDir, { recursive: true });
    storage = new ChatGPTTokenStorage(testTokensPath);
  });

  afterEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('1. Host ID Management & Credential Safety', () => {
    it('TC-CGP-01: Creates and persists a stable opaque UUID URN without school/user personal data', () => {
      const hostId1 = getOrCreateHostId(testHostIdPath);
      expect(hostId1).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      // Verify stability across re-reads
      const hostId2 = getOrCreateHostId(testHostIdPath);
      expect(hostId2).toBe(hostId1);

      // Verify raw file content contains zero school identifiers
      const raw = fs.readFileSync(testHostIdPath, 'utf-8');
      expect(raw).not.toMatch(/@/);
      expect(raw).not.toMatch(/student|faculty|principal|teacher/i);
    });

    it('TC-CGP-02: Credentials are never exposed in status summary', () => {
      storage.saveCredentials({
        accessToken: 'secret_access_token_12345',
        refreshToken: 'secret_refresh_token_67890',
        idToken: 'secret_id_token_header.payload.sig',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
        scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
        issuedClientId: 'oaiapp_test_client_id',
        accountId: 'acc_test_123',
        userEmail: 'principal@school.edu',
      });

      const summary = storage.getStatusSummary();
      expect(summary.connected).toBe(true);
      expect(summary.hasDirectTokenScope).toBe(true);
      expect(summary.isExpired).toBe(false);
      expect(summary.issuedClientId).toBe('oaiapp_test_client_id');

      // Crucial credential privacy invariant: zero token leakage
      const summaryJson = JSON.stringify(summary);
      expect(summaryJson).not.toContain('secret_access_token');
      expect(summaryJson).not.toContain('secret_refresh_token');
      expect(summaryJson).not.toContain('secret_id_token');
    });
  });

  describe('2. Official OAuth Flow with PKCE & Dynamic Client Registration', () => {
    it('TC-CGP-03: Generates authoritative authorization URL with PKCE S256 and dynamic_agent_client', () => {
      const oauthService = new ChatGPTOAuthService({ storage });
      const result = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });

      const parsedUrl = new URL(result.url);
      expect(parsedUrl.origin).toBe('https://auth.openai.com');
      expect(parsedUrl.pathname).toBe('/api/accounts/authorize');
      expect(parsedUrl.searchParams.get('client_id')).toBe('dynamic_agent_client');
      expect(parsedUrl.searchParams.get('response_type')).toBe('code');
      expect(parsedUrl.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsedUrl.searchParams.get('code_challenge')).toBeTruthy();
      expect(parsedUrl.searchParams.get('state')).toBe(result.state);
      expect(parsedUrl.searchParams.get('nonce')).toBeTruthy();
      expect(parsedUrl.searchParams.get('resource')).toBe('https://api.openai.com/v1');
      expect(parsedUrl.searchParams.get('agent_name_hint')).toBe('DigiSkwela');

      const scopes = parsedUrl.searchParams.get('scope')!.split(' ');
      expect(scopes).toContain('openid');
      expect(scopes).toContain('offline_access');
      expect(scopes).toContain('resource.invoke');
      expect(scopes).toContain('chatgpt.tokens.use.direct');
    });

    it('TC-CGP-04: Rejects callback if state is invalid, mismatched, or expired', async () => {
      const oauthService = new ChatGPTOAuthService({ storage });
      const result = await oauthService.handleCallback({
        code: 'mock_code',
        state: 'unknown_random_state',
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('INVALID_STATE');
    });

    it('TC-CGP-05: Successful authorization code exchange stores issued client ID and grants plan inference', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'valid_test_access_token',
          refresh_token: 'valid_test_refresh_token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
          client_id: 'oaiapp_issued_client_999',
        }),
      });

      const oauthService = new ChatGPTOAuthService({ storage, fetchFn: mockFetch as any });
      const authUrl = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });

      const callbackResult = await oauthService.handleCallback({
        code: 'auth_code_xyz',
        state: authUrl.state,
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
        callbackClientId: 'oaiapp_issued_client_999',
      });

      expect(callbackResult.success).toBe(true);
      expect(callbackResult.identityConnected).toBe(true);
      expect(callbackResult.planInferenceAuthorized).toBe(true);
      expect(callbackResult.issuedClientId).toBe('oaiapp_issued_client_999');

      // Verify token exchange used the issued client ID and NOT dynamic_agent_client
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = new URLSearchParams(callArgs[1].body);
      expect(requestBody.get('client_id')).toBe('oaiapp_issued_client_999');
      expect(requestBody.get('grant_type')).toBe('authorization_code');
      expect(requestBody.get('resource')).toBe('https://api.openai.com/v1');

      // Verify tokens are persisted
      const creds = storage.loadCredentials();
      expect(creds?.accessToken).toBe('valid_test_access_token');
      expect(creds?.issuedClientId).toBe('oaiapp_issued_client_999');

      // Subsequent authorization URL should use issued client ID instead of dynamic_agent_client
      const nextAuth = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });
      const nextUrl = new URL(nextAuth.url);
      expect(nextUrl.searchParams.get('client_id')).toBe('oaiapp_issued_client_999');
    });

    it('TC-CGP-05B: Rejects new registration if callback client_id is missing or dynamic_agent_client', async () => {
      const oauthService = new ChatGPTOAuthService({ storage });
      const authUrl = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });

      // Missing client_id
      const resMissing = await oauthService.handleCallback({
        code: 'code1',
        state: authUrl.state,
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });
      expect(resMissing.success).toBe(false);
      expect(resMissing.error).toContain('INCOMPLETE_REGISTRATION');

      // Attempting to pass dynamic_agent_client
      const authUrl2 = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });
      const resDynamic = await oauthService.handleCallback({
        code: 'code2',
        state: authUrl2.state,
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
        callbackClientId: 'dynamic_agent_client',
      });
      expect(resDynamic.success).toBe(false);
      expect(resDynamic.error).toContain('INVALID_CLIENT_ID');
    });

    it('TC-CGP-05C: Rejects returning sign-in if callback client_id mismatches registered client ID', async () => {
      storage.saveCredentials({
        accessToken: 'existing_token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
        scope: 'openid',
        issuedClientId: 'oaiapp_registered_existing',
      });

      const oauthService = new ChatGPTOAuthService({ storage });
      const authUrl = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });

      const resMismatch = await oauthService.handleCallback({
        code: 'code_mismatch',
        state: authUrl.state,
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
        callbackClientId: 'oaiapp_different_unrecognized',
      });
      expect(resMismatch.success).toBe(false);
      expect(resMismatch.error).toContain('CLIENT_ID_MISMATCH');
    });

    it('TC-CGP-06: Explicitly differentiates identity sign-in from plan inference when scope is declined', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'identity_only_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          // Notice: chatgpt.tokens.use.direct is ABSENT
          scope: 'openid profile email',
        }),
      });

      const oauthService = new ChatGPTOAuthService({ storage, fetchFn: mockFetch as any });
      const authUrl = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });

      const callbackResult = await oauthService.handleCallback({
        code: 'auth_code_identity',
        state: authUrl.state,
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
        callbackClientId: 'oaiapp_identity_client',
      });

      expect(callbackResult.success).toBe(true);
      expect(callbackResult.identityConnected).toBe(true);
      expect(callbackResult.planInferenceAuthorized).toBe(false);
      expect(storage.hasValidPlanAccess()).toBe(false);
    });
  });

  describe('3. Dynamic Model Discovery', () => {
    it('TC-CGP-07: Queries GET /v1/models using OAuth token and extracts slugs and display names', async () => {
      storage.saveCredentials({
        accessToken: 'oauth_bearer_token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
        scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            { slug: 'gpt-5-preview', display_name: 'GPT-5 Preview', visibility: 'list' },
            { slug: 'gpt-4.5', display_name: 'GPT-4.5', visibility: 'list' },
            { slug: 'internal-hidden', display_name: 'Hidden Model', visibility: 'internal' },
          ],
        }),
      });

      const provider = new ChatGPTPlanAIProvider({ storage, fetchFn: mockFetch as any });
      const models = await provider.discoverModels();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          headers: { Authorization: 'Bearer oauth_bearer_token' },
        })
      );

      expect(models.length).toBe(2);
      expect(models[0].slug).toBe('gpt-5-preview');
      expect(models[0].displayName).toBe('GPT-5 Preview');
      expect(models[1].slug).toBe('gpt-4.5');
    });
  });

  describe('4. Responses API Contract, SSE Streaming & Unsupported Field Stripping', () => {
    it('TC-CGP-08: Enforces store:false, stream:true and strips preview-unsupported parameters', async () => {
      storage.saveCredentials({
        accessToken: 'oauth_token_stream',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
        scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      });

      let capturedPayload: any = null;

      const mockSseBody = [
        'event: response.created\ndata: {"id":"resp_123","type":"response.created"}\n\n',
        'event: response.output_text.delta\ndata: {"delta":"DigiSkwela "}\n\n',
        'event: response.output_text.delta\ndata: {"delta":"ChatGPT plan provider connected."}\n\n',
        'event: response.completed\ndata: {"type":"response.completed","response":{"output":[{"type":"message","content":[{"type":"output_text","text":"DigiSkwela ChatGPT plan provider connected."}]}],"usage":{"input_tokens":15,"output_tokens":8,"total_tokens":23}}}\n\n',
        'data: [DONE]\n\n',
      ].join('');

      const mockFetch = vi.fn().mockImplementation(async (_url: string, opts: any) => {
        capturedPayload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          text: async () => mockSseBody,
        };
      });

      const provider = new ChatGPTPlanAIProvider({
        storage,
        model: 'gpt-5-preview',
        fetchFn: mockFetch as any,
      });

      const response = await provider.generateResponse({
        messages: [
          { role: 'system', content: 'You are DigiSkwela AI.' },
          { role: 'user', content: 'Reply with exactly: DigiSkwela ChatGPT plan provider connected.' },
        ],
      });

      // 1. Mandatory Responses API fields
      expect(capturedPayload.store).toBe(false);
      expect(capturedPayload.stream).toBe(true);
      expect(capturedPayload.model).toBe('gpt-5-preview');
      expect(capturedPayload.instructions).toBe('You are DigiSkwela AI.');
      expect(capturedPayload.input).toEqual([
        { role: 'user', content: 'Reply with exactly: DigiSkwela ChatGPT plan provider connected.' },
      ]);

      // 2. Unsupported fields strictly stripped
      expect(capturedPayload.temperature).toBeUndefined();
      expect(capturedPayload.top_p).toBeUndefined();
      expect(capturedPayload.max_output_tokens).toBeUndefined();
      expect(capturedPayload.max_tokens).toBeUndefined();
      expect(capturedPayload.conversation).toBeUndefined();
      expect(capturedPayload.previous_response_id).toBeUndefined();
      expect(capturedPayload.metadata).toBeUndefined();

      // 3. Normalized response
      expect(response.message.content).toBe('DigiSkwela ChatGPT plan provider connected.');
      expect(response.finishReason).toBe('stop');
      expect(response.usage?.totalTokens).toBe(23);
    });

    it('TC-CGP-09: Parses function/custom tool calls and maps to normalized AIToolCall format', async () => {
      storage.saveCredentials({
        accessToken: 'oauth_token_tools',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
        scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      });

      const mockSseBody = [
        'event: response.completed\ndata: {"type":"response.completed","response":{"output":[{"type":"function_call","call_id":"call_pend_123","name":"getPendingLeaves","arguments":"{\\"statusFilter\\":\\"PENDING\\"}"}],"usage":{"input_tokens":50,"output_tokens":20,"total_tokens":70}}}\n\n',
        'data: [DONE]\n\n',
      ].join('');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockSseBody,
      });

      const provider = new ChatGPTPlanAIProvider({
        storage,
        model: 'gpt-5-preview',
        fetchFn: mockFetch as any,
      });

      const response = await provider.generateResponse({
        messages: [{ role: 'user', content: 'How many faculty leaves are pending?' }],
        tools: [
          {
            id: 'getPendingLeaves',
            name: 'getPendingLeaves',
            description: 'Get pending faculty leaves',
            parameters: {
              type: 'object',
              properties: { statusFilter: { type: 'string' } },
            },
          },
        ],
      });

      expect(response.finishReason).toBe('tool_calls');
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls?.length).toBe(1);
      expect(response.toolCalls![0].name).toBe('getPendingLeaves');
      expect(response.toolCalls![0].id).toBe('call_pend_123');
      expect(response.toolCalls![0].arguments).toEqual({ statusFilter: 'PENDING' });
    });
  });

  describe('5. Error Handling & Quota Normalization', () => {
    it('TC-CGP-10: HTTP 429 maps to FREE_QUOTA_EXHAUSTED without retries or paid fallback', async () => {
      storage.saveCredentials({
        accessToken: 'oauth_token_429',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
        scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'Usage limit exceeded' } }),
      });

      const provider = new ChatGPTPlanAIProvider({
        storage,
        model: 'gpt-5-preview',
        fetchFn: mockFetch as any,
      });

      await expect(
        provider.generateResponse({
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrowError(
        expect.objectContaining({
          code: 'FREE_QUOTA_EXHAUSTED',
          isRetryable: false,
        })
      );
    });

    it('TC-CGP-11: Rejects inference when user has identity session but declined plan scope', async () => {
      storage.saveCredentials({
        accessToken: 'oauth_token_no_plan',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
        scope: 'openid profile email', // No chatgpt.tokens.use.direct!
      });

      const provider = new ChatGPTPlanAIProvider({
        storage,
        model: 'gpt-5-preview',
      });

      await expect(
        provider.generateResponse({
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrowError(
        expect.objectContaining({
          code: 'FREE_QUOTA_EXHAUSTED',
          message: expect.stringContaining('chatgpt.tokens.use.direct'),
        })
      );
    });

    it('TC-CGP-12: Successfully refreshes token using stored refresh_token', async () => {
      storage.saveCredentials({
        accessToken: 'stale_access_token',
        refreshToken: 'valid_refresh_token_xyz',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000, // Expired
        scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
        issuedClientId: 'oaiapp_issued_client_999',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'newly_refreshed_access_token',
          refresh_token: 'rotated_refresh_token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
          client_id: 'oaiapp_issued_client_999',
        }),
      });

      const oauthService = new ChatGPTOAuthService({ storage, fetchFn: mockFetch as any });
      const refreshResult = await oauthService.refreshAccessToken();

      expect(refreshResult.success).toBe(true);
      const updated = storage.loadCredentials();
      expect(updated?.accessToken).toBe('newly_refreshed_access_token');
      expect(updated?.refreshToken).toBe('rotated_refresh_token');
      expect(updated?.expiresAt).toBeGreaterThan(Date.now());
    });

    it('TC-CGP-13: Automatically refreshes token when close to expiry before executing API request', async () => {
      storage.saveCredentials({
        accessToken: 'expiring_soon_access_token',
        refreshToken: 'refresh_token_abc',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 30000, // 30s remaining (< 60s threshold)
        scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
        issuedClientId: 'oaiapp_issued_client_999',
      });

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/accounts/oauth/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'fresh_access_token_after_refresh',
              refresh_token: 'fresh_refresh_token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
            }),
          };
        }
        if (url.includes('/v1/responses')) {
          return {
            ok: true,
            status: 200,
            text: async () => [
              'event: response.completed\ndata: {"type":"response.completed","response":{"output":[{"type":"message","content":[{"type":"output_text","text":"Refreshed successfully."}]}],"usage":{"total_tokens":10}}}\n\n',
              'data: [DONE]\n\n',
            ].join(''),
          };
        }
        return { ok: false, status: 404, text: async () => 'Not found' };
      });

      const oauthService = new ChatGPTOAuthService({ storage, fetchFn: mockFetch as any });
      const provider = new ChatGPTPlanAIProvider({
        storage,
        oauthService,
        model: 'gpt-5-preview',
        fetchFn: mockFetch as any,
      });

      const response = await provider.generateResponse({
        messages: [{ role: 'user', content: 'Test refresh' }],
      });

      expect(response.message.content).toBe('Refreshed successfully.');
      const updatedCreds = storage.loadCredentials();
      expect(updatedCreds?.accessToken).toBe('fresh_access_token_after_refresh');
    });
  });

  describe('6. Tool Dispatch & DigiSkwela RBAC Separation', () => {
    it('TC-CGP-14: Model tool call flows through tool execution and provides function_call_output', async () => {
      storage.saveCredentials({
        accessToken: 'oauth_token_tool_dispatch',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
        scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      });

      let turnCount = 0;
      let lastInput: any[] = [];

      const mockFetch = vi.fn().mockImplementation(async (_url: string, opts: any) => {
        turnCount++;
        const payload = JSON.parse(opts.body);
        lastInput = payload.input;

        if (turnCount === 1) {
          // Turn 1: Model requests a tool call
          return {
            ok: true,
            status: 200,
            text: async () => [
              'event: response.completed\ndata: {"type":"response.completed","response":{"output":[{"type":"function_call","call_id":"call_turn1","name":"getPendingLeaves","arguments":"{\\"statusFilter\\":\\"PENDING\\"}"}]}}\n\n',
              'data: [DONE]\n\n',
            ].join(''),
          };
        } else {
          // Turn 2: Model returns synthesized answer after receiving function output
          return {
            ok: true,
            status: 200,
            text: async () => [
              'event: response.completed\ndata: {"type":"response.completed","response":{"output":[{"type":"message","content":[{"type":"output_text","text":"There are 2 pending faculty leave requests."}]}]}}\n\n',
              'data: [DONE]\n\n',
            ].join(''),
          };
        }
      });

      const provider = new ChatGPTPlanAIProvider({
        storage,
        model: 'gpt-5-preview',
        fetchFn: mockFetch as any,
      });

      // 1. Initial request produces tool call
      const turn1Response = await provider.generateResponse({
        messages: [{ role: 'user', content: 'What leaves are pending?' }],
        tools: [
          {
            id: 'getPendingLeaves',
            name: 'getPendingLeaves',
            description: 'Get pending leaves',
            parameters: { type: 'object', properties: { statusFilter: { type: 'string' } } },
          },
        ],
      });

      expect(turn1Response.finishReason).toBe('tool_calls');
      expect(turn1Response.toolCalls?.length).toBe(1);

      // 2. Client executes tool and passes function_call_output back into conversation
      const syntheticToolOutput = JSON.stringify({ count: 2, items: ['Leave 1', 'Leave 2'] });
      const turn2Response = await provider.generateResponse({
        messages: [
          { role: 'user', content: 'What leaves are pending?' },
          turn1Response.message, // assistant with toolCalls
          {
            role: 'tool',
            content: syntheticToolOutput,
            toolCallId: turn1Response.toolCalls![0].id,
            name: 'getPendingLeaves',
          },
        ],
      });

      expect(turn2Response.finishReason).toBe('stop');
      expect(turn2Response.message.content).toBe('There are 2 pending faculty leave requests.');

      // Invariant: The Responses API input array properly contained the function_call and function_call_output pair!
      const functionCallItem = lastInput.find((i: any) => i.type === 'function_call');
      const functionOutputItem = lastInput.find((i: any) => i.type === 'function_call_output');
      expect(functionCallItem).toBeDefined();
      expect(functionOutputItem).toBeDefined();
      expect(functionCallItem.call_id).toBe('call_turn1');
      expect(functionOutputItem.call_id).toBe('call_turn1');
    });

    it('TC-CGP-15: DigiSkwela RBAC remains authoritative; ChatGPT OAuth identity does NOT grant school roles', async () => {
      const { dispatchTool } = await import('../src/ai/tools/toolDispatcher.js');

      // Attempting to dispatch a Principal tool with a Student role
      const studentContext = {
        user: {
          id: 'student_123',
          roles: ['Student'], // Unauthorized
        },
        correlationId: 'corr_test_rbac',
      };

      await expect(
        dispatchTool('getPendingLeaves', {}, studentContext as any)
      ).rejects.toThrowError(/Role 'Student' is not authorized/i);
    });
  });

  describe('7. Official OpenAI invalid_grant Recovery & Registration Lifecycle', () => {
    it('TC-CGP-16 (A): Issued client survives invalid_grant token exchange failure', async () => {
      let exchangeAttempts = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/oauth/token')) {
          exchangeAttempts++;
          return {
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ error: 'invalid_grant' }),
            headers: {
              get: (header: string) => header.toLowerCase() === 'openai-request-id' ? 'req_test_invalid_grant_123' : null,
            },
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const oauthService = new ChatGPTOAuthService({ storage, fetchFn: mockFetch as any });

      // Step 1: Initial authorization uses dynamic_agent_client
      const initialAuth = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });
      const parsedInitialUrl = new URL(initialAuth.url);
      expect(parsedInitialUrl.searchParams.get('client_id')).toBe('dynamic_agent_client');

      // Step 2: Callback returns issued client_id=oaiapp_test123
      const callbackResult = await oauthService.handleCallback({
        code: 'auth_code_attempt_1',
        state: initialAuth.state,
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
        callbackClientId: 'oaiapp_test123',
      });

      // Token exchange failed with invalid_grant
      expect(callbackResult.success).toBe(false);
      expect(callbackResult.error).toContain('TOKEN_EXCHANGE_FAILED: 400');
      expect(callbackResult.error).toContain('invalid_grant');
      expect(callbackResult.issuedClientId).toBe('oaiapp_test123');

      // Invariant: Tokens were NOT persisted
      const creds = storage.loadCredentials();
      expect(creds).toBeNull();

      // Invariant: Issued registration remains persisted
      const registration = storage.loadRegistration();
      expect(registration).not.toBeNull();
      expect(registration?.issuedClientId).toBe('oaiapp_test123');
    });

    it('TC-CGP-17 (B & C): Next authorization uses retained client ID with fresh PKCE transaction', async () => {
      // Setup: Registration exists from previous failed grant
      storage.saveRegistration({ issuedClientId: 'oaiapp_test123' });

      const oauthService = new ChatGPTOAuthService({ storage });

      // Generate first attempt
      const attempt1 = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });
      const parsedUrl1 = new URL(attempt1.url);

      // Invariant B: Uses retained client ID and NOT dynamic_agent_client
      expect(parsedUrl1.searchParams.get('client_id')).toBe('oaiapp_test123');
      expect(parsedUrl1.searchParams.get('agent_name_hint')).toBeNull();

      // Generate second recovery attempt
      const attempt2 = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });
      const parsedUrl2 = new URL(attempt2.url);

      // Invariant C: Fresh PKCE recovery (different state, nonce, challenge, and client is retained)
      expect(parsedUrl2.searchParams.get('client_id')).toBe('oaiapp_test123');
      expect(attempt2.state).not.toBe(attempt1.state);
      expect(parsedUrl2.searchParams.get('state')).not.toBe(parsedUrl1.searchParams.get('state'));
      expect(parsedUrl2.searchParams.get('nonce')).not.toBe(parsedUrl1.searchParams.get('nonce'));
      expect(parsedUrl2.searchParams.get('code_challenge')).not.toBe(parsedUrl1.searchParams.get('code_challenge'));
    });

    it('TC-CGP-18 (D): Same authorization code is never retried; replay fails locally without token exchange request', async () => {
      let exchangeAttempts = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/oauth/token')) {
          exchangeAttempts++;
          return {
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ error: 'invalid_grant' }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const oauthService = new ChatGPTOAuthService({ storage, fetchFn: mockFetch as any });
      const auth = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });

      // First attempt with auth code
      const res1 = await oauthService.handleCallback({
        code: 'single_use_auth_code_99',
        state: auth.state,
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
        callbackClientId: 'oaiapp_single_use_test',
      });
      expect(res1.success).toBe(false);
      expect(exchangeAttempts).toBe(1);

      // Replay attempt with same state / code
      const res2 = await oauthService.handleCallback({
        code: 'single_use_auth_code_99',
        state: auth.state,
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
        callbackClientId: 'oaiapp_single_use_test',
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('INVALID_STATE');
      // Token endpoint was NOT called a second time
      expect(exchangeAttempts).toBe(1);
    });

    it('TC-CGP-19 (E): Registration alone does not imply connected status', () => {
      // Only registration is persisted; tokens are absent
      storage.saveRegistration({ issuedClientId: 'oaiapp_test_not_connected' });

      expect(storage.loadCredentials()).toBeNull();

      const summary = storage.getStatusSummary();
      expect(summary.registered).toBe(true);
      expect(summary.connected).toBe(false);
      expect(summary.hasDirectTokenScope).toBe(false);
      expect(summary.isExpired).toBe(true);
      expect(summary.issuedClientId).toBe('oaiapp_test_not_connected');
      expect(storage.hasValidPlanAccess()).toBe(false);
    });

    it('TC-CGP-20 (F): Successful recovery promotes credentials and grants connected plan access', async () => {
      // Setup: Retained registration from earlier recovery
      storage.saveRegistration({ issuedClientId: 'oaiapp_recovery_success' });

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/oauth/token')) {
          // Construct valid synthetic ID token
          const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
          const payload = Buffer.from(JSON.stringify({
            iss: 'https://auth.openai.com',
            email: 'user@chatgpt.test',
            'https://api.openai.com/auth': { account_id: 'acc_recovery_123', plan: 'plus' },
          })).toString('base64url');
          const idToken = `${header}.${payload}.mock_sig`;

          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'fresh_recovery_access_token',
              refresh_token: 'fresh_recovery_refresh_token',
              id_token: idToken,
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
              client_id: 'oaiapp_recovery_success',
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const oauthService = new ChatGPTOAuthService({ storage, fetchFn: mockFetch as any });

      // Start fresh recovery authorization
      const recoveryAuth = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });
      expect(new URL(recoveryAuth.url).searchParams.get('client_id')).toBe('oaiapp_recovery_success');

      // Callback succeeds
      const result = await oauthService.handleCallback({
        code: 'recovery_success_code',
        state: recoveryAuth.state,
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
        callbackClientId: 'oaiapp_recovery_success',
      });

      expect(result.success).toBe(true);
      expect(result.identityConnected).toBe(true);
      expect(result.planInferenceAuthorized).toBe(true);
      expect(result.issuedClientId).toBe('oaiapp_recovery_success');

      // Credentials are now validly saved
      const creds = storage.loadCredentials();
      expect(creds?.accessToken).toBe('fresh_recovery_access_token');
      expect(creds?.issuedClientId).toBe('oaiapp_recovery_success');

      const summary = storage.getStatusSummary();
      expect(summary.registered).toBe(true);
      expect(summary.connected).toBe(true);
      expect(summary.hasDirectTokenScope).toBe(true);
      expect(summary.isExpired).toBe(false);
      expect(storage.hasValidPlanAccess()).toBe(true);
    });

    it('TC-CGP-21 (G): Attempting to persist dynamic_agent_client fails closed', () => {
      expect(() => {
        storage.saveRegistration({ issuedClientId: 'dynamic_agent_client' });
      }).toThrowError(/dynamic_agent_client cannot be persisted/i);

      expect(() => {
        storage.saveCredentials({
          accessToken: 'token_bad',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600000,
          scope: 'openid',
          issuedClientId: 'dynamic_agent_client',
        });
      }).toThrowError(/dynamic_agent_client cannot be persisted/i);
    });

    it('TC-CGP-22: Workspace-denied registration is marked WORKSPACE_ASSOCIATION_NOT_VERIFIED and isolated from subsequent authorization', () => {
      // Setup: Registration exists
      storage.saveRegistration({ issuedClientId: 'oaiapp_denied_workspace_1' });

      // Mark workspace unverified with denial metadata
      const marked = storage.markRegistrationWorkspaceUnverified({
        errorCode: '3p_login_workspace_scope_denied',
        requestId: 'req_denied_ws_123',
        message: 'This app is only available to members of its workspace.',
      });
      expect(marked).toBe(true);

      // Invariant: Registration is not deleted
      const rawReg = storage.loadRegistration({ activeOnly: false });
      expect(rawReg).not.toBeNull();
      expect(rawReg?.issuedClientId).toBe('oaiapp_denied_workspace_1');
      expect(rawReg?.status).toBe('WORKSPACE_ASSOCIATION_NOT_VERIFIED');
      expect(rawReg?.denialMetadata?.errorCode).toBe('3p_login_workspace_scope_denied');

      // Invariant: Active registration lookup returns null
      expect(storage.loadRegistration({ activeOnly: true })).toBeNull();

      // Invariant: Status summary reports registered=false and unverified status
      const summary = storage.getStatusSummary();
      expect(summary.registered).toBe(false);
      expect(summary.registrationStatus).toBe('WORKSPACE_ASSOCIATION_NOT_VERIFIED');
      expect(summary.connected).toBe(false);

      // Invariant: Subsequent authorization URL initiates clean dynamic_agent_client registration
      const oauthService = new ChatGPTOAuthService({ storage });
      const auth = oauthService.generateAuthorizationUrl({
        redirectUri: 'http://127.0.0.1:4000/api/ai/chatgpt-plan/callback',
      });
      const parsedUrl = new URL(auth.url);
      expect(parsedUrl.searchParams.get('client_id')).toBe('dynamic_agent_client');
      expect(parsedUrl.searchParams.get('agent_name_hint')).toBe('DigiSkwela');
    });
  });
});

