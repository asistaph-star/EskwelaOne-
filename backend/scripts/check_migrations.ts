import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const migrations = await prisma.$queryRaw`SELECT * FROM _prisma_migrations ORDER BY started_at ASC`;
    console.log(JSON.stringify(migrations, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
