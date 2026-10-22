import fs from 'fs';
import path from 'path';

export type ChatGPTRegistrationStatus = 'ACTIVE' | 'WORKSPACE_ASSOCIATION_NOT_VERIFIED';

export interface ChatGPTRegistration {
  issuedClientId: string;
  createdAt: string;
  updatedAt: string;
  status?: ChatGPTRegistrationStatus;
  denialMetadata?: {
    errorCode?: string;
    requestId?: string;
    deniedAt?: string;
    message?: string;
  };
}

export interface ChatGPTPlanCredentials {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  expiresAt: number; // Unix epoch ms
  scope: string;
  issuedClientId?: string;
  accountId?: string;
  userEmail?: string;
  updatedAt: string;
}

export interface ChatGPTPlanStatusSummary {
  connected: boolean;
  hasDirectTokenScope: boolean;
  expiresInSeconds: number;
  isExpired: boolean;
  registered: boolean;
  registrationStatus?: ChatGPTRegistrationStatus;
  userEmail: string | null;
  statusMessage: string;
  usageGuidance: string;
  issuedClientId: string | null;
  accountId: string | null;
}

const DEFAULT_TOKENS_PATH = path.resolve(process.cwd(), 'storage', 'chatgpt', 'tokens.json');
const DEFAULT_REGISTRATION_PATH = path.resolve(process.cwd(), 'storage', 'chatgpt', 'registration.json');

/**
 * ChatGPT Token & Registration Storage Utility
 * 
 * Formal Invariants:
 * - OpenAI-issued client registration survives independently of OAuth token credentials.
 * - Credentials remain strictly confined to protected server-side runtime storage.
 * - Zero credentials or sensitive tokens exposed in HTTP responses or audit logs.
 * - dynamic_agent_client can NEVER be persisted as an issued client registration.
 * - Workspace-denied registrations are marked WORKSPACE_ASSOCIATION_NOT_VERIFIED and never reused blindly.
 */
export class ChatGPTTokenStorage {
  private readonly tokensFilePath: string;
  private readonly registrationFilePath: string;

  constructor(customTokensPath?: string, customRegistrationPath?: string) {
    this.tokensFilePath = customTokensPath || DEFAULT_TOKENS_PATH;
    if (customRegistrationPath) {
      this.registrationFilePath = customRegistrationPath;
    } else if (customTokensPath) {
      this.registrationFilePath = path.join(path.dirname(customTokensPath), 'registration.json');
    } else {
      this.registrationFilePath = DEFAULT_REGISTRATION_PATH;
    }
  }

  /**
   * Loads the persisted OpenAI-issued client registration independently of OAuth tokens.
   * If activeOnly is true (default), returns null if the registration was marked WORKSPACE_ASSOCIATION_NOT_VERIFIED.
   */
  public loadRegistration(options?: { activeOnly?: boolean }): ChatGPTRegistration | null {
    const activeOnly = options?.activeOnly ?? true;
    try {
      if (!fs.existsSync(this.registrationFilePath)) {
        return null;
      }
      const raw = fs.readFileSync(this.registrationFilePath, 'utf-8');
      const parsed: ChatGPTRegistration = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.issuedClientId === 'string' &&
        parsed.issuedClientId.trim().length > 0 &&
        parsed.issuedClientId !== 'dynamic_agent_client'
      ) {
        if (activeOnly && parsed.status === 'WORKSPACE_ASSOCIATION_NOT_VERIFIED') {
          return null;
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Persists the OpenAI-issued client registration immediately upon receipt.
   * Rejects dynamic_agent_client permanently.
   */
  public saveRegistration(reg: { issuedClientId: string; status?: ChatGPTRegistrationStatus }): void {
    const issuedClientId = reg.issuedClientId?.trim();
    if (!issuedClientId || issuedClientId === 'dynamic_agent_client') {
      throw new Error('REGRESSION_GUARD: dynamic_agent_client cannot be persisted as issued client registration.');
    }

    const dir = path.dirname(this.registrationFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const existing = this.loadRegistration({ activeOnly: false });
    const nowIso = new Date().toISOString();
    const payload: ChatGPTRegistration = {
      issuedClientId,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
      status: reg.status || 'ACTIVE',
    };

    fs.writeFileSync(this.registrationFilePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  /**
   * Marks the current registration as WORKSPACE_ASSOCIATION_NOT_VERIFIED
   * without deleting it, preserving denial diagnostics.
   */
  public markRegistrationWorkspaceUnverified(denial: {
    errorCode?: string;
    requestId?: string;
    message?: string;
  }): boolean {
    const existing = this.loadRegistration({ activeOnly: false });
    if (!existing) return false;

    const updated: ChatGPTRegistration = {
      ...existing,
      status: 'WORKSPACE_ASSOCIATION_NOT_VERIFIED',
      updatedAt: new Date().toISOString(),
      denialMetadata: {
        errorCode: denial.errorCode || '3p_login_workspace_scope_denied',
        requestId: denial.requestId,
        deniedAt: new Date().toISOString(),
        message: denial.message || 'This app is only available to members of its workspace.',
      },
    };

    fs.writeFileSync(this.registrationFilePath, JSON.stringify(updated, null, 2), 'utf-8');
    return true;
  }

  /**
   * Clears the OpenAI-issued client registration.
   */
  public clearRegistration(): boolean {
    try {
      if (fs.existsSync(this.registrationFilePath)) {
        fs.unlinkSync(this.registrationFilePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Loads full OAuth token credentials (requires valid accessToken).
   */
  public loadCredentials(): ChatGPTPlanCredentials | null {
    try {
      if (!fs.existsSync(this.tokensFilePath)) {
        return null;
      }
      const raw = fs.readFileSync(this.tokensFilePath, 'utf-8');
      const parsed: ChatGPTPlanCredentials = JSON.parse(raw);
      if (parsed && typeof parsed.accessToken === 'string' && parsed.accessToken.trim().length > 0) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Persists OAuth token credentials after successful token exchange.
   */
  public saveCredentials(creds: Omit<ChatGPTPlanCredentials, 'updatedAt'>): void {
    if (creds.issuedClientId === 'dynamic_agent_client') {
      throw new Error('REGRESSION_GUARD: dynamic_agent_client cannot be persisted as issuedClientId in credentials.');
    }

    const dir = path.dirname(this.tokensFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const payload: ChatGPTPlanCredentials = {
      ...creds,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(this.tokensFilePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  /**
   * Clears stored OAuth token credentials.
   */
  public clearCredentials(): boolean {
    try {
      if (fs.existsSync(this.tokensFilePath)) {
        fs.unlinkSync(this.tokensFilePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Clears both tokens and registration.
   */
  public clearAll(): boolean {
    const credsCleared = this.clearCredentials();
    const regCleared = this.clearRegistration();
    return credsCleared || regCleared;
  }

  /**
   * Returns sanitized provider status summary.
   * Distinguishes registered client from authenticated account and authorized plan.
   */
  public getStatusSummary(): ChatGPTPlanStatusSummary {
    const registration = this.loadRegistration({ activeOnly: false });
    const creds = this.loadCredentials();
    const issuedClientId = creds?.issuedClientId || registration?.issuedClientId || null;
    const isRegistered = Boolean(
      issuedClientId &&
      issuedClientId !== 'dynamic_agent_client' &&
      registration?.status !== 'WORKSPACE_ASSOCIATION_NOT_VERIFIED'
    );

    if (!creds) {
      return {
        connected: false,
        hasDirectTokenScope: false,
        expiresInSeconds: 0,
        isExpired: true,
        registered: isRegistered,
        registrationStatus: registration?.status || (issuedClientId ? 'ACTIVE' : undefined),
        userEmail: null,
        statusMessage: 'Not connected',
        usageGuidance: 'Connect your ChatGPT Plus or Team account to enable plan delegation.',
        issuedClientId,
        accountId: null,
      };
    }

    const now = Date.now();
    const expiresInSeconds = Math.max(0, Math.floor((creds.expiresAt - now) / 1000));
    const isExpired = creds.expiresAt <= now;
    const hasDirectTokenScope = Boolean(
      creds.scope && creds.scope.includes('chatgpt.tokens.use.direct')
    );

    let statusMessage = 'Using your ChatGPT plan';
    let usageGuidance = 'Manage usage in ChatGPT Settings';

    if (isExpired) {
      statusMessage = 'Session expired';
      usageGuidance = 'Please sign in with ChatGPT again to refresh access.';
    } else if (!hasDirectTokenScope) {
      statusMessage = 'Identity connected (plan inference not authorized)';
      usageGuidance = 'Sign in with direct plan tokens authorized.';
    }

    return {
      connected: !isExpired && hasDirectTokenScope,
      hasDirectTokenScope,
      expiresInSeconds,
      isExpired,
      registered: isRegistered,
      registrationStatus: registration?.status || (issuedClientId ? 'ACTIVE' : undefined),
      userEmail: creds.userEmail || null,
      statusMessage,
      usageGuidance,
      issuedClientId,
      accountId: creds.accountId || null,
    };
  }

  /**
   * Checks if valid unexpired plan access tokens are available.
   */
  public hasValidPlanAccess(): boolean {
    const creds = this.loadCredentials();
    if (!creds) return false;
    const now = Date.now();
    if (creds.expiresAt <= now) return false;
    return Boolean(creds.scope && creds.scope.includes('chatgpt.tokens.use.direct'));
  }
}

export const chatGPTTokenStorage = new ChatGPTTokenStorage();
