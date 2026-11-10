import { generatePersistedStudentCalulutSf9FromDb } from '../src/academic/grading/calulutSf2Sf9Persistence.service.js';
import prisma from '../src/config/database.js';

import fs from 'fs';

async function main() {
  const outLines: string[] = [];
  const log = (str: string) => {
    outLines.push(str);
    console.log(str);
  };

  async function test(lrn: string, name: string) {
    const student = await (prisma as any).student.findFirst({
      where: { lrn },
      include: { enrollments: { where: { status: 'Enrolled' } } },
    });
    if (!student || !student.enrollments[0]) {
      log(`>>> ${name} (LRN ${lrn}): Student/Enrollment not found`);
      return;
    }
    const en = student.enrollments[0];
    const res = await generatePersistedStudentCalulutSf9FromDb(prisma as any, {
      studentId: student.id,
      enrollmentId: en.id,
      academicYearId: en.academic_year_id,
      targetTerm: 'T1',
      renderPdf: false,
      mode: 'OFFICIAL',
    });
    log(`>>> ${name} (LRN ${lrn}): Ready=${res.readyForOfficialSf9}, Blockers=${res.blockingReasons?.length || 0}`);
    res.blockingReasons?.forEach((r: string) => log(`    - ${r}`));
  }

  await test('999026000008', 'Hannah Torres');
  await test('999026000031', 'Mateo Aquino');
  await test('999026000032', 'Bea Dizon');
  await test('999026000033', 'Carlos Garcia');

  fs.writeFileSync('c:/Users/Admin/Documents/Capstone Project/DigiSkwela/backend/scripts/summary_result.txt', outLines.join('\n'));
}

main().finally(() => prisma.$disconnect());
