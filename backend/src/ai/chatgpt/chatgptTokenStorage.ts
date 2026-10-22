import fs from 'fs';
import path from 'path';

export interface ChatGPTRegistration {
  issuedClientId: string;
  createdAt: string;
  updatedAt: string;
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
  issuedClientId: string | null;
  accountId: string | null;
  userEmail: string | null;
  registered: boolean;
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
   */
  public loadRegistration(): ChatGPTRegistration | null {
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
  public saveRegistration(reg: { issuedClientId: string }): void {
    const issuedClientId = reg.issuedClientId?.trim();
    if (!issuedClientId || issuedClientId === 'dynamic_agent_client') {
      throw new Error('REGRESSION_GUARD: dynamic_agent_client cannot be persisted as issued client registration.');
    }

    const dir = path.dirname(this.registrationFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const existing = this.loadRegistration();
    const nowIso = new Date().toISOString();
    const payload: ChatGPTRegistration = {
      issuedClientId,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    fs.writeFileSync(this.registrationFilePath, JSON.stringify(payload, null, 2), 'utf-8');
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
    const registration = this.loadRegistration();
    const creds = this.loadCredentials();
    const issuedClientId = creds?.issuedClientId || registration?.issuedClientId || null;
    const isRegistered = Boolean(issuedClientId && issuedClientId !== 'dynamic_agent_client');

    if (!creds) {
      return {
        connected: false,
        hasDirectTokenScope: false,
        expiresInSeconds: 0,
        isExpired: true,
        issuedClientId,
        accountId: null,
        userEmail: null,
        registered: isRegistered,
      };
    }

    const now = Date.now();
    const expiresInSeconds = Math.max(0, Math.floor((creds.expiresAt - now) / 1000));
    const isExpired = creds.expiresAt <= now;
    const hasDirectTokenScope = Boolean(
      creds.scope && creds.scope.includes('chatgpt.tokens.use.direct')
    );

    return {
      connected: !isExpired,
      hasDirectTokenScope,
      expiresInSeconds,
      isExpired,
      issuedClientId,
      accountId: creds.accountId || null,
      userEmail: creds.userEmail || null,
      registered: isRegistered,
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
