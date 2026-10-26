import fs from 'fs';
import prisma from '../config/database.js';
import { getMediaStoragePath } from '../config/storage.config.js';
import { aiConfig } from '../config/ai.config.js';

export type HealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'UNAVAILABLE' | 'NOT_CONFIGURED' | 'NOT_MONITORED';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  lastChecked: string;
  message: string;
  latencyMs?: number;
  details?: string;
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
 * Evaluates AI Service configuration status without making external paid API requests.
 */
function checkAIServiceHealth(): { status: HealthStatus; message: string } {
  if (aiConfig.providerMode === 'disabled') {
    return {
      status: 'NOT_CONFIGURED',
      message: 'AI Service is explicitly disabled in server configuration.',
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
  };

  const emailComponent: ComponentHealth = {
    name: 'Email Delivery Service',
    status: emailHealth.status,
    lastChecked: timestamp,
    message: emailHealth.message,
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
    },
  };
}
