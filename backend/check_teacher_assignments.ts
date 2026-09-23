import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const currentYear = await prisma.academicYear.findFirst({ where: { is_current: true } });
  const teacher = await prisma.teacher.findFirst({ where: { user: { email: 'teacher@digiskwela.edu' } } });
  
  const assignments = await prisma.teacherSubjectAssignment.findMany({
    where: { academic_year_id: currentYear?.id, teacher_id: teacher?.id },
    include: { subject: true, section: { include: { _count: { select: { enrollments: { where: { status: 'Enrolled' } } } } } } }
  });

  const mapped = assignments.map((a, i) => {
    const hues = [220, 160, 345, 45, 280];
    const hue = hues[i % hues.length];
    return {
      id: a.id,
      grade: a.section.grade_level,
      section: a.section.name,
      subject: a.subject.name,
      students: a.section._count.enrollments,
      completion: 0,
      semester: currentYear?.name,
      adviser: false,
      imgHue: `hsl(${hue},60%,34%)`
    };
  });

  console.log(JSON.stringify(mapped, null, 2));
}
main().finally(() => prisma.$disconnect());
