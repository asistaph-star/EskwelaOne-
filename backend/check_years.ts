import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const currentYears = await prisma.academicYear.findMany({
    where: { is_current: true }
  });
  console.log(`Found ${currentYears.length} current academic years.`);
  console.log(JSON.stringify(currentYears, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
