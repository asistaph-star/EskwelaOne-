import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const guidance = await prisma.user.findFirst({
    where: { email: 'guidance@demo.com' },
    include: { teacher: true, staff: true }
  });
  console.log(JSON.stringify(guidance, null, 2));
}
check().catch(console.error).finally(() => prisma.$disconnect());
