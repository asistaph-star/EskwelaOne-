import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid.js';
import { getPhilippineCalendarDate } from '../src/common/utils/dateTime.js';

// Dedicated isolated client strictly bound to digiskwela_test
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:admin123@localhost:5432/digiskwela_test?schema=public'
    }
  }
});

// Helper simulating the current gate scan logic in attendance.routes.ts
// Accepts an explicit 'now' Date object to simulate test clocks without touching system clock
async function simulateGateScanCurrentImplementation(
  studentId: string,
  now: Date,
  simulatedTimezoneOffsetMinutes: number | null = null
) {
  // Exact current implementation from attendance.routes.ts line 248:
  const offset = simulatedTimezoneOffsetMinutes !== null 
    ? simulatedTimezoneOffsetMinutes 
    : now.getTimezoneOffset();
    
  const todayStr = new Date(now.getTime() - (offset * 60000)).toISOString().split('T')[0];
  const today = new Date(todayStr); // 00:00:00Z for the Date field

  const existing = await testPrisma.gateAttendance.findUnique({
    where: {
      student_id_date: {
        student_id: studentId,
        date: today,
      }
    }
  });

  let action = '';
  const eventType = !existing ? 'TIME_IN' : 'TIME_OUT';

  if (!existing) {
    action = 'Time In';
  } else {
    if (existing.time_out) {
      return {
        success: false,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Student already timed out today.',
        todayStr,
        action: null,
      };
    }

    // Debounce logic (within 1 minute of previous action, don't allow time_out)
    if (existing.updated_at && (now.getTime() - existing.updated_at.getTime()) < 60000) {
      return {
        success: false,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Scan ignored (duplicate scan within 1 minute).',
        todayStr,
        action: null,
      };
    }
    action = 'Time Out';
  }

  // Transaction
  const resultEntry = await testPrisma.$transaction(async (tx) => {
    let entry;
    if (!existing) {
      entry = await tx.gateAttendance.create({
        data: {
          id: generateId(),
          student_id: studentId,
          date: today,
          status: 'Present',
          time_in: now,
          created_at: now,
          updated_at: now,
        }
      });
    } else {
      entry = await tx.gateAttendance.update({
        where: { id: existing.id },
        data: {
          time_out: now,
          updated_at: now,
        }
      });
    }
    return entry;
  });

  return {
    success: true,
    action,
    eventType,
    todayStr,
    entry: resultEntry
  };
}

// Helper simulating scan logic using getPhilippineCalendarDate (Asia/Manila authoritative)
async function simulateGateScanAuthoritativeManila(studentId: string, now: Date) {
  const { dateObj: today, dateStr: todayStr } = getPhilippineCalendarDate(now);

  const existing = await testPrisma.gateAttendance.findUnique({
    where: {
      student_id_date: {
        student_id: studentId,
        date: today,
      }
    }
  });

  let action = '';
  if (!existing) {
    action = 'Time In';
  } else {
    if (existing.time_out) {
      return {
        success: false,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Student already timed out today.',
        todayStr,
        action: null,
      };
    }
    if (existing.updated_at && (now.getTime() - existing.updated_at.getTime()) < 60000) {
      return {
        success: false,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Scan ignored (duplicate scan within 1 minute).',
        todayStr,
        action: null,
      };
    }
    action = 'Time Out';
  }

  const resultEntry = await testPrisma.$transaction(async (tx) => {
    let entry;
    if (!existing) {
      entry = await tx.gateAttendance.create({
        data: {
          id: generateId(),
          student_id: studentId,
          date: today,
          status: 'Present',
          time_in: now,
          created_at: now,
          updated_at: now,
        }
      });
    } else {
      entry = await tx.gateAttendance.update({
        where: { id: existing.id },
        data: {
          time_out: now,
          updated_at: now,
        }
      });
    }
    return entry;
  });

  return {
    success: true,
    action,
    todayStr,
    entry: resultEntry
  };
}

async function main() {
  console.log('================================================================');
  console.log('  STUDENT GATE ATTENDANCE — AUTOMATIC ROLLOVER & ISOLATED AUDIT');
  console.log('================================================================\n');

  // Verify database is digiskwela_test
  const dbResult = await testPrisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  const currentDb = dbResult[0].current_database;
  console.log(`[SAFETY CHECK] Connected Database: ${currentDb}`);
  if (currentDb !== 'digiskwela_test') {
    throw new Error(`CRITICAL ABORT: Audit tests must run strictly against digiskwela_test, not ${currentDb}`);
  }

  // Ensure test student exists
  let testStudent = await testPrisma.student.findFirst({
    where: { lrn: '999026999001' }
  });

  if (!testStudent) {
    // Create isolated synthetic test student
    testStudent = await testPrisma.student.create({
      data: {
        id: generateId(),
        lrn: '999026999001',
        first_name: 'QA_Rollover_Test',
        last_name: 'Student',
        guardian_email: 'qa.rollover@example.com',
        guardian_first_name: 'QA_Guardian',
        guardian_last_name: 'Student',
        grade_level: 7,
      }
    });
    console.log(`Created synthetic test student: ${testStudent.lrn} (${testStudent.id})`);
  } else {
    console.log(`Using existing synthetic test student: ${testStudent.lrn} (${testStudent.id})`);
  }

  const studentId = testStudent.id;

  // Clean up any previous test attendance rows for this synthetic student
  await testPrisma.gateAttendance.deleteMany({
    where: { student_id: studentId }
  });
  console.log('Cleaned up previous attendance records for test student.\n');

  // -----------------------------------------------------------------
  // SCENARIO 1: Entry + Exit on Nov 8, then Entry on Nov 9
  // -----------------------------------------------------------------
  console.log('--- SCENARIO 1: Complete Entry/Exit on Nov 8, then New Entry on Nov 9 ---');
  // Asia/Manila is UTC+8. 
  // 2026-11-08 07:30:00 Manila = 2026-11-07 23:30:00 UTC
  // 2026-11-08 16:30:00 Manila = 2026-11-08 08:30:00 UTC
  // 2026-11-09 07:15:00 Manila = 2026-11-08 23:15:00 UTC

  const s1_scan1_time = new Date('2026-11-07T23:30:00.000Z'); // Nov 8 07:30 Manila
  const s1_scan2_time = new Date('2026-11-08T08:30:00.000Z'); // Nov 8 16:30 Manila
  const s1_scan3_time = new Date('2026-11-08T23:15:00.000Z'); // Nov 9 07:15 Manila

  // Assuming Manila host offset (-480 min)
  const s1_res1 = await simulateGateScanCurrentImplementation(studentId, s1_scan1_time, -480);
  console.log(`1.1 Nov 8 Morning Scan:  success=${s1_res1.success}, action="${s1_res1.action}", date=${s1_res1.todayStr}`);

  const s1_res2 = await simulateGateScanCurrentImplementation(studentId, s1_scan2_time, -480);
  console.log(`1.2 Nov 8 Afternoon Scan: success=${s1_res2.success}, action="${s1_res2.action}", date=${s1_res2.todayStr}`);

  const s1_res3 = await simulateGateScanCurrentImplementation(studentId, s1_scan3_time, -480);
  console.log(`1.3 Nov 9 Morning Scan:  success=${s1_res3.success}, action="${s1_res3.action}", date=${s1_res3.todayStr}`);

  const s1_records = await testPrisma.gateAttendance.findMany({
    where: { student_id: studentId },
    orderBy: { date: 'asc' }
  });
  console.log(`Historical records count: ${s1_records.length}`);
  for (const r of s1_records) {
    console.log(`   Date: ${r.date.toISOString().split('T')[0]}, In: ${r.time_in ? r.time_in.toISOString() : 'null'}, Out: ${r.time_out ? r.time_out.toISOString() : 'null'}`);
  }
  const s1_pass = s1_records.length === 2 && s1_res3.action === 'Time In';
  console.log(`Scenario 1 Result: ${s1_pass ? 'PASS (Automatic Rollover Succeeded)' : 'FAIL'}\n`);

  // Clean up
  await testPrisma.gateAttendance.deleteMany({ where: { student_id: studentId } });

  // -----------------------------------------------------------------
  // SCENARIO 2: Entry but NO exit on Nov 8, then Entry on Nov 9
  // -----------------------------------------------------------------
  console.log('--- SCENARIO 2: Entry but NO exit on Nov 8, then Entry on Nov 9 ---');
  const s2_scan1_time = new Date('2026-11-07T23:30:00.000Z'); // Nov 8 07:30 Manila
  const s2_scan2_time = new Date('2026-11-08T23:15:00.000Z'); // Nov 9 07:15 Manila

  const s2_res1 = await simulateGateScanCurrentImplementation(studentId, s2_scan1_time, -480);
  console.log(`2.1 Nov 8 Morning Scan:  success=${s2_res1.success}, action="${s2_res1.action}", date=${s2_res1.todayStr}`);

  const s2_res2 = await simulateGateScanCurrentImplementation(studentId, s2_scan2_time, -480);
  console.log(`2.2 Nov 9 Morning Scan:  success=${s2_res2.success}, action="${s2_res2.action}", date=${s2_res2.todayStr}`);

  const s2_records = await testPrisma.gateAttendance.findMany({
    where: { student_id: studentId },
    orderBy: { date: 'asc' }
  });
  console.log(`Historical records count: ${s2_records.length}`);
  for (const r of s2_records) {
    console.log(`   Date: ${r.date.toISOString().split('T')[0]}, In: ${r.time_in ? r.time_in.toISOString() : 'null'}, Out: ${r.time_out ? r.time_out.toISOString() : 'null'}`);
  }
  const s2_pass = s2_records.length === 2 && s2_records[0].time_out === null && s2_records[1].time_in !== null && s2_res2.action === 'Time In';
  console.log(`Scenario 2 Result: ${s2_pass ? 'PASS (Missing exit does NOT block next day rollover; Nov 8 preserved)' : 'FAIL'}\n`);

  // Clean up
  await testPrisma.gateAttendance.deleteMany({ where: { student_id: studentId } });

  // -----------------------------------------------------------------
  // SCENARIO 3: Exit at 11:59 PM, then Entry after midnight (00:05 AM)
  // -----------------------------------------------------------------
  console.log('--- SCENARIO 3: Exit at 11:59 PM Nov 8, Entry at 00:05 AM Nov 9 ---');
  const s3_scan1_time = new Date('2026-11-07T23:30:00.000Z'); // Nov 8 07:30 Manila
  const s3_scan2_time = new Date('2026-11-08T15:59:00.000Z'); // Nov 8 23:59 Manila
  const s3_scan3_time = new Date('2026-11-08T16:05:00.000Z'); // Nov 9 00:05 Manila (6 minutes later)

  await simulateGateScanCurrentImplementation(studentId, s3_scan1_time, -480);
  const s3_res2 = await simulateGateScanCurrentImplementation(studentId, s3_scan2_time, -480);
  console.log(`3.1 Nov 8 11:59 PM Exit:  success=${s3_res2.success}, action="${s3_res2.action}", date=${s3_res2.todayStr}`);

  const s3_res3 = await simulateGateScanCurrentImplementation(studentId, s3_scan3_time, -480);
  console.log(`3.2 Nov 9 00:05 AM Entry: success=${s3_res3.success}, action="${s3_res3.action}", date=${s3_res3.todayStr}`);

  const s3_records = await testPrisma.gateAttendance.findMany({
    where: { student_id: studentId },
    orderBy: { date: 'asc' }
  });
  console.log(`Historical records count: ${s3_records.length}`);
  const s3_pass = s3_records.length === 2 && s3_res3.action === 'Time In' && s3_res3.todayStr === '2026-11-09';
  console.log(`Scenario 3 Result: ${s3_pass ? 'PASS (Midnight boundary rolls over cleanly)' : 'FAIL'}\n`);

  // Clean up
  await testPrisma.gateAttendance.deleteMany({ where: { student_id: studentId } });

  // -----------------------------------------------------------------
  // SCENARIO 4: Date boundary timezone sensitivity (Asia/Manila vs UTC Server)
  // -----------------------------------------------------------------
  console.log('--- SCENARIO 4: Timezone Handling — Asia/Manila vs Host OS UTC Offset ---');
  // At 7:00 AM Manila on Nov 9, UTC time is 2026-11-08 23:00:00Z.
  const morning_manila_time = new Date('2026-11-08T23:00:00.000Z');

  // If server is UTC (offset = 0):
  const utc_offset_res = await simulateGateScanCurrentImplementation(studentId, morning_manila_time, 0);
  console.log(`4.1 Current code on UTC Server (offset=0):       Calculated Date = "${utc_offset_res.todayStr}"`);

  // If server is Manila (offset = -480):
  await testPrisma.gateAttendance.deleteMany({ where: { student_id: studentId } });
  const manila_offset_res = await simulateGateScanCurrentImplementation(studentId, morning_manila_time, -480);
  console.log(`4.2 Current code on Manila Server (offset=-480): Calculated Date = "${manila_offset_res.todayStr}"`);

  // Using getPhilippineCalendarDate():
  const ph_date = getPhilippineCalendarDate(morning_manila_time);
  console.log(`4.3 Using getPhilippineCalendarDate():           Calculated Date = "${ph_date.dateStr}"`);

  const s4_issue_detected = utc_offset_res.todayStr === '2026-11-08' && ph_date.dateStr === '2026-11-09';
  console.log(`Timezone Defect Proof: In UTC host environment, 7 AM Manila resolves to "${utc_offset_res.todayStr}" (YESTERDAY) instead of "${ph_date.dateStr}" (TODAY).`);
  console.log(`Scenario 4 Evaluation: Current code FAILS on non-Manila server timezones (depends on host OS offset).\n`);

  // Clean up
  await testPrisma.gateAttendance.deleteMany({ where: { student_id: studentId } });

  // -----------------------------------------------------------------
  // SCENARIO 5 & 6: Same-Day Single Cycle, 3rd Scan, Duplicate Scan
  // -----------------------------------------------------------------
  console.log('--- SCENARIO 5: Same-Day Scan Lifecycle & Duplicate Protection ---');
  const t0 = new Date('2026-11-08T00:00:00.000Z'); // 8:00 AM Manila
  const t_dup = new Date(t0.getTime() + 15000);     // 15 seconds later (duplicate tap)
  const t_out = new Date(t0.getTime() + 120000);    // 2 minutes later (valid exit)
  const t_3rd = new Date(t0.getTime() + 300000);    // 5 minutes later (3rd scan / re-entry attempt)

  // 1st scan: Time In
  const scan1 = await simulateGateScanCurrentImplementation(studentId, t0, -480);
  console.log(`5.1 First Scan:       success=${scan1.success}, action="${scan1.action}"`);

  // Accidental double tap within 15 seconds
  const scan_dup = await simulateGateScanCurrentImplementation(studentId, t_dup, -480);
  console.log(`5.2 Duplicate (15s):  success=${scan_dup.success}, error="${scan_dup.message}"`);

  // 2nd scan: Time Out (after 2 mins)
  const scan2 = await simulateGateScanCurrentImplementation(studentId, t_out, -480);
  console.log(`5.3 Second Scan (2m): success=${scan2.success}, action="${scan2.action}"`);

  // 3rd scan: Re-entry attempt (after Time Out)
  const scan3 = await simulateGateScanCurrentImplementation(studentId, t_3rd, -480);
  console.log(`5.4 Third Scan (5m):  success=${scan3.success}, error="${scan3.message}"`);

  console.log('\n--- AUDIT TEST EXECUTION COMPLETE ---');
}

main()
  .catch(e => {
    console.error('AUDIT RUNNER ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await testPrisma.$disconnect();
  });
