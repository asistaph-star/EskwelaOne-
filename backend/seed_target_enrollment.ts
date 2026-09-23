import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const activeYear = await prisma.academicYear.findFirst({
    where: { is_current: true }
  });
  if (activeYear) {
    await prisma.academicYear.update({
      where: { id: activeYear.id },
      data: { target_enrollment: 1500 }
    });
    console.log('Set target_enrollment to 1500 for active AcademicYear');
  } else {
    console.log('No active academic year found.');
  }
}
run().catch(e => console.error(e)).finally(() => prisma.$disconnect());
