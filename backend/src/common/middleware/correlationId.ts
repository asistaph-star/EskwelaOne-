import { Request, Response, NextFunction } from 'express';
import { generateId } from '../utils/uuid.js';

/**
 * Attach a unique server-generated correlation ID to every request for audit trail linking.
 * Available as req.correlationId throughout the request lifecycle.
 * Inbound client-supplied X-Correlation-ID headers are not trusted.
 * The server-generated ID is attached to the response header for client/troubleshooting tracing.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = generateId();
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}
