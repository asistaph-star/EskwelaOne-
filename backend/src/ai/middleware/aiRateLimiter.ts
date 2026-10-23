import { Request, Response, NextFunction } from 'express';
import { aiConfig } from '../../config/ai.config.js';
import { AppError } from '../../common/middleware/errorHandler.js';
import { AuthenticatedUser } from '../../common/middleware/auth.js';

// In-memory sliding window per user: userId -> timestamps (epoch ms)
const userRequestTimestamps = new Map<string, number[]>();

/**
 * Per-User AI Rate Limiter Middleware
 * 
 * Enforces dual-window rate limiting on POST /api/ai/chat:
 * 1. AI_RATE_LIMIT_PER_MINUTE (default 10 requests / 60 seconds)
 * 2. AI_RATE_LIMIT_PER_DAY (default 100 requests / 24 hours)
 * 
 * Returns clear HTTP 429 with actionable, user-friendly error messages.
 */
export function aiRateLimiter(req: Request, _res: Response, next: NextFunction): void {
  const authUser = (req as any).user as AuthenticatedUser;
  if (!authUser || !authUser.id) {
    return next();
  }

  const userId = authUser.id;
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  let timestamps = userRequestTimestamps.get(userId) || [];
  // Prune expired timestamps older than 24h
  timestamps = timestamps.filter(t => t > oneDayAgo);
  userRequestTimestamps.set(userId, timestamps);

  const limitPerMinute = aiConfig.limits.rateLimitPerMinute;
  const limitPerDay = aiConfig.limits.rateLimitPerDay;

  // 1. Enforce per-minute limit
  const minuteCount = timestamps.filter(t => t > oneMinuteAgo).length;
  if (minuteCount >= limitPerMinute) {
    throw new AppError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'You have exceeded the maximum number of AI requests per minute. Please wait a moment and try again.'
    );
  }

  // 2. Enforce per-day limit
  if (timestamps.length >= limitPerDay) {
    throw new AppError(
      429,
      'DAILY_LIMIT_EXCEEDED',
      'You have reached the maximum daily limit for AI requests. Please try again tomorrow.'
    );
  }

  // Record this request
  timestamps.push(now);
  next();
}

/**
 * Resets the rate limiter records.
 * Useful for automated test fixtures and isolated evaluations.
 */
export function resetAIRateLimits(userId?: string): void {
  if (userId) {
    userRequestTimestamps.delete(userId);
  } else {
    userRequestTimestamps.clear();
  }
}
