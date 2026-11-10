import prisma from '../src/config/database.js';
import { generatePersistedStudentCalulutSf9FromDb } from '../src/academic/grading/calulutSf2Sf9Persistence.service.js';

async function testReadiness() {
  const studentId = '96aae239-6dc1-4af1-a993-f4c96ea19aa0';
  const enrollmentId = '7dbe62d3-e90a-4399-a7b6-d49f826dcb68';
  const academicYearId = 'fb0b81e7-6bf5-4bc4-973d-47c5e37b62e5';

  console.log('Testing generatePersistedStudentCalulutSf9FromDb in OFFICIAL mode for Juan Dela Cruz:');
  const result = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
    studentId,
    enrollmentId,
    academicYearId,
    targetTerm: 'T1',
    renderPdf: false,
    mode: 'OFFICIAL'
  });

  console.log('readyForOfficialSf9:', result.readyForOfficialSf9);
  console.log('blockingReasons:', result.blockingReasons);
  console.log('attendanceMapping.readyForOfficialSf9:', result.attendanceMapping?.readyForOfficialSf9);
  console.log('attendanceMapping.blockingReasons:', result.attendanceMapping?.blockingReasons);
  console.log('unverifiedMonths:', JSON.stringify(result.attendanceMapping?.unverifiedMonths, null, 2));
  console.log('comments:', result.prerequisiteEvaluation?.comments);
  console.log('calculated generalAverage:', result.calculated?.generalAverage);
  console.log('calculated targetTerm:', result.calculated?.targetTerm);

  await (prisma as any).$disconnect();
}

testReadiness().catch(console.error);
