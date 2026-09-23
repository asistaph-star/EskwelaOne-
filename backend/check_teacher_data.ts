import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const teacher = await prisma.teacher.findUnique({
    where: { user_id: 'demo-teacher-1' },
    include: {
      assignments: {
        include: { section: true, subject: true }
      }
    }
  });
  console.dir(teacher, { depth: null });
}
check().finally(() => prisma.$disconnect());
