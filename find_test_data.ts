import prisma from './backend/src/config/database.js';

async function main() {
  const assignments = await prisma.teacherSubjectAssignment.findMany({
    include: {
      teacher: { include: { user: true } },
      section: { include: { enrollments: { where: { status: 'Enrolled' }, include: { student: { include: { user: true } } } } } }
    },
    take: 50
  });
  
  const teachersMap = new Map();
  for (const a of assignments) {
    if (a.section.enrollments.length > 0) {
      if (!teachersMap.has(a.teacher.user.email)) {
        teachersMap.set(a.teacher.user.email, []);
      }
      teachersMap.get(a.teacher.user.email).push(a);
    }
  }
  
  console.log(JSON.stringify(Array.from(teachersMap.entries()).map(([email, assigns]) => ({
    email,
    assignments: assigns.map((a: any) => ({
      assignmentId: a.id,
      sectionId: a.section_id,
      studentEnrollmentId: a.section.enrollments[0]?.id
    }))
  })), null, 2));
  
  await prisma.$disconnect();
}
main().catch(console.error);
