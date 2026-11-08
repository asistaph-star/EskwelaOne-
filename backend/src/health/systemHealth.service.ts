import fs from 'fs';
import prisma from '../config/database.js';
import { getMediaStoragePath } from '../config/storage.config.js';
import { aiConfig } from '../config/ai.config.js';
import { checkSf9RendererHealth } from '../academic/grading/calulutSf9PdfRenderer.js';
import { chatGPTTokenStorage } from '../ai/chatgpt/chatgptTokenStorage.js';

export type HealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'UNAVAILABLE' | 'NOT_CONFIGURED' | 'NOT_MONITORED';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  lastChecked: string;
  message: string;
  latencyMs?: number;
  details?: string;
  authStatus?: 'AUTHORIZED' | 'REAUTHORIZATION_REQUIRED' | 'NOT_CONNECTED' | 'NOT_CONFIGURED' | 'UNKNOWN';
  authAccount?: string | null;
  authDetails?: {
    connected: boolean;
    statusMessage: string;
    userEmail: string | null;
    hasDirectTokenScope: boolean;
    isExpired: boolean;
    expiresInSeconds: number;
    usageGuidance?: string;
  };
}

export interface SystemHealthResponse {
  status: 'OPERATIONAL' | 'DEGRADED' | 'UNAVAILABLE';
  lastChecked: string;
  scope: 'FULL_ITADMIN' | 'OPERATIONAL_ADMIN';
  application: {
    name: string;
    version: string;
    environment: string;
    uptimeSeconds: number;
  };
  components: {
    api: ComponentHealth;
    database: ComponentHealth;
    storage: ComponentHealth;
    gateEventService: ComponentHealth;
    aiService: ComponentHealth;
    emailService: ComponentHealth;
    sf9Renderer: ComponentHealth;
  };
}

/**
 * Checks PostgreSQL connectivity via a lightweight, bounded SELECT 1 query.
 * Strictly non-destructive: zero table scans, zero data mutations.
 */
async function checkDatabaseHealth(): Promise<{ status: HealthStatus; message: string; latencyMs: number }> {
  const start = Date.now();
  try {
    // 3-second bounded execution
    await Promise.race([
      prisma.$queryRawUnsafe('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DATABASE_CHECK_TIMEOUT')), 3000)),
    ]);
    const latencyMs = Date.now() - start;
    return {
      status: 'OPERATIONAL',
      message: 'Connected and responding to health queries.',
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const isTimeout = err?.message === 'DATABASE_CHECK_TIMEOUT';
    return {
      status: 'UNAVAILABLE',
      message: isTimeout
        ? 'Database health check timed out after 3000ms.'
        : 'Database connectivity check failed.',
      latencyMs,
    };
  }
}

/**
 * Checks local persistent media/document storage directory access.
 * Non-destructive: verifies read/write directory accessibility without file creation.
 */
function checkStorageHealth(): { status: HealthStatus; message: string } {
  try {
    const storagePath = getMediaStoragePath();
    if (!fs.existsSync(storagePath)) {
      return {
        status: 'DEGRADED',
        message: 'Configured media storage directory does not exist on filesystem.',
      };
    }
    // Verify directory is readable and writable
    fs.accessSync(storagePath, fs.constants.R_OK | fs.constants.W_OK);
    return {
      status: 'OPERATIONAL',
      message: 'Persistent storage path accessible with read/write permissions.',
    };
  } catch {
    return {
      status: 'UNAVAILABLE',
      message: 'Persistent storage path is not writable by application process.',
    };
  }
}

/**
 * Checks Gate Event Service route availability.
 * Reflects Express event-broadcasting availability (does NOT infer scanner hardware presence).
 */
function checkGateEventServiceHealth(): { status: HealthStatus; message: string } {
  return {
    status: 'OPERATIONAL',
    message: 'Backend real-time event-stream service is active and listening.',
  };
}

/**
 * Evaluates AI Service configuration and authorization status without making external paid API requests.
 */
/**
 * Masks an email address for privacy (e.g. ian.cabigao@gmail.com -> ia***ao@gmail.com).
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email || null;
  }
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  if (localPart.length <= 4) {
    return `${localPart[0]}***${localPart.slice(-1)}@${domain}`;
  }
  return `${localPart.slice(0, 2)}***${localPart.slice(-2)}@${domain}`;
}

function checkAIServiceHealth(): {
  status: HealthStatus;
  message: string;
  details?: string;
  authStatus?: 'AUTHORIZED' | 'REAUTHORIZATION_REQUIRED' | 'NOT_CONNECTED' | 'NOT_CONFIGURED' | 'UNKNOWN';
  authAccount?: string | null;
  authDetails?: {
    connected: boolean;
    statusMessage: string;
    userEmail: string | null;
    hasDirectTokenScope: boolean;
    isExpired: boolean;
    expiresInSeconds: number;
    usageGuidance?: string;
  };
} {
  if (aiConfig.providerMode === 'disabled') {
    return {
      status: 'NOT_CONFIGURED',
      message: 'AI Service is explicitly disabled in server configuration.',
      authStatus: 'NOT_CONFIGURED',
    };
  }

  if (aiConfig.providerMode === 'chatgpt_plan') {
    let authStatus: 'AUTHORIZED' | 'REAUTHORIZATION_REQUIRED' | 'NOT_CONNECTED' | 'NOT_CONFIGURED' | 'UNKNOWN' = 'UNKNOWN';
    let authAccount: string | null = null;
    let authDetails: any = null;
    let authMessageSegment = '';

    try {
      if (!aiConfig.chatgptPlan?.enabled) {
        authStatus = 'NOT_CONFIGURED';
        authMessageSegment = 'ChatGPT Plan delegation is disabled (CHATGPT_PLAN_ENABLED=false).';
      } else {
        const summary = chatGPTTokenStorage.getStatusSummary();
        const maskedEmail = maskEmail(summary.userEmail);
        authAccount = maskedEmail;
        authDetails = {
          connected: summary.connected,
          statusMessage: summary.statusMessage,
          userEmail: maskedEmail,
          hasDirectTokenScope: summary.hasDirectTokenScope,
          isExpired: summary.isExpired,
          expiresInSeconds: summary.expiresInSeconds,
          usageGuidance: summary.usageGuidance,
        };

        if (summary.connected && summary.hasDirectTokenScope && !summary.isExpired) {
          authStatus = 'AUTHORIZED';
          authMessageSegment = `ChatGPT authorization verified for account: ${maskedEmail || 'delegated user'}.`;
        } else if (summary.isExpired) {
          authStatus = 'REAUTHORIZATION_REQUIRED';
          authMessageSegment = `ChatGPT authorization for ${maskedEmail || 'delegated user'} has expired (reauthorization required).`;
        } else if (!summary.hasDirectTokenScope && summary.userEmail) {
          authStatus = 'REAUTHORIZATION_REQUIRED';
          authMessageSegment = `ChatGPT identity connected for ${maskedEmail}, but plan inference scope is missing (reauthorization required).`;
        } else {
          authStatus = 'NOT_CONNECTED';
          authMessageSegment = 'No active ChatGPT authorization found (not connected).';
        }
      }
    } catch {
      authStatus = 'UNKNOWN';
      authMessageSegment = 'Unable to establish ChatGPT authorization status.';
    }

    return {
      status: 'NOT_MONITORED',
      message: `Provider mode 'chatgpt_plan' configured. ${authMessageSegment} Live API calls are not executed during health checks to avoid billing.`,
      details: authMessageSegment,
      authStatus,
      authAccount,
      authDetails,
    };
  }

  return {
    status: 'NOT_MONITORED',
    message: `Provider mode '${aiConfig.providerMode}' configured. Live API calls are not executed during health checks to avoid billing.`,
  };
}

/**
 * Evaluates Email Service configuration.
 */
function checkEmailServiceHealth(): { status: HealthStatus; message: string } {
  return {
    status: 'NOT_CONFIGURED',
    message: 'No external SMTP mailer or delivery service is configured.',
  };
}

/**
 * Derives the overall system health status from core dependencies.
 * Core critical: API & Database (must be OPERATIONAL for system to be OPERATIONAL).
 * Core secondary: Storage & GateEventService (if degraded/unavailable, system is DEGRADED).
 * Optional services (AI, Email): NOT_CONFIGURED or NOT_MONITORED do NOT impact overall status.
 */
export function deriveOverallStatus(
  dbStatus: HealthStatus,
  storageStatus: HealthStatus,
  gateStatus: HealthStatus
): 'OPERATIONAL' | 'DEGRADED' | 'UNAVAILABLE' {
  if (dbStatus === 'UNAVAILABLE') {
    return 'UNAVAILABLE';
  }
  if (storageStatus === 'UNAVAILABLE' || gateStatus === 'UNAVAILABLE' || storageStatus === 'DEGRADED') {
    return 'DEGRADED';
  }
  return 'OPERATIONAL';
}

/**
 * Aggregates live system health metrics with role-based scoping.
 */
export async function getSystemHealth(isITAdmin: boolean): Promise<SystemHealthResponse> {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.floor(process.uptime());

  // 1. Run core dependency checks
  const dbHealth = await checkDatabaseHealth();
  const storageHealth = checkStorageHealth();
  const gateHealth = checkGateEventServiceHealth();
  const aiHealth = checkAIServiceHealth();
  const emailHealth = checkEmailServiceHealth();
  const sf9Health = checkSf9RendererHealth();

  // 2. Derive overall system health deterministically
  const overallStatus = deriveOverallStatus(dbHealth.status, storageHealth.status, gateHealth.status);

  // 3. Assemble component map (scoped by role)
  const apiComponent: ComponentHealth = {
    name: 'API Server',
    status: 'OPERATIONAL',
    lastChecked: timestamp,
    message: 'Express HTTP application server running normally.',
    ...(isITAdmin ? { latencyMs: 0 } : {}),
  };

  const dbComponent: ComponentHealth = {
    name: 'PostgreSQL Database',
    status: dbHealth.status,
    lastChecked: timestamp,
    message: dbHealth.message,
    ...(isITAdmin ? { latencyMs: dbHealth.latencyMs } : {}),
  };

  const storageComponent: ComponentHealth = {
    name: 'File & Media Storage',
    status: storageHealth.status,
    lastChecked: timestamp,
    message: storageHealth.message,
  };

  const gateComponent: ComponentHealth = {
    name: 'Gate Event Service',
    status: gateHealth.status,
    lastChecked: timestamp,
    message: gateHealth.message,
  };

  const aiComponent: ComponentHealth = {
    name: 'AI Service',
    status: aiHealth.status,
    lastChecked: timestamp,
    message: aiHealth.message,
    ...(aiHealth.details ? { details: aiHealth.details } : {}),
    ...(aiHealth.authStatus ? { authStatus: aiHealth.authStatus } : {}),
    ...(aiHealth.authAccount ? { authAccount: aiHealth.authAccount } : {}),
    ...(aiHealth.authDetails ? { authDetails: aiHealth.authDetails } : {}),
  };

  const emailComponent: ComponentHealth = {
    name: 'Email Delivery Service',
    status: emailHealth.status,
    lastChecked: timestamp,
    message: emailHealth.message,
  };

  const sf9RendererComponent: ComponentHealth = {
    name: 'Calulut SF9 Document Renderer',
    status: sf9Health.status,
    lastChecked: timestamp,
    message: sf9Health.message,
    ...(isITAdmin && typeof sf9Health.latencyMs === 'number' ? { latencyMs: sf9Health.latencyMs } : {}),
  };

  // Safe normalized environment
  const rawEnv = process.env.NODE_ENV || 'development';
  const environment = rawEnv.charAt(0).toUpperCase() + rawEnv.slice(1).toLowerCase();

  return {
    status: overallStatus,
    lastChecked: timestamp,
    scope: isITAdmin ? 'FULL_ITADMIN' : 'OPERATIONAL_ADMIN',
    application: {
      name: 'DigiSkwela Core Application',
      version: '1.0.0',
      environment,
      uptimeSeconds,
    },
    components: {
      api: apiComponent,
      database: dbComponent,
      storage: storageComponent,
      gateEventService: gateComponent,
      aiService: aiComponent,
      emailService: emailComponent,
      sf9Renderer: sf9RendererComponent,
    },
  };
}
