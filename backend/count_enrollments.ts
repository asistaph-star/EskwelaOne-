import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.enrollment.count();
  console.log(`Total Enrollments: ${count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
