import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.clinicReferral.deleteMany({});
  console.log(`Cleared ${result.count} records!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
