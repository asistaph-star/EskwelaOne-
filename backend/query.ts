import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const notifs = await prisma.notification.findMany();
  console.log("Total notifications:", notifs.length);
  console.log(notifs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
