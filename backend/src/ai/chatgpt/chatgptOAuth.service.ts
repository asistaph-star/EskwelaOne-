import crypto from 'crypto';
import { getOrCreateHostId } from './chatgptHostId.js';
import { chatGPTTokenStorage, ChatGPTTokenStorage } from './chatgptTokenStorage.js';

export interface PendingOAuthSession {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  registrationMode: 'new' | 'returning';
  expectedClientId?: string;
  createdAt: number;
}

export interface ChatGPTAuthUrlResult {
  url: string;
  state: string;
  hostId: string;
  clientId: string;
}

export interface ChatGPTCallbackResult {
  success: boolean;
  identityConnected: boolean;
  planInferenceAuthorized: boolean;
  scope: string;
  error?: string;
  userEmail?: string;
  issuedClientId?: string;
}

export interface ChatGPTTokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
  client_id?: string;
}

export interface ChatGPTIdTokenPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  'https://api.openai.com/auth'?: {
    user_id?: string;
    account_id?: string;
    plan?: string;
  };
}

/**
 * ChatGPT OAuth Service
 * 
 * Formal Invariants:
 * - Implements official OpenID Connect & OAuth 2.0 Authorization Code flow with PKCE (S256).
 * - Dynamic client registration via `client_id=dynamic_agent_client` on initial connection.
 * - Stores and reuses issued `client_id` on subsequent routine authorizations and refreshes.
 * - Opaque stable host identifier `ext_agent_host_id` per installation.
 * - Enforces explicit validation of the `chatgpt.tokens.use.direct` scope for plan-usage eligibility.
 */
export class ChatGPTOAuthService {
  private readonly storage: ChatGPTTokenStorage;
  private readonly pendingSessions: Map<string, PendingOAuthSession> = new Map();
  private readonly sessionTtlMs = 10 * 60 * 1000; // 10 minutes
  private readonly fetchFn: typeof fetch;

  public readonly issuer = 'https://auth.openai.com';
  public readonly authorizeUrl = 'https://auth.openai.com/api/accounts/authorize';
  public readonly tokenUrl = 'https://auth.openai.com/api/accounts/oauth/token';
  public readonly resource = 'https://api.openai.com/v1';
  public readonly requiredScopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'resource.invoke',
    'chatgpt.tokens.use.direct'
  ];

  constructor(options?: { storage?: ChatGPTTokenStorage; fetchFn?: typeof fetch }) {
    this.storage = options?.storage || chatGPTTokenStorage;
    this.fetchFn = options?.fetchFn || globalThis.fetch;
  }

  /**
   * Helper: Base64URL encoding without padding
   */
  public base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Helper: Generate PKCE S256 Challenge and Verifier
   */
  public generatePkce(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = this.base64UrlEncode(crypto.randomBytes(32));
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = this.base64UrlEncode(hash);
    return { codeVerifier, codeChallenge };
  }

  /**
   * Generates authorization URL for the user to sign in with ChatGPT.
   */
  public generateAuthorizationUrl(options: {
    redirectUri: string;
    agentNameHint?: string;
  }): ChatGPTAuthUrlResult {
    // 1. Clean expired pending sessions
    const now = Date.now();
    for (const [key, session] of this.pendingSessions.entries()) {
      if (now - session.createdAt > this.sessionTtlMs) {
        this.pendingSessions.delete(key);
      }
    }

    // 2. Resolve client ID: reuse valid issued client ID if present in registration or credentials, else dynamic_agent_client
    const registration = this.storage.loadRegistration();
    const creds = this.storage.loadCredentials();
    const existingIssuedClientId = registration?.issuedClientId || creds?.issuedClientId;
    const isReturning = !!(existingIssuedClientId && existingIssuedClientId !== 'dynamic_agent_client');
    const clientId = isReturning ? existingIssuedClientId! : 'dynamic_agent_client';
    const hostId = getOrCreateHostId();

    // 3. Generate PKCE, state, and nonce
    const { codeVerifier, codeChallenge } = this.generatePkce();
    const state = this.base64UrlEncode(crypto.randomBytes(24));
    const nonce = this.base64UrlEncode(crypto.randomBytes(24));

    // 4. Save pending session with registration context
    this.pendingSessions.set(state, {
      state,
      nonce,
      codeVerifier,
      redirectUri: options.redirectUri,
      registrationMode: isReturning ? 'returning' : 'new',
      expectedClientId: isReturning ? clientId : undefined,
      createdAt: now,
    });

    // 5. Build authoritative authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: options.redirectUri,
      scope: this.requiredScopes.join(' '),
      resource: this.resource,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
      ext_agent_host_id: hostId,
    });

    if (!isReturning) {
      params.set('agent_name_hint', options.agentNameHint || 'DigiSkwela');
    }

    return {
      url: `${this.authorizeUrl}?${params.toString()}`,
      state,
      hostId,
      clientId,
    };
  }

  /**
   * Handles loopback OAuth callback with authorization code exchange.
   */
  public async handleCallback(options: {
    code: string;
    state: string;
    redirectUri: string;
    callbackClientId?: string;
  }): Promise<ChatGPTCallbackResult> {
    const session = this.pendingSessions.get(options.state);
    if (!session) {
      return {
        success: false,
        identityConnected: false,
        planInferenceAuthorized: false,
        scope: '',
        error: 'INVALID_STATE: OAuth state not found or expired.',
      };
    }

    // Consume session immediately to prevent replay
    this.pendingSessions.delete(options.state);

    // Validate redirect URI matches the attempt
    if (session.redirectUri && session.redirectUri !== options.redirectUri) {
      return {
        success: false,
        identityConnected: false,
        planInferenceAuthorized: false,
        scope: '',
        error: 'INVALID_REDIRECT_URI: Callback URI does not match initiated authorization attempt.',
      };
    }

    // Resolve token exchange client ID based on registration mode
    let exchangeClientId: string;

    if (session.registrationMode === 'new') {
      const callbackIssuedClientId = options.callbackClientId?.trim();

      if (!callbackIssuedClientId) {
        return {
          success: false,
          identityConnected: false,
          planInferenceAuthorized: false,
          scope: '',
          error: 'INCOMPLETE_REGISTRATION: OpenAI callback did not return an issued client_id parameter.',
        };
      }

      if (callbackIssuedClientId === 'dynamic_agent_client') {
        return {
          success: false,
          identityConnected: false,
          planInferenceAuthorized: false,
          scope: '',
          error: 'INVALID_CLIENT_ID: dynamic_agent_client cannot be used as token exchange client ID.',
        };
      }

      exchangeClientId = callbackIssuedClientId;

      // CRITICAL: Persist issued client registration IMMEDIATELY upon receiving validated callback,
      // BEFORE attempting token exchange so that it survives any exchange errors (e.g., invalid_grant).
      this.storage.saveRegistration({
        issuedClientId: exchangeClientId,
      });
    } else {
      // Returning account re-authorization
      exchangeClientId = session.expectedClientId!;

      if (options.callbackClientId && options.callbackClientId !== exchangeClientId) {
        return {
          success: false,
          identityConnected: false,
          planInferenceAuthorized: false,
          scope: '',
          error: 'CLIENT_ID_MISMATCH: Callback client ID does not match registered returning client ID.',
        };
      }

      // Ensure registration remains saved/up to date
      this.storage.saveRegistration({
        issuedClientId: exchangeClientId,
      });
    }

    // Explicit Section 6 regression guard
    if (exchangeClientId === 'dynamic_agent_client') {
      return {
        success: false,
        identityConnected: false,
        planInferenceAuthorized: false,
        scope: '',
        error: 'REGRESSION_GUARD: Token exchange client ID must not be dynamic_agent_client.',
      };
    }

    if (session.registrationMode === 'new' && exchangeClientId !== options.callbackClientId) {
      return {
        success: false,
        identityConnected: false,
        planInferenceAuthorized: false,
        scope: '',
        error: 'REGRESSION_GUARD: Token exchange client ID must match issuedClientIdFromValidatedCallback.',
      };
    }

    // 1. Exchange code for tokens using form encoding and issued client ID
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: exchangeClientId,
      code: options.code,
      code_verifier: session.codeVerifier,
      redirect_uri: options.redirectUri,
      resource: this.resource,
    });

    let tokenResponse: ChatGPTTokenExchangeResponse;
    try {
      const res = await this.fetchFn(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      const reqId = (typeof res.headers?.get === 'function')
        ? (res.headers.get('openai-request-id') || res.headers.get('x-request-id') || undefined)
        : undefined;

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          identityConnected: false,
          planInferenceAuthorized: false,
          scope: '',
          error: `TOKEN_EXCHANGE_FAILED: ${res.status} ${errorText}${reqId ? ` (request-id: ${reqId})` : ''}`,
          issuedClientId: exchangeClientId,
        };
      }

      tokenResponse = (await res.json()) as ChatGPTTokenExchangeResponse;
    } catch (err: any) {
      return {
        success: false,
        identityConnected: false,
        planInferenceAuthorized: false,
        scope: '',
        error: `TOKEN_NETWORK_ERROR: ${err.message}`,
        issuedClientId: exchangeClientId,
      };
    }

    // 2. Validate ID Token if present
    let idPayload: ChatGPTIdTokenPayload | undefined;
    if (tokenResponse.id_token) {
      const parts = tokenResponse.id_token.split('.');
      if (parts.length === 3) {
        try {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
          idPayload = JSON.parse(payloadJson);

          // Verify issuer & nonce
          if (idPayload?.iss && !idPayload.iss.includes('auth.openai.com')) {
            return {
              success: false,
              identityConnected: false,
              planInferenceAuthorized: false,
              scope: tokenResponse.scope || '',
              error: `ID_TOKEN_ISSUER_MISMATCH: expected auth.openai.com, got ${idPayload.iss}`,
            };
          }

          if (idPayload?.nonce && idPayload.nonce !== session.nonce) {
            return {
              success: false,
              identityConnected: false,
              planInferenceAuthorized: false,
              scope: tokenResponse.scope || '',
              error: 'ID_TOKEN_NONCE_MISMATCH: potential replay attack detected.',
            };
          }
        } catch {
          // Parse warning only
        }
      }
    }

    // 3. Verify granted scopes for ChatGPT plan inference
    const grantedScopes = tokenResponse.scope ? tokenResponse.scope.split(' ') : [];
    const hasDirectTokenScope = grantedScopes.includes('chatgpt.tokens.use.direct');

    const issuedClientId = tokenResponse.client_id || exchangeClientId;
    if (issuedClientId === 'dynamic_agent_client') {
      return {
        success: false,
        identityConnected: false,
        planInferenceAuthorized: false,
        scope: '',
        error: 'REGRESSION_GUARD: dynamic_agent_client cannot be persisted as issuedClientId.',
      };
    }

    const accountId = idPayload?.['https://api.openai.com/auth']?.account_id;
    const userEmail = idPayload?.email;

    // 4. Persist credentials securely
    const expiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
    this.storage.saveCredentials({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      idToken: tokenResponse.id_token,
      tokenType: tokenResponse.token_type || 'Bearer',
      expiresAt,
      scope: tokenResponse.scope || '',
      issuedClientId,
      accountId,
      userEmail,
    });

    // Ensure registration also matches the issued client ID
    this.storage.saveRegistration({
      issuedClientId,
    });

    return {
      success: true,
      identityConnected: true,
      planInferenceAuthorized: hasDirectTokenScope,
      scope: tokenResponse.scope || '',
      userEmail,
      issuedClientId,
    };
  }

  /**
   * Refreshes access token using stored refresh token.
   */
  public async refreshAccessToken(): Promise<{ success: boolean; error?: string }> {
    const creds = this.storage.loadCredentials();
    const registration = this.storage.loadRegistration();
    if (!creds || !creds.refreshToken) {
      return { success: false, error: 'NO_REFRESH_TOKEN: Re-authorization required.' };
    }

    const clientId = creds.issuedClientId || registration?.issuedClientId;
    if (!clientId || clientId === 'dynamic_agent_client') {
      return { success: false, error: 'INVALID_CLIENT_ID: No valid issued client ID available for refresh.' };
    }

    const bodyParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
      client_id: clientId,
      resource: this.resource,
    });

    try {
      const res = await this.fetchFn(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return { success: false, error: `REFRESH_FAILED: ${res.status} ${errorText}` };
      }

      const data = (await res.json()) as ChatGPTTokenExchangeResponse;
      const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      const newIssuedClientId = data.client_id || creds.issuedClientId || clientId;

      this.storage.saveCredentials({
        ...creds,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || creds.refreshToken,
        idToken: data.id_token || creds.idToken,
        tokenType: data.token_type || creds.tokenType,
        expiresAt,
        scope: data.scope || creds.scope,
        issuedClientId: newIssuedClientId,
      });

      this.storage.saveRegistration({
        issuedClientId: newIssuedClientId,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: `REFRESH_NETWORK_ERROR: ${err.message}` };
    }
  }
}

export const chatGPTOAuthService = new ChatGPTOAuthService();
