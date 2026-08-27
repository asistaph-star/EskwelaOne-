import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';

/**
 * Fields that must NEVER appear in audit logs.
 */
const SENSITIVE_FIELDS = [
  'password', 'password_hash', 'passwordHash',
  'token', 'jwt', 'session', 'secret', 'apiKey',
  'accessKey', 'secretKey',
];

/**
 * Strip sensitive fields from an object before storing in audit logs.
 */
function sanitize(obj: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!obj) return null;
  const cleaned = { ...obj };
  for (const key of SENSITIVE_FIELDS) {
    if (key in cleaned) {
      cleaned[key] = '[REDACTED]';
    }
  }
  // Also redact any binary/blob fields
  for (const [k, v] of Object.entries(cleaned)) {
    if (v instanceof Buffer || v instanceof Uint8Array) {
      cleaned[k] = '[BINARY_REDACTED]';
    }
  }
  return cleaned;
}

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  previousState?: Record<string, any> | null;
  newState?: Record<string, any> | null;
  reason?: string | null;
  correlationId?: string | null;
}

/**
 * Create an audit log entry.
 * Can be called inside or outside a transaction.
 * 
 * @param entry - Audit data
 * @param tx - Optional Prisma transaction client (for atomic operations)
 */
export async function createAuditLog(
  entry: AuditEntry,
  tx?: any, // Prisma transaction client
): Promise<void> {
  const client = tx || prisma;
  await client.auditLog.create({
    data: {
      id: generateId(),
      actor_user_id: entry.actorUserId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      previous_state: sanitize(entry.previousState) as any,
      new_state: sanitize(entry.newState) as any,
      reason: entry.reason,
      correlation_id: entry.correlationId,
    },
  });
}
