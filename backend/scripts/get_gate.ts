import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const gates = await prisma.gateAttendance.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    include: { student: { include: { user: true } } }
  });
  console.log(JSON.stringify(gates, null, 2));
}
main().finally(() => prisma.$disconnect());
