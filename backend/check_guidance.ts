import prisma from './src/config/database.js';

async function main() {
  const count = await prisma.guidanceRecord.count();
  console.log(`GuidanceRecord count: ${count}`);
}

main().finally(() => prisma.$disconnect());
