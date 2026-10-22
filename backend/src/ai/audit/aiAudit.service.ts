import prisma from '../../config/database.js';
import { generateId } from '../../common/utils/uuid.js';

export interface RecordAIAuditEntry {
  traceId: string;
  userId: string;
  role: string;
  portal: string;
  scopeDecision: 'ALLOWED' | 'OUT_OF_SCOPE' | 'RATE_LIMITED' | 'UNAUTHORIZED' | string;
  toolsRequested: string[];
  toolsExecuted: string[];
  status: 'SUCCESS' | 'ERROR' | 'SECURITY_BLOCKED';
  providerMode: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    requestedMode?: string;
    primaryProvider?: string;
    finalProvider?: string;
    failoverOccurred?: boolean;
    failoverReason?: string | null;
    model?: string | null;
    [key: string]: any;
  } | null;
}

/**
 * AI Audit Logging Service
 * 
 * Records metadata-minimized AI audit entries.
 * Strictly EXCLUDES:
 * - Raw user prompt strings
 * - Raw LLM narrative completions
 * - Complete conversation transcripts
 * - Student/teacher names
 * - Direct clinical or guidance content
 * 
 * Retention Notice:
 * Purge schedule REQUIRES SCHOOL / DPO POLICY CONFIRMATION.
 */
export async function recordAIAuditLog(entry: RecordAIAuditEntry): Promise<void> {
  try {
    await prisma.aIAuditLog.create({
      data: {
        id: generateId(),
        trace_id: entry.traceId,
        user_id: entry.userId,
        role: entry.role,
        portal: entry.portal,
        scope_decision: entry.scopeDecision,
        tools_requested: entry.toolsRequested as any,
        tools_executed: entry.toolsExecuted as any,
        status: entry.status,
        provider_mode: entry.providerMode,
        latency_ms: entry.latencyMs,
        token_usage: entry.tokenUsage as any,
      }
    });
  } catch (err) {
    // Non-blocking error logging to ensure failure in audit recording does not crash request
    console.error('Failed to persist AIAuditLog entry:', err);
  }
}
