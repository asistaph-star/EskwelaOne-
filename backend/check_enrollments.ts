import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`SELECT section_id, COUNT(*) as count FROM enrollments WHERE status = 'Enrolled' GROUP BY section_id;`;
  console.log(JSON.stringify(result, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2
  ));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
