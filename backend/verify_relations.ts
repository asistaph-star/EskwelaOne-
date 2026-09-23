import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("--- RELATIONAL DATA PROOF ---");

  // Get the demo teacher's user record
  const teacherUser = await prisma.user.findUnique({ where: { email: 'teacher@demo.com' } });
  
  if (!teacherUser) {
    console.log("Teacher not found");
    return;
  }

  // Get teacher profile and assignments
  const teacher = await prisma.teacher.findUnique({
    where: { user_id: teacherUser.id },
    include: {
      assignments: {
        include: {
          section: true,
          subject: true,
          academic_year: true
        }
      }
    }
  });

  console.log(`TEACHER: ${teacherUser.first_name} ${teacherUser.last_name}`);
  if (teacher?.assignments.length) {
    for (const assignment of teacher.assignments) {
      console.log(`\nASSIGNMENT:`);
      console.log(`- Subject: ${assignment.subject.name} (${assignment.subject.code})`);
      console.log(`- Section: ${assignment.section.name} (Grade ${assignment.section.grade_level})`);
      console.log(`- Academic Year: ${assignment.academic_year.name} (Is Current: ${assignment.academic_year.is_current})`);
      
      // Get enrolled students for this section and academic year
      const enrollments = await prisma.enrollment.findMany({
        where: {
          section_id: assignment.section_id,
          academic_year_id: assignment.academic_year_id
        },
        include: {
          student: {
            include: {
              user: true
            }
          }
        }
      });

      console.log(`\nENROLLED STUDENTS IN THIS SECTION:`);
      if (enrollments.length > 0) {
        enrollments.forEach(e => {
          console.log(`  -> ${e.student.user.first_name} ${e.student.user.last_name} (Email: ${e.student.user.email}, LRN: ${e.student.lrn})`);
        });
      } else {
        console.log(`  -> No students found in this section.`);
      }
    }
  } else {
    console.log("No assignments found for this teacher.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
