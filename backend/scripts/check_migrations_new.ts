import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const migrations = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5`;
  console.log("Migrations applied:");
  console.log(migrations);
  await prisma.$disconnect();
}
main().catch(console.error);
