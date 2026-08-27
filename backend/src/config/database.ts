import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;

/**
 * Run a callback inside a Prisma interactive transaction.
 * All operations within the callback share the same database transaction.
 * If any operation fails, the entire transaction is rolled back.
 */
export async function withTransaction<T>(
  fn: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: 'Serializable',
  });
}
