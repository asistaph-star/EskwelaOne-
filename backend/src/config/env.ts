import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = __dirname.includes('dist') 
  ? path.resolve(__dirname, '../../..')
  : path.resolve(__dirname, '../..');

// Load default .env configuration
dotenv.config({ path: path.resolve(baseDir, '.env') });

// If executing under test environment, explicitly load and override with .env.test
if ((process.env.NODE_ENV || '').trim() === 'test') {
  const testEnvPath = path.resolve(baseDir, '.env.test');
  if (fs.existsSync(testEnvPath)) {
    dotenv.config({ path: testEnvPath, override: true });
  }
}

export const KNOWN_INSECURE_SECRETS = new Set([
  'change_me_insecure_dev_secret',
  'change_me_to_a_strong_random_secret_min_32_chars',
  'secret',
  'changeme',
  'development-secret',
  'fallback-secret',
  'test',
]);

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates environment variables for production deployments.
 * Rejects missing, empty, or known development fallback/placeholder secrets.
 * Never prints actual secret values in error messages.
 */
export function validateProductionConfig(
  env: Record<string, string | undefined> = process.env
): ConfigValidationResult {
  const errors: string[] = [];

  const rawJwtSecret = env.JWT_SECRET;
  const trimmedSecret = rawJwtSecret?.trim();

  if (!trimmedSecret) {
    errors.push('Missing required production configuration: JWT_SECRET must be set and non-empty.');
  } else if (KNOWN_INSECURE_SECRETS.has(trimmedSecret.toLowerCase())) {
    errors.push('Insecure production configuration: JWT_SECRET must not use a known development fallback or placeholder value.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Asserts production configuration validity.
 * Throws a fatal Error if configuration is missing or insecure.
 * Error messages identify the variable name and reason category without revealing secret values.
 */
export function assertProductionConfig(
  env: Record<string, string | undefined> = process.env
): void {
  const result = validateProductionConfig(env);
  if (!result.valid) {
    throw new Error(
      `[CONFIG_FATAL] Production startup rejected due to unsafe configuration:\n` +
      result.errors.map(err => `  - ${err}`).join('\n')
    );
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const rawSecret = process.env.JWT_SECRET?.trim();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  jwt: {
    // In production, refuse silent fallback to development secret
    secret: nodeEnv === 'production'
      ? (rawSecret || '')
      : (rawSecret || 'CHANGE_ME_INSECURE_DEV_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET || 'digiskwela-documents',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    presignedExpiry: parseInt(process.env.S3_PRESIGNED_EXPIRY_SECONDS || '300', 10),
  },
} as const;

// Fail fast immediately at module load time if running in production mode with unsafe configuration
if (config.nodeEnv === 'production') {
  assertProductionConfig();
}
