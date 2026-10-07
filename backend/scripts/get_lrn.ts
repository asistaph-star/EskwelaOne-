import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      student: true
    }
  });
  
  for (const user of users) {
    if (user.student) {
      console.log(`Student: ${user.first_name} ${user.last_name} | LRN: "${user.student.lrn}"`);
    }
  }
}
main().finally(() => prisma.$disconnect());
