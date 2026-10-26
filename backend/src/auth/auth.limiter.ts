import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/middleware/errorHandler.js';
import { createAuditLog } from '../audit/audit.service.js';

// In-memory sliding window maps
// Composite key: `${clientIp}::${canonicalSchoolId}` -> array of failed attempt epoch timestamps
const failedAttemptsMap = new Map<string, number[]>();

// IP-level key: `${clientIp}` -> array of failed attempt epoch timestamps (anti-spraying)
const ipFailedAttemptsMap = new Map<string, number[]>();

// Default configuration: 5 failed attempts per 15 minutes per (IP + School ID)
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_IP_ATTEMPTS = 50; // Global threshold per IP to prevent dictionary spraying

let customMaxAttempts: number | undefined;
let customWindowMs: number | undefined;
let customMaxIpAttempts: number | undefined;

export interface AuthRateLimitOptions {
  maxAttempts?: number;
  windowMs?: number;
  maxIpAttempts?: number;
}

/**
 * Configure rate limiter thresholds (useful for deterministic tests).
 */
export function setAuthRateLimits(options?: AuthRateLimitOptions): void {
  customMaxAttempts = options?.maxAttempts;
  customWindowMs = options?.windowMs;
  customMaxIpAttempts = options?.maxIpAttempts;
}

/**
 * Reset all in-memory rate limit tracking (useful for test lifecycle cleanup).
 */
export function resetAuthRateLimiter(): void {
  failedAttemptsMap.clear();
  ipFailedAttemptsMap.clear();
  customMaxAttempts = undefined;
  customWindowMs = undefined;
  customMaxIpAttempts = undefined;
}

/**
 * Resolves the client IP address safely.
 * Does not blindly trust X-Forwarded-For when trust proxy is not explicitly enabled.
 */
export function getClientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Canonical School ID normalization.
 * Matches PostgreSQL case-insensitive collation and trims surrounding whitespace.
 */
export function getCanonicalSchoolId(req: Request): string {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return '__unspecified__';
  }
  const rawId = body.schoolId;
  if (!rawId || typeof rawId !== 'string') {
    return '__unspecified__';
  }
  return rawId.trim().toUpperCase();
}

/**
 * Generates the composite rate-limit key: `${clientIp}::${canonicalSchoolId}`.
 */
export function getAuthRateLimitKey(req: Request): string {
  const ip = getClientIp(req);
  const schoolId = getCanonicalSchoolId(req);
  return `${ip}::${schoolId}`;
}

/**
 * Rate limiter middleware for POST /api/auth/login.
 * 
 * Enforces bounded rate-limiting on failed attempts:
 * 1. Targeted brute-force protection: max 5 failed attempts per (IP, canonical School ID) in 15 min.
 * 2. Spraying protection: max 50 failed attempts per IP across all accounts in 15 min.
 * 
 * Throws HTTP 429 Too Many Requests if the threshold is exceeded.
 */
export function authRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const windowMs = customWindowMs ?? DEFAULT_WINDOW_MS;
  const maxAttempts = customMaxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const maxIpAttempts = customMaxIpAttempts ?? DEFAULT_MAX_IP_ATTEMPTS;

  const windowStart = now - windowMs;
  const ip = getClientIp(req);
  const schoolId = getCanonicalSchoolId(req);
  const compositeKey = getAuthRateLimitKey(req);

  // 1. Check composite key limit (targeted brute force against this specific School ID)
  let timestamps = failedAttemptsMap.get(compositeKey) || [];
  timestamps = timestamps.filter(t => t > windowStart);
  failedAttemptsMap.set(compositeKey, timestamps);

  if (timestamps.length >= maxAttempts) {
    const oldestInWindow = timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));

    // Audit rate-limit violation
    createAuditLog({
      action: 'AUTH_RATE_LIMIT_TRIGGERED',
      category: 'SECURITY',
      resourceType: 'auth',
      targetLabel: schoolId !== '__unspecified__' ? schoolId : `IP:${ip}`,
      result: 'DENIED',
      reason: `Targeted threshold exceeded (${maxAttempts} attempts in 15m)`,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      correlationId: (req as any).correlationId,
    }).catch(() => {});

    throw new AppError(
      429,
      'TOO_MANY_REQUESTS',
      'Too many login attempts. Please try again later.'
    );
  }

  // 2. Check IP-level spraying limit (prevent dictionary attacks across many IDs from one IP)
  let ipTimestamps = ipFailedAttemptsMap.get(ip) || [];
  ipTimestamps = ipTimestamps.filter(t => t > windowStart);
  ipFailedAttemptsMap.set(ip, ipTimestamps);

  if (ipTimestamps.length >= maxIpAttempts) {
    const oldestInWindow = ipTimestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));

    // Audit rate-limit violation
    createAuditLog({
      action: 'AUTH_RATE_LIMIT_TRIGGERED',
      category: 'SECURITY',
      resourceType: 'auth',
      targetLabel: `IP:${ip}`,
      result: 'DENIED',
      reason: `IP-level spraying threshold exceeded (${maxIpAttempts} attempts in 15m)`,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      correlationId: (req as any).correlationId,
    }).catch(() => {});

    throw new AppError(
      429,
      'TOO_MANY_REQUESTS',
      'Too many login attempts. Please try again later.'
    );
  }

  next();
}

/**
 * Record a failed authentication attempt.
 * Invoked on authentication failure (401 invalid credentials, deactivated account, etc.).
 */
export function recordAuthFailure(req: Request): void {
  const now = Date.now();
  const windowMs = customWindowMs ?? DEFAULT_WINDOW_MS;
  const windowStart = now - windowMs;

  const ip = getClientIp(req);
  const compositeKey = getAuthRateLimitKey(req);

  // Record for composite key
  let timestamps = failedAttemptsMap.get(compositeKey) || [];
  timestamps = timestamps.filter(t => t > windowStart);
  timestamps.push(now);
  failedAttemptsMap.set(compositeKey, timestamps);

  // Record for IP key
  let ipTimestamps = ipFailedAttemptsMap.get(ip) || [];
  ipTimestamps = ipTimestamps.filter(t => t > windowStart);
  ipTimestamps.push(now);
  ipFailedAttemptsMap.set(ip, ipTimestamps);
}

/**
 * Record a successful authentication attempt.
 * Clears failed attempts for the composite key (skipSuccessfulRequests equivalent).
 */
export function recordAuthSuccess(req: Request): void {
  const compositeKey = getAuthRateLimitKey(req);
  failedAttemptsMap.delete(compositeKey);
}
