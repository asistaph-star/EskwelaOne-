import prisma from '../config/database.js';

export type SecurityTimeWindow = '24h' | '7d';

export interface SecurityOverviewOptions {
  timeWindow?: SecurityTimeWindow;
  isITAdmin: boolean;
}

export interface SecurityOverviewResponse {
  timeWindow: SecurityTimeWindow;
  windowStart: string;
  windowEnd: string;
  scope: 'FULL_ITADMIN' | 'OPERATIONAL_ADMIN';
  kpis: {
    failedLogins: number | null;
    rateLimits: number | null;
    authDenials: number | null;
    passwordResets: number;
    statusChanges: number;
  };
  accountStatus: {
    totalAccounts: number;
    activeAccounts: number;
    inactiveAccounts: number;
    passwordChangeRequired: number;
  };
  recentEvents: Array<{
    id: string;
    created_at: Date;
    action: string;
    category: string | null;
    actor_school_id: string | null;
    actor_role: string | null;
    target_label: string | null;
    result: string;
    ip_address: string | null;
    resource_type: string;
    correlation_id: string | null;
  }>;
}

/**
 * Calculates start Date based on selected time window.
 */
export function getWindowStartDate(window: SecurityTimeWindow): Date {
  const now = Date.now();
  if (window === '7d') {
    return new Date(now - 7 * 24 * 60 * 60 * 1000);
  }
  return new Date(now - 24 * 60 * 60 * 1000);
}

/**
 * Aggregates security KPIs, account state, and recent security events.
 * Bounded server-side execution with role-based metric scoping.
 */
export async function getSecurityOverview(
  options: SecurityOverviewOptions
): Promise<SecurityOverviewResponse> {
  const timeWindow: SecurityTimeWindow = options.timeWindow === '7d' ? '7d' : '24h';
  const since = getWindowStartDate(timeWindow);
  const isITAdmin = Boolean(options.isITAdmin);

  // 1. Live Account Status Queries (Direct User model state)
  const [totalAccounts, activeAccounts, inactiveAccounts, passwordChangeRequired] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { status: { not: 'active' } } }),
      prisma.user.count({ where: { must_change_password: true } }),
    ]);

  // 2. Security Event Metric Queries
  let failedLogins: number | null = null;
  let rateLimits: number | null = null;
  let authDenials: number | null = null;

  const [passwordResets, statusChanges] = await Promise.all([
    prisma.auditLog.count({
      where: {
        created_at: { gte: since },
        action: 'USER_PASSWORD_RESET',
      },
    }),
    prisma.auditLog.count({
      where: {
        created_at: { gte: since },
        action: 'USER_STATUS_CHANGED',
      },
    }),
  ]);

  if (isITAdmin) {
    const [failedLoginsCount, rateLimitsCount, authDenialsCount] = await Promise.all([
      prisma.auditLog.count({
        where: {
          created_at: { gte: since },
          action: 'LOGIN_FAILURE',
        },
      }),
      prisma.auditLog.count({
        where: {
          created_at: { gte: since },
          action: 'AUTH_RATE_LIMIT_TRIGGERED',
        },
      }),
      prisma.auditLog.count({
        where: {
          created_at: { gte: since },
          action: 'AUTH_FORBIDDEN',
        },
      }),
    ]);

    failedLogins = failedLoginsCount;
    rateLimits = rateLimitsCount;
    authDenials = authDenialsCount;
  }

  // 3. Recent Security Events (Bounded to 15 records, privacy-safe projection)
  const whereFilter = isITAdmin
    ? {
        OR: [
          { category: { in: ['SECURITY', 'AUTHENTICATION'] } },
          {
            action: {
              in: [
                'USER_PASSWORD_RESET',
                'USER_STATUS_CHANGED',
                'USER_CREATED',
                'SCHOOL_SETTINGS_UPDATED',
                'SCHOOL_SETTINGS_BRANDING_RESET',
                'BRANDING_ASSET_UPLOADED',
              ],
            },
          },
        ],
      }
    : {
        action: {
          in: [
            'USER_PASSWORD_RESET',
            'USER_STATUS_CHANGED',
            'USER_CREATED',
            'SCHOOL_SETTINGS_UPDATED',
            'SCHOOL_SETTINGS_BRANDING_RESET',
            'BRANDING_ASSET_UPLOADED',
          ],
        },
      };

  const recentEvents = await prisma.auditLog.findMany({
    where: whereFilter,
    orderBy: { created_at: 'desc' },
    take: 15,
    select: {
      id: true,
      created_at: true,
      action: true,
      category: true,
      actor_school_id: true,
      actor_role: true,
      target_label: true,
      result: true,
      ip_address: true,
      resource_type: true,
      correlation_id: true,
    },
  });

  return {
    timeWindow,
    windowStart: since.toISOString(),
    windowEnd: new Date().toISOString(),
    scope: isITAdmin ? 'FULL_ITADMIN' : 'OPERATIONAL_ADMIN',
    kpis: {
      failedLogins,
      rateLimits,
      authDenials,
      passwordResets,
      statusChanges,
    },
    accountStatus: {
      totalAccounts,
      activeAccounts,
      inactiveAccounts,
      passwordChangeRequired,
    },
    recentEvents,
  };
}
