import { Request, Response, NextFunction } from 'express';
import { generateId } from '../utils/uuid.js';

/**
 * Attach a unique correlation ID to every request for audit trail linking.
 * Available as req.correlationId throughout the request lifecycle.
 */
export function correlationIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  (req as any).correlationId = req.headers['x-correlation-id'] as string || generateId();
  next();
}
