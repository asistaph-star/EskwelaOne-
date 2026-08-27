/**
 * UUIDv7 Generator
 * 
 * UUIDv7 encodes a Unix timestamp in the most-significant 48 bits,
 * providing time-ordered, index-friendly primary keys.
 * 
 * This is an IDENTIFIER strategy, NOT an authorization mechanism.
 * Authorization must be enforced by the API layer.
 */
import { v7 as uuidv7 } from 'uuid';

export function generateId(): string {
  return uuidv7();
}
