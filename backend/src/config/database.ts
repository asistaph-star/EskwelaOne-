import './env.js';
import { PrismaClient } from '@prisma/client';
import { fieldEncryptionExtension } from 'prisma-field-encryption';

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const prisma = basePrisma.$extends(
  fieldEncryptionExtension()
);

export default prisma;

/**
 * Run a callback inside a Prisma interactive transaction.
 * All operations within the callback share the same database transaction.
 * If any operation fails, the entire transaction is rolled back.
 */
export async function withTransaction<T>(
  fn: (tx: any) => Promise<T>,
  options?: {
    isolationLevel?: 'ReadCommitted' | 'Serializable' | 'RepeatableRead';
    maxWait?: number;
    timeout?: number;
  }
): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: options?.maxWait ?? 5000,
    timeout: options?.timeout ?? 10000,
    isolationLevel: options?.isolationLevel ?? 'Serializable',
  });
}
