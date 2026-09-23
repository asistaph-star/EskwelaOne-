import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  await prisma.user.updateMany({
    data: { must_change_password: false }
  });
  console.log('Set must_change_password to false for all existing demo users.');
}

run().catch(console.error).finally(() => prisma.$disconnect());
