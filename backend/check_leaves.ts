import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const leaves = await prisma.leaveRequest.findMany({ include: { user: true } });
  console.log(`Found ${leaves.length} leave requests in DB.`);
  if (leaves.length > 0) {
    console.log(leaves);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
