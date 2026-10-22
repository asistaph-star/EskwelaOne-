import crypto from 'crypto';
import { getOrCreateHostId } from './chatgptHostId.js';
import { chatGPTTokenStorage, ChatGPTTokenStorage } from './chatgptTokenStorage.js';

export interface PendingOAuthSession {
  state: string;
  nonce: string;
  codeVerifier: string;
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

    // 2. Resolve client ID: reuse issued client ID if present, else dynamic_agent_client
    const creds = this.storage.loadCredentials();
    const clientId = creds?.issuedClientId || 'dynamic_agent_client';
    const hostId = getOrCreateHostId();

    // 3. Generate PKCE, state, and nonce
    const { codeVerifier, codeChallenge } = this.generatePkce();
    const state = this.base64UrlEncode(crypto.randomBytes(24));
    const nonce = this.base64UrlEncode(crypto.randomBytes(24));

    // 4. Save pending session
    this.pendingSessions.set(state, {
      state,
      nonce,
      codeVerifier,
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
      agent_name_hint: options.agentNameHint || 'DigiSkwela',
      ext_agent_host_id: hostId,
    });

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

    // Consume session
    this.pendingSessions.delete(options.state);

    const creds = this.storage.loadCredentials();
    const clientId = creds?.issuedClientId || 'dynamic_agent_client';

    // 1. Exchange code for tokens
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: options.redirectUri,
      client_id: clientId,
      code_verifier: session.codeVerifier,
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

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          identityConnected: false,
          planInferenceAuthorized: false,
          scope: '',
          error: `TOKEN_EXCHANGE_FAILED: ${res.status} ${errorText}`,
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

    const issuedClientId = tokenResponse.client_id || creds?.issuedClientId;
    const accountId = idPayload?.['https://api.openai.com/auth']?.account_id;
    const userEmail = idPayload?.email;

    // 4. Persist credentials securely
    const expiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
    this.storage.saveCredentials({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || creds?.refreshToken,
      idToken: tokenResponse.id_token,
      tokenType: tokenResponse.token_type || 'Bearer',
      expiresAt,
      scope: tokenResponse.scope || '',
      issuedClientId,
      accountId,
      userEmail,
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
    if (!creds || !creds.refreshToken) {
      return { success: false, error: 'NO_REFRESH_TOKEN: Re-authorization required.' };
    }

    const clientId = creds.issuedClientId || 'dynamic_agent_client';
    const bodyParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
      client_id: clientId,
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

      this.storage.saveCredentials({
        ...creds,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || creds.refreshToken,
        idToken: data.id_token || creds.idToken,
        tokenType: data.token_type || creds.tokenType,
        expiresAt,
        scope: data.scope || creds.scope,
        issuedClientId: data.client_id || creds.issuedClientId,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: `REFRESH_NETWORK_ERROR: ${err.message}` };
    }
  }
}

export const chatGPTOAuthService = new ChatGPTOAuthService();
