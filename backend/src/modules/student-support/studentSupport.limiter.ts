import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../common/middleware/errorHandler.js';
import { AuthenticatedUser } from '../../common/middleware/auth.js';

// In-memory sliding window per user: userId -> timestamps (epoch ms)
const userTimestamps = new Map<string, number[]>();

const DEFAULT_LIMIT_PER_MINUTE = process.env.NODE_ENV === 'test' ? 200 : 60;
const DEFAULT_LIMIT_PER_DAY = process.env.NODE_ENV === 'test' ? 1000 : 500;

let customLimitPerMinute: number | undefined;
let customLimitPerDay: number | undefined;

export function setStudentSupportRateLimits(perMinute?: number, perDay?: number): void {
  customLimitPerMinute = perMinute;
  customLimitPerDay = perDay;
}

/**
 * Rate limiter middleware for student support endpoints.
 */
export function studentSupportRateLimiter(req: Request, _res: Response, next: NextFunction): void {
  const authUser = (req as any).user as AuthenticatedUser | undefined;
  if (!authUser || !authUser.id) {
    return next();
  }

  const userId = authUser.id;
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  let timestamps = userTimestamps.get(userId) || [];
  timestamps = timestamps.filter(t => t > oneDayAgo);
  userTimestamps.set(userId, timestamps);

  const limitPerMinute = customLimitPerMinute ?? DEFAULT_LIMIT_PER_MINUTE;
  const limitPerDay = customLimitPerDay ?? DEFAULT_LIMIT_PER_DAY;

  const minuteCount = timestamps.filter(t => t > oneMinuteAgo).length;
  if (minuteCount >= limitPerMinute) {
    throw new AppError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'You have exceeded the maximum number of student support requests per minute. Please wait a moment and try again.'
    );
  }

  if (timestamps.length >= limitPerDay) {
    throw new AppError(
      429,
      'DAILY_LIMIT_EXCEEDED',
      'You have reached the maximum daily limit for student support requests. Please try again tomorrow.'
    );
  }

  timestamps.push(now);
  next();
}

/**
 * Resets the in-memory rate limit stores.
 */
export function resetStudentSupportRateLimits(userId?: string): void {
  customLimitPerMinute = undefined;
  customLimitPerDay = undefined;
  if (userId) {
    userTimestamps.delete(userId);
  } else {
    userTimestamps.clear();
  }
}
