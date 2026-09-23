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
  fn: (tx: any) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: 'Serializable',
  });
}
