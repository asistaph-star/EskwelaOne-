import fs from 'fs';
import path from 'path';

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
}

const DEFAULT_TOKENS_PATH = path.resolve(process.cwd(), 'storage', 'chatgpt', 'tokens.json');

/**
 * ChatGPT Token Storage Utility
 * 
 * Formal Invariants:
 * - Credentials remain strictly confined to protected server-side runtime storage.
 * - Never exposed in HTTP responses to the frontend.
 * - Never written to AIAuditLog or console logs.
 */
export class ChatGPTTokenStorage {
  private readonly filePath: string;

  constructor(customPath?: string) {
    this.filePath = customPath || DEFAULT_TOKENS_PATH;
  }

  public loadCredentials(): ChatGPTPlanCredentials | null {
    try {
      if (!fs.existsSync(this.filePath)) {
        return null;
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed: ChatGPTPlanCredentials = JSON.parse(raw);
      if (parsed && typeof parsed.accessToken === 'string') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  public saveCredentials(creds: Omit<ChatGPTPlanCredentials, 'updatedAt'>): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const payload: ChatGPTPlanCredentials = {
      ...creds,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  public clearCredentials(): boolean {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public getStatusSummary(): ChatGPTPlanStatusSummary {
    const creds = this.loadCredentials();
    if (!creds) {
      return {
        connected: false,
        hasDirectTokenScope: false,
        expiresInSeconds: 0,
        isExpired: true,
        issuedClientId: null,
        accountId: null,
        userEmail: null,
      };
    }

    const now = Date.now();
    const expiresInSeconds = Math.max(0, Math.floor((creds.expiresAt - now) / 1000));
    const isExpired = creds.expiresAt <= now;
    const hasDirectTokenScope = Boolean(
      creds.scope && creds.scope.includes('chatgpt.tokens.use.direct')
    );

    return {
      connected: true,
      hasDirectTokenScope,
      expiresInSeconds,
      isExpired,
      issuedClientId: creds.issuedClientId || null,
      accountId: creds.accountId || null,
      userEmail: creds.userEmail || null,
    };
  }

  public hasValidPlanAccess(): boolean {
    const creds = this.loadCredentials();
    if (!creds) return false;
    const now = Date.now();
    if (creds.expiresAt <= now) return false;
    return Boolean(creds.scope && creds.scope.includes('chatgpt.tokens.use.direct'));
  }
}

export const chatGPTTokenStorage = new ChatGPTTokenStorage();
