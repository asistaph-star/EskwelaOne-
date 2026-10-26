import prisma from '../config/database.js';
import { generateId } from '../common/utils/uuid.js';

/**
 * Fields that must NEVER appear in audit logs.
 * Any occurrence in metadata/state will be strictly redacted.
 */
const SENSITIVE_FIELDS = [
  // Passwords, hashes & credentials
  'password',
  'password_hash',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'temporarypassword',
  // Tokens, secrets, auth headers & session identifiers
  'token',
  'jwt',
  'session_id',
  'session_token',
  'sessionid',
  'sessiontoken',
  'secret',
  'apikey',
  'accesskey',
  'secretkey',
  'cookie',
  'cookies',
  'auth_token',
  'authorization',
  // DepEd Learner Reference Numbers
  'lrn',
  'lrn_hash',
  // Medical & health details
  'medical',
  'diagnosis',
  'treatment',
  'medication',
  'allerg',
  'blood_type',
  'symptom',
  'vital',
  'blood_pressure',
  'temperature',
  'heart_rate',
  'clinical_note',
  // Counseling & guidance note content
  'counseling',
  'guidance_note',
  'guidancenote',
  // Guardian contact details
  'guardian_phone',
  'guardian_email',
  'guardian_contact',
  'guardian_mobile',
];

const EXACT_SENSITIVE_KEYS = ['session'];

/**
 * Controlled category classifications.
 */
export const AUDIT_CATEGORIES = [
  'AUTHENTICATION',
  'ACCOUNT',
  'CONFIGURATION',
  'ACADEMIC',
  'ATTENDANCE',
  'STUDENT_SERVICES',
  'SECURITY',
  'SYSTEM',
] as const;

export type AuditCategory = typeof AUDIT_CATEGORIES[number];

/**
 * Controlled result states.
 */
export const AUDIT_RESULTS = ['SUCCESS', 'FAILURE', 'DENIED'] as const;
export type AuditResult = typeof AUDIT_RESULTS[number];

/**
 * Derives controlled category from action and resourceType.
 */
export function deriveCategory(action: string, resourceType?: string): AuditCategory {
  const upperAction = action.toUpperCase();
  const lowerResource = (resourceType || '').toLowerCase();

  if (
    upperAction.includes('LOGIN') ||
    upperAction.includes('LOGOUT') ||
    upperAction.includes('PASSWORD') ||
    lowerResource === 'auth'
  ) {
    if (upperAction.includes('RATE_LIMIT') || upperAction.includes('FORBIDDEN')) {
      return 'SECURITY';
    }
    return 'AUTHENTICATION';
  }

  if (
    upperAction.startsWith('USER_') ||
    lowerResource === 'user' ||
    lowerResource === 'account'
  ) {
    return 'ACCOUNT';
  }

  if (
    upperAction.startsWith('SCHOOL_SETTINGS_') ||
    upperAction.includes('BRANDING') ||
    lowerResource === 'school_settings' ||
    lowerResource === 'settings'
  ) {
    return 'CONFIGURATION';
  }

  if (
    upperAction.includes('GRADEBOOK') ||
    upperAction.includes('ENROLLMENT') ||
    upperAction.includes('EXCUSE_LETTER') ||
    upperAction.includes('APPOINTMENT') ||
    lowerResource === 'gradebook' ||
    lowerResource === 'enrollment' ||
    lowerResource === 'academic'
  ) {
    return 'ACADEMIC';
  }

  if (
    upperAction.includes('ATTENDANCE') ||
    lowerResource === 'attendance' ||
    lowerResource === 'gate'
  ) {
    return 'ATTENDANCE';
  }

  if (
    upperAction.includes('CLINIC') ||
    upperAction.includes('GUIDANCE') ||
    upperAction.includes('BEHAVIOR') ||
    upperAction.includes('DOCUMENT') ||
    lowerResource === 'clinic' ||
    lowerResource === 'guidance' ||
    lowerResource === 'behavior' ||
    lowerResource === 'document'
  ) {
    return 'STUDENT_SERVICES';
  }

  if (upperAction.includes('SECURITY') || upperAction.includes('DENIED') || upperAction.includes('RATE_LIMIT')) {
    return 'SECURITY';
  }

  return 'SYSTEM';
}

/**
 * Derives controlled result from action string.
 */
export function deriveResult(action: string, explicitResult?: string): AuditResult {
  if (explicitResult && (AUDIT_RESULTS as readonly string[]).includes(explicitResult)) {
    return explicitResult as AuditResult;
  }
  const upper = action.toUpperCase();
  if (upper.includes('FORBIDDEN') || upper.includes('DENIED')) {
    return 'DENIED';
  }
  if (upper.includes('FAIL') || upper.includes('FAILED') || upper.includes('FAILURE')) {
    return 'FAILURE';
  }
  return 'SUCCESS';
}

/**
 * Deeply and recursively strips sensitive fields and enforces bounds on metadata.
 * Handles nested objects, arbitrary-depth arrays, and case/separator normalization.
 */
export function sanitizeMetadata(val: any): any {
  if (val === null || val === undefined) return null;

  const MAX_STR_LEN = 500;

  if (val instanceof Buffer || val instanceof Uint8Array) {
    return '[BINARY_REDACTED]';
  }

  if (typeof val !== 'object') {
    if (typeof val === 'string') {
      return val.length > MAX_STR_LEN ? val.substring(0, MAX_STR_LEN) + '...[TRUNCATED]' : val;
    }
    return val;
  }

  if (Array.isArray(val)) {
    return val.map(item => sanitizeMetadata(item));
  }

  const cleaned: Record<string, any> = {};

  for (const [rawKey, rawValue] of Object.entries(val)) {
    const keyLower = rawKey.toLowerCase().replace(/[-_]/g, '');
    const isSensitive =
      EXACT_SENSITIVE_KEYS.includes(keyLower) ||
      SENSITIVE_FIELDS.some(s => keyLower.includes(s.replace(/[-_]/g, '')));

    if (isSensitive) {
      cleaned[rawKey] = '[REDACTED]';
      continue;
    }

    cleaned[rawKey] = sanitizeMetadata(rawValue);
  }

  return cleaned;
}

export interface AuditEntry {
  actorUserId?: string | null;
  actorSchoolId?: string | null;
  actorRole?: string | null;
  action: string;
  category?: AuditCategory | string | null;
  resourceType?: string;
  resourceId?: string | null;
  targetLabel?: string | null;
  result?: AuditResult | string;
  ipAddress?: string | null;
  userAgent?: string | null;
  previousState?: Record<string, any> | null;
  newState?: Record<string, any> | null;
  reason?: string | null;
  correlationId?: string | null;
  critical?: boolean;
}

/**
 * Create an audit log entry.
 * Can be called inside or outside a Prisma transaction.
 * Append-only by design: does NOT expose any mutation or deletion capabilities.
 */
export async function createAuditLog(
  entry: AuditEntry,
  tx?: any,
): Promise<void> {
  const client = tx || prisma;
  const category = (entry.category as AuditCategory) || deriveCategory(entry.action, entry.resourceType);
  const result = deriveResult(entry.action, entry.result);

  // Bounded safe field trimming
  const ip = entry.ipAddress ? entry.ipAddress.substring(0, 45) : null;
  const userAgent = entry.userAgent ? entry.userAgent.substring(0, 255) : null;
  const targetLabel = entry.targetLabel ? entry.targetLabel.substring(0, 255) : null;
  const actorRole = entry.actorRole ? entry.actorRole.substring(0, 50) : null;
  const actorSchoolId = entry.actorSchoolId ? entry.actorSchoolId.substring(0, 100) : null;

  try {
    await client.auditLog.create({
      data: {
        id: generateId(),
        actor_user_id: entry.actorUserId || null,
        actor_school_id: actorSchoolId,
        actor_role: actorRole,
        action: entry.action.substring(0, 100),
        category: category.substring(0, 50),
        resource_type: (entry.resourceType || 'system').substring(0, 50),
        resource_id: entry.resourceId ? entry.resourceId.substring(0, 36) : null,
        target_label: targetLabel,
        result,
        ip_address: ip,
        user_agent: userAgent,
        previous_state: sanitizeMetadata(entry.previousState) as any,
        new_state: sanitizeMetadata(entry.newState) as any,
        reason: entry.reason ? entry.reason.substring(0, 255) : null,
        correlation_id: entry.correlationId ? entry.correlationId.substring(0, 36) : null,
      },
    });
  } catch (err) {
    console.error('[AUDIT_PERSISTENCE_FAILURE]', err);
    // If running inside a transaction or marked critical, rethrow to preserve transaction integrity
    if (tx || entry.critical) {
      throw err;
    }
  }
}

export interface AuditQueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  action?: string;
  actorUserId?: string;
  actorSchoolId?: string;
  actorRole?: string;
  result?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Query audit logs with pagination and bounded filtering.
 * Strictly read-only application access.
 */
export async function getAuditLogs(options: AuditQueryOptions) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (options.category && options.category !== 'ALL') {
    where.category = options.category;
  }

  if (options.action && options.action !== 'ALL') {
    where.action = options.action;
  }

  if (options.result && options.result !== 'ALL') {
    where.result = options.result;
  }

  if (options.actorUserId) {
    where.actor_user_id = options.actorUserId;
  }

  if (options.actorSchoolId) {
    where.actor_school_id = {
      contains: options.actorSchoolId,
      mode: 'insensitive',
    };
  }

  if (options.actorRole && options.actorRole !== 'ALL') {
    where.actor_role = options.actorRole;
  }

  // Date range filtering
  if (options.startDate || options.endDate) {
    where.created_at = {};
    if (options.startDate) {
      const parsedStart = new Date(options.startDate);
      if (!isNaN(parsedStart.getTime())) {
        where.created_at.gte = parsedStart;
      }
    }
    if (options.endDate) {
      const parsedEnd = new Date(options.endDate);
      if (!isNaN(parsedEnd.getTime())) {
        where.created_at.lte = parsedEnd;
      }
    }
  }

  // Search filter across target_label, actor_school_id, action, correlation_id
  if (options.search && options.search.trim().length > 0) {
    const term = options.search.trim();
    where.OR = [
      { action: { contains: term, mode: 'insensitive' } },
      { target_label: { contains: term, mode: 'insensitive' } },
      { actor_school_id: { contains: term, mode: 'insensitive' } },
      { correlation_id: { contains: term, mode: 'insensitive' } },
      { ip_address: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            school_id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    }),
  ]);

  const sanitizedItems = items.map(item => ({
    ...item,
    previous_state: sanitizeMetadata(item.previous_state),
    new_state: sanitizeMetadata(item.new_state),
  }));

  return {
    items: sanitizedItems,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Retrieve single sanitized audit record by ID.
 * Enforces read-time recursive metadata sanitization for historical privacy.
 */
export async function getAuditLogById(id: string) {
  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      actor: {
        select: {
          id: true,
          school_id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
      },
    },
  });

  if (!log) return null;

  return {
    ...log,
    previous_state: sanitizeMetadata(log.previous_state),
    new_state: sanitizeMetadata(log.new_state),
  };
}

/**
 * Operational metrics for summary strip (Events Today, Failed Auth, Denials, Admin Changes).
 */
export async function getAuditSummaryCounts() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [eventsToday, failedAuthToday, denialsToday, adminChangesToday] = await Promise.all([
    prisma.auditLog.count({
      where: { created_at: { gte: startOfDay } },
    }),
    prisma.auditLog.count({
      where: {
        created_at: { gte: startOfDay },
        category: 'AUTHENTICATION',
        result: 'FAILURE',
      },
    }),
    prisma.auditLog.count({
      where: {
        created_at: { gte: startOfDay },
        result: 'DENIED',
      },
    }),
    prisma.auditLog.count({
      where: {
        created_at: { gte: startOfDay },
        category: { in: ['ACCOUNT', 'CONFIGURATION'] },
      },
    }),
  ]);

  return {
    eventsToday,
    failedAuthToday,
    denialsToday,
    adminChangesToday,
  };
}
