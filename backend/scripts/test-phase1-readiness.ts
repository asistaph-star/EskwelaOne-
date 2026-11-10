import { generatePersistedStudentCalulutSf9FromDb } from '../src/academic/grading/calulutSf2Sf9Persistence.service.js';
import prisma from '../src/config/database.js';

async function testStudent(label: string, lrn: string) {
  console.log(`\n============================================================`);
  console.log(`Testing: ${label} (LRN: ${lrn})`);
  console.log(`============================================================`);

  const student = await (prisma as any).student.findFirst({
    where: { lrn },
    include: {
      enrollments: {
        where: { status: 'Enrolled' },
        include: { section: true, academic_year: true },
      },
    },
  });

  if (!student) {
    console.error(`Student with LRN ${lrn} not found!`);
    return;
  }

  const enrollment = student.enrollments[0];
  if (!enrollment) {
    console.error(`No active enrollment found for student ${lrn}!`);
    return;
  }

  console.log(`Student ID:      ${student.id}`);
  console.log(`Section:         ${enrollment.section.name} (Grade ${enrollment.section.grade_level})`);
  console.log(`Academic Year:   ${enrollment.academic_year.name}`);

  const evalResult = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
    studentId: student.id,
    enrollmentId: enrollment.id,
    academicYearId: enrollment.academic_year_id,
    targetTerm: 'T1',
    renderPdf: false,
    mode: 'OFFICIAL',
  });

  console.log(`Ready for SF9:   ${evalResult.readyForOfficialSf9}`);
  console.log(`Blocking Reasons (${evalResult.blockingReasons?.length || 0}):`);
  evalResult.blockingReasons?.forEach((r: string) => console.log(`  - ${r}`));

  return { student, enrollment, evalResult };
}

async function main() {
  await testStudent('Hannah Torres (Hollow Gradebooks)', '999026000008');
  await testStudent('Mateo Aquino (Released & Complete)', '999026000031');
  await testStudent('Bea Dizon (Missing SF2 & Comment)', '999026000032');
  await testStudent('Carlos Garcia (Missing SF2 & Comment)', '999026000033');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
