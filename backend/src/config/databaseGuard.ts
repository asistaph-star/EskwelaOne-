/**
 * Database Isolation and Safety Guard.
 * Ensures automated tests refuse to run against production or shared development databases,
 * verifies actual PostgreSQL connected database identity via current_database(),
 * and protects database credentials from exposure.
 */

export interface DatabaseSafetyResult {
  safe: boolean;
  reason?: string;
  sanitizedUrl?: string;
}

const PRODUCTION_HOST_PATTERNS = [
  /rds\.amazonaws\.com/i,
  /supabase\.(co|com)/i,
  /cockroachlabs\.cloud/i,
  /calulut\.edu\.ph/i,
  /azure\.com/i,
  /gcp\.cloud/i,
  /elephantsql\.com/i,
];

const PRODUCTION_KEYWORDS = [
  'production',
  'calulut_prod',
  'digiskwela_prod',
  'live_school',
  'prod_db',
];

/**
 * Sanitizes a PostgreSQL connection URL by redacting the password.
 * Format: postgresql://user:*****@host:port/database?schema=...
 */
export function sanitizeDatabaseUrl(urlStr?: string): string {
  if (!urlStr) return '[DATABASE_URL_EMPTY]';
  try {
    const parsed = new URL(urlStr);
    if (parsed.password) {
      parsed.password = '*****';
    }
    return parsed.toString();
  } catch {
    // If URL parsing fails, redact anything between : and @
    return urlStr.replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1*****$3');
  }
}

/**
 * Validates whether the given environment is safe for automated test execution.
 * Automated tests MUST NOT execute against production databases or the shared development database.
 */
export function validateTestDatabaseEnvironment(
  env: Record<string, string | undefined> = process.env
): DatabaseSafetyResult {
  const nodeEnv = (env.NODE_ENV || '').toLowerCase().trim();
  if (nodeEnv === 'production') {
    return {
      safe: false,
      reason: 'NODE_ENV is set to "production". Automated tests are strictly prohibited in production mode.',
    };
  }

  const dbUrl = env.DATABASE_URL?.trim();
  if (!dbUrl) {
    return {
      safe: false,
      reason: 'DATABASE_URL is missing or empty.',
    };
  }

  // Check against known production cloud hostnames
  for (const pattern of PRODUCTION_HOST_PATTERNS) {
    if (pattern.test(dbUrl)) {
      return {
        safe: false,
        reason: `DATABASE_URL matches protected cloud/production host pattern: ${pattern.source}`,
        sanitizedUrl: sanitizeDatabaseUrl(dbUrl),
      };
    }
  }

  // Check for production naming keywords in URL (e.g. database name or host)
  const lowerUrl = dbUrl.toLowerCase();
  for (const keyword of PRODUCTION_KEYWORDS) {
    if (lowerUrl.includes(keyword)) {
      return {
        safe: false,
        reason: `DATABASE_URL contains prohibited production identifier: "${keyword}"`,
        sanitizedUrl: sanitizeDatabaseUrl(dbUrl),
      };
    }
  }

  // Extract database name from URL path
  try {
    const parsed = new URL(dbUrl);
    const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();

    // STRICT ISOLATION RULE: Automated tests must NOT target the development database
    if (dbName === 'digiskwela') {
      return {
        safe: false,
        reason: 'DATABASE_URL targets development database "digiskwela". Automated tests must target the dedicated test database "digiskwela_test".',
        sanitizedUrl: sanitizeDatabaseUrl(dbUrl),
      };
    }
  } catch (err: any) {
    return {
      safe: false,
      reason: `Failed to parse DATABASE_URL: ${err.message}`,
    };
  }

  return {
    safe: true,
    sanitizedUrl: sanitizeDatabaseUrl(dbUrl),
  };
}

/**
 * Asserts test database isolation from environment configuration.
 * Throws an error if the environment is unsafe.
 */
export function assertTestDatabaseIsolation(
  env: Record<string, string | undefined> = process.env
): void {
  const result = validateTestDatabaseEnvironment(env);
  if (!result.safe) {
    throw new Error(`[UNSAFE_DATABASE_TARGET] Refusing to execute tests: ${result.reason}`);
  }
}

/**
 * Queries PostgreSQL directly to verify the connected database identity.
 * Strictly asserts that the active connected database is `digiskwela_test` and NEVER `digiskwela` or production.
 */
export async function verifyDatabaseIdentity(
  prismaClient: any
): Promise<{ database: string; user: string; verified: boolean }> {
  const queryResult: any = await prismaClient.$queryRawUnsafe(
    'SELECT current_database() as db_name, current_user as user_name;'
  );

  const connectedDb = queryResult?.[0]?.db_name || '';
  const connectedUser = queryResult?.[0]?.user_name || '';

  if (!connectedDb) {
    throw new Error('[DATABASE_IDENTITY_VERIFICATION_FAILED] Unable to resolve current_database().');
  }

  if (connectedDb === 'digiskwela') {
    throw new Error(
      `[UNSAFE_DATABASE_TARGET] Fatal database isolation violation: Connected database is development database "digiskwela". Automated tests must strictly connect to "digiskwela_test".`
    );
  }

  if (connectedDb !== 'digiskwela_test') {
    throw new Error(
      `[UNSAFE_DATABASE_TARGET] Connected database "${connectedDb}" is not the approved dedicated test database "digiskwela_test".`
    );
  }

  return {
    database: connectedDb,
    user: connectedUser,
    verified: true,
  };
}
