import { generateId } from '../../common/utils/uuid.js';
import { AppError } from '../../common/middleware/errorHandler.js';

export interface EphemeralSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  responseType?: 'text' | 'structured';
  structuredData?: any;
  provenance?: any;
  navigationActions?: any;
  traceId?: string;
}

export interface EphemeralConversationSession {
  id: string;
  userId: string;
  userRole: string;
  portal: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  messages: EphemeralSessionMessage[];
}

/**
 * Ephemeral In-Memory AI Conversation Session Store
 * 
 * Strict Privacy & Architectural Isolation:
 * - Ephemeral only: stored in-memory, NOT persisted in database tables, database dumps, or logs.
 * - User-scoped & Role-scoped: strictly keyed by userId and portal.
 * - Sliding Inactivity TTL (30 minutes) capped by Max Session Lifetime (8 hours, aligned with JWT_EXPIRES_IN).
 * - Automatic background expiration sweeper.
 * - Fully removable on user clear or logout.
 * - Complete isolation: forged or cross-user conversation IDs are rejected with 403/404.
 */
class AIConversationSessionService {
  // Key: `${userId}:${portal}` -> EphemeralConversationSession
  private userSessions: Map<string, EphemeralConversationSession> = new Map();
  // Key: sessionId (UUID) -> `${userId}:${portal}`
  private sessionIndex: Map<string, string> = new Map();

  // Retention Policies:
  // Inactivity TTL: 30 minutes of inactivity invalidates the session
  // Max Session Lifetime: 8 hours (matches JWT token lifetime)
  private readonly INACTIVITY_TTL_MS = 30 * 60 * 1000;
  private readonly MAX_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
  private readonly MAX_MESSAGES_PER_SESSION = 30;

  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupSweeper();
  }

  private getKey(userId: string, portal: string): string {
    return `${userId}:${portal}`;
  }

  /**
   * Starts periodic sweeper for expired ephemeral sessions (every 5 minutes).
   */
  private startCleanupSweeper() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
    // Unref so timer does not prevent process exit in tests or tools
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Cleans up expired sessions. Returns number of removed sessions.
   */
  public cleanupExpiredSessions(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, session] of this.userSessions.entries()) {
      if (now >= session.expiresAt || (now - session.updatedAt) >= this.INACTIVITY_TTL_MS) {
        this.sessionIndex.delete(session.id);
        this.userSessions.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Retrieve active ephemeral session for the authenticated user and portal.
   * If a conversationId is provided, validates that it strictly belongs to this user & portal.
   */
  public getSession(
    userId: string,
    portal: string,
    conversationId?: string
  ): EphemeralConversationSession | null {
    const key = this.getKey(userId, portal);
    const session = this.userSessions.get(key);

    if (!session) {
      // If a specific conversationId was requested but no session exists, check if it belongs to another user
      if (conversationId && this.sessionIndex.has(conversationId)) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied to the requested AI conversation session.');
      }
      return null;
    }

    // Verify session has not expired
    const now = Date.now();
    if (now >= session.expiresAt || (now - session.updatedAt) >= this.INACTIVITY_TTL_MS) {
      this.userSessions.delete(key);
      this.sessionIndex.delete(session.id);
      return null;
    }

    // If conversationId was supplied, verify ownership strictly
    if (conversationId && session.id !== conversationId) {
      // Check if conversationId belongs to another user
      if (this.sessionIndex.has(conversationId)) {
        throw new AppError(403, 'FORBIDDEN', 'Access denied to the requested AI conversation session.');
      }
      return null;
    }

    // Slide inactivity TTL on read
    session.updatedAt = now;
    session.expiresAt = Math.min(now + this.INACTIVITY_TTL_MS, session.createdAt + this.MAX_SESSION_LIFETIME_MS);

    return session;
  }

  /**
   * Append a conversation turn (user message + assistant message) to the user's active session.
   * Creates a new ephemeral session if none exists.
   */
  public appendTurn(
    userId: string,
    userRole: string,
    portal: string,
    userMessage: EphemeralSessionMessage,
    assistantMessage: EphemeralSessionMessage
  ): EphemeralConversationSession {
    const key = this.getKey(userId, portal);
    const now = Date.now();
    let session = this.userSessions.get(key);

    if (!session || now >= session.expiresAt || (now - session.updatedAt) >= this.INACTIVITY_TTL_MS) {
      // Create new ephemeral session
      const sessionId = generateId();
      session = {
        id: sessionId,
        userId,
        userRole,
        portal,
        createdAt: now,
        updatedAt: now,
        expiresAt: Math.min(now + this.INACTIVITY_TTL_MS, now + this.MAX_SESSION_LIFETIME_MS),
        messages: [],
      };
      this.userSessions.set(key, session);
      this.sessionIndex.set(sessionId, key);
    } else {
      // Update existing session
      session.updatedAt = now;
      session.expiresAt = Math.min(now + this.INACTIVITY_TTL_MS, session.createdAt + this.MAX_SESSION_LIFETIME_MS);
    }

    // Append turn
    session.messages.push(userMessage, assistantMessage);

    // Keep session bounded to MAX_MESSAGES_PER_SESSION
    if (session.messages.length > this.MAX_MESSAGES_PER_SESSION) {
      session.messages = session.messages.slice(-this.MAX_MESSAGES_PER_SESSION);
    }

    return session;
  }

  /**
   * Explicitly clears/deletes the session for a user and portal (e.g. "Clear conversation" button).
   */
  public clearSession(userId: string, portal: string): boolean {
    const key = this.getKey(userId, portal);
    const session = this.userSessions.get(key);
    if (!session) return false;

    this.sessionIndex.delete(session.id);
    this.userSessions.delete(key);
    return true;
  }

  /**
   * Invalidates all active AI sessions for a user (called on user logout).
   */
  public invalidateUserSessions(userId: string): number {
    let invalidatedCount = 0;
    for (const [key, session] of this.userSessions.entries()) {
      if (session.userId === userId) {
        this.sessionIndex.delete(session.id);
        this.userSessions.delete(key);
        invalidatedCount++;
      }
    }
    return invalidatedCount;
  }

  /**
   * For testing & diagnostics only
   */
  public _resetAll(): void {
    this.userSessions.clear();
    this.sessionIndex.clear();
  }

  public _getSessionCount(): number {
    return this.userSessions.size;
  }
}

export const aiConversationSessionService = new AIConversationSessionService();
