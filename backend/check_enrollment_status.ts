import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkEnrollment() {
  const enrollments = await prisma.enrollment.findMany({
    include: {
      student: { include: { user: true } },
      academic_year: true
    }
  });

  enrollments.forEach(e => {
    console.log(`Student: ${e.student.user.first_name} ${e.student.user.last_name}`);
    console.log(`Academic Year ID: ${e.academic_year_id} (Is Current: ${e.academic_year.is_current})`);
    console.log(`Status: "${e.status}"\n`);
  });
}

checkEnrollment().catch(console.error).finally(() => prisma.$disconnect());
