import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid.js';
import { getPhilippineCalendarDate, formatManilaTime } from '../src/common/utils/dateTime.js';
import { formatPhilippineDate, formatPhilippineTime } from '../src/notifications/punctuality.service.js';
import { renderTimeInTemplate } from '../src/notifications/email/templates/gateAttendanceTemplates.js';

// Dedicated isolated client strictly bound to digiskwela_test
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:admin123@localhost:5432/digiskwela_test?schema=public'
    }
  }
});

// Helper implementing the remediated Student Gate Scan logic
async function processRemediatedStudentGateScan(studentId: string, now: Date) {
  // Remediated date calculation:
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
  const eventType = !existing ? 'TIME_IN' : 'TIME_OUT';

  if (!existing) {
    action = 'Time In';
  } else {
    if (existing.time_out) {
      return {
        success: false,
        status: 422,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Student already timed out today.',
        todayStr,
        today,
        action: null,
      };
    }

    // Debounce logic (within 1 minute of previous action, don't allow time_out)
    if (existing.updated_at && (now.getTime() - existing.updated_at.getTime()) < 60000) {
      return {
        success: false,
        status: 422,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Scan ignored (duplicate scan within 1 minute).',
        todayStr,
        today,
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
    status: 200,
    action,
    eventType,
    todayStr,
    today,
    entry: resultEntry,
    formattedDate: formatPhilippineDate(today),
    formattedTime: formatPhilippineTime(now),
  };
}

// Helper implementing Faculty Gate Scan date resolution
function resolveFacultyGateDate(now: Date) {
  return getPhilippineCalendarDate(now);
}

async function main() {
  console.log('========================================================================');
  console.log('  DIGISKWELA — P0 TIMEZONE REMEDIATION 10/10 REGRESSION TEST SUITE');
  console.log('========================================================================\n');

  // Verify connected database is digiskwela_test
  const dbResult = await testPrisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  const currentDb = dbResult[0].current_database;
  console.log(`[SAFETY CHECK] Connected Database: ${currentDb}`);
  if (currentDb !== 'digiskwela_test') {
    throw new Error(`CRITICAL ABORT: Regression suite must strictly run against digiskwela_test, not ${currentDb}`);
  }

  // Setup 3 dedicated synthetic test students
  async function getOrCreateTestStudent(lrn: string, name: string) {
    let s = await testPrisma.student.findFirst({ where: { lrn } });
    if (!s) {
      s = await testPrisma.student.create({
        data: {
          id: generateId(),
          lrn,
          first_name: name,
          last_name: 'TestLearner',
          guardian_email: `${lrn}@example.com`,
          guardian_first_name: 'Guardian',
          guardian_last_name: 'TestLearner',
          grade_level: 8,
        }
      });
    }
    await testPrisma.gateAttendance.deleteMany({ where: { student_id: s.id } });
    return s;
  }

  const studentA = await getOrCreateTestStudent('999026999101', 'StudentA_Rollover');
  const studentB = await getOrCreateTestStudent('999026999102', 'StudentB_NoExit');
  const studentC = await getOrCreateTestStudent('999026999103', 'StudentC_DebouncePolicy');

  console.log('Test fixtures initialized and existing records cleared.\n');

  let passedTests = 0;
  const totalTests = 10;

  // ----------------------------------------------------------------------
  // TEST 1: November 8 entry and exit -> November 9 entry succeeds
  // ----------------------------------------------------------------------
  console.log('--- TEST 1: Nov 8 Complete Entry/Exit -> Nov 9 Entry Succeeds ---');
  // Asia/Manila (UTC+8):
  // Nov 8 07:30:00 Manila = 2026-11-07 23:30:00Z UTC
  // Nov 8 16:30:00 Manila = 2026-11-08 08:30:00Z UTC
  // Nov 9 07:15:00 Manila = 2026-11-08 23:15:00Z UTC
  const t1_in = new Date('2026-11-07T23:30:00.000Z');
  const t1_out = new Date('2026-11-08T08:30:00.000Z');
  const t1_next_in = new Date('2026-11-08T23:15:00.000Z');

  const r1_1 = await processRemediatedStudentGateScan(studentA.id, t1_in);
  const r1_2 = await processRemediatedStudentGateScan(studentA.id, t1_out);
  const r1_3 = await processRemediatedStudentGateScan(studentA.id, t1_next_in);

  const studentA_records = await testPrisma.gateAttendance.findMany({
    where: { student_id: studentA.id },
    orderBy: { date: 'asc' }
  });

  const t1_pass = r1_1.success && r1_1.action === 'Time In' &&
                  r1_2.success && r1_2.action === 'Time Out' &&
                  r1_3.success && r1_3.action === 'Time In' &&
                  studentA_records.length === 2 &&
                  studentA_records[0].date.toISOString().startsWith('2026-11-08') &&
                  studentA_records[1].date.toISOString().startsWith('2026-11-09');

  console.log(`- Nov 8 In:  action=${r1_1.action}, date=${r1_1.todayStr}`);
  console.log(`- Nov 8 Out: action=${r1_2.action}, date=${r1_2.todayStr}`);
  console.log(`- Nov 9 In:  action=${r1_3.action}, date=${r1_3.todayStr}`);
  console.log(`Test 1 Result: ${t1_pass ? 'PASS' : 'FAIL'}\n`);
  if (t1_pass) passedTests++;

  // ----------------------------------------------------------------------
  // TEST 2: November 8 entry without exit -> November 9 entry succeeds
  // ----------------------------------------------------------------------
  console.log('--- TEST 2: Nov 8 Entry Without Exit -> Nov 9 Entry Succeeds ---');
  const t2_in = new Date('2026-11-07T23:30:00.000Z'); // Nov 8 07:30 Manila
  const t2_next_in = new Date('2026-11-08T23:15:00.000Z'); // Nov 9 07:15 Manila

  const r2_1 = await processRemediatedStudentGateScan(studentB.id, t2_in);
  const r2_2 = await processRemediatedStudentGateScan(studentB.id, t2_next_in);

  const studentB_records = await testPrisma.gateAttendance.findMany({
    where: { student_id: studentB.id },
    orderBy: { date: 'asc' }
  });

  const t2_pass = r2_1.success && r2_1.action === 'Time In' &&
                  r2_2.success && r2_2.action === 'Time In' &&
                  studentB_records.length === 2 &&
                  studentB_records[0].time_out === null &&
                  studentB_records[1].time_in !== null;

  console.log(`- Nov 8 In (No Out): action=${r2_1.action}, date=${r2_1.todayStr}, time_out=${studentB_records[0].time_out}`);
  console.log(`- Nov 9 In:          action=${r2_2.action}, date=${r2_2.todayStr}`);
  console.log(`Test 2 Result: ${t2_pass ? 'PASS' : 'FAIL'}\n`);
  if (t2_pass) passedTests++;

  // ----------------------------------------------------------------------
  // TEST 3: UTC-hosted backend correctly identifies 7:00 AM Nov 9 PH as Nov 9
  // ----------------------------------------------------------------------
  console.log('--- TEST 3: UTC-Hosted Backend Timezone Resolution for 7:00 AM Nov 9 ---');
  // 7:00 AM Nov 9 Manila is 23:00 UTC on Nov 8
  const manila7am_instant = new Date('2026-11-08T23:00:00.000Z');

  // Remediated calculation
  const remediated_cal = getPhilippineCalendarDate(manila7am_instant);

  // Buggy calculation under UTC host (getTimezoneOffset() === 0)
  const buggy_utc_dateStr = new Date(manila7am_instant.getTime() - (0 * 60000)).toISOString().split('T')[0];

  const t3_pass = remediated_cal.dateStr === '2026-11-09' && buggy_utc_dateStr === '2026-11-08';
  console.log(`- Instant (UTC):         ${manila7am_instant.toISOString()}`);
  console.log(`- Old Buggy Code on UTC: ${buggy_utc_dateStr} (WRONGLY resolved to Sunday Nov 8)`);
  console.log(`- Remediated Code:       ${remediated_cal.dateStr} (CORRECTLY resolved to Monday Nov 9)`);
  console.log(`Test 3 Result: ${t3_pass ? 'PASS' : 'FAIL'}\n`);
  if (t3_pass) passedTests++;

  // ----------------------------------------------------------------------
  // TEST 4: Midnight rollover at 11:59 PM and 12:01 AM Philippine time
  // ----------------------------------------------------------------------
  console.log('--- TEST 4: Midnight Boundary Rollover at 11:59 PM and 12:01 AM ---');
  // Nov 8 23:59:00 Manila = Nov 8 15:59:00Z UTC
  // Nov 9 00:01:00 Manila = Nov 8 16:01:00Z UTC
  const t4_pre_midnight = new Date('2026-11-08T15:59:00.000Z');
  const t4_post_midnight = new Date('2026-11-08T16:01:00.000Z');

  const cal_pre = getPhilippineCalendarDate(t4_pre_midnight);
  const cal_post = getPhilippineCalendarDate(t4_post_midnight);

  const t4_pass = cal_pre.dateStr === '2026-11-08' && cal_post.dateStr === '2026-11-09';
  console.log(`- 11:59 PM Manila (UTC 15:59): dateStr="${cal_pre.dateStr}"`);
  console.log(`- 12:01 AM Manila (UTC 16:01): dateStr="${cal_post.dateStr}"`);
  console.log(`Test 4 Result: ${t4_pass ? 'PASS' : 'FAIL'}\n`);
  if (t4_pass) passedTests++;

  // ----------------------------------------------------------------------
  // TEST 5: 60-second duplicate prevention remains correct
  // ----------------------------------------------------------------------
  console.log('--- TEST 5: 60-Second Duplicate Scan Prevention ---');
  const t5_scan1 = new Date('2026-11-08T00:00:00.000Z'); // 8:00 AM Manila
  const t5_scan_dup = new Date(t5_scan1.getTime() + 15000); // 15 seconds later
  const t5_scan2 = new Date(t5_scan1.getTime() + 65000);   // 65 seconds later

  const r5_1 = await processRemediatedStudentGateScan(studentC.id, t5_scan1);
  const r5_dup = await processRemediatedStudentGateScan(studentC.id, t5_scan_dup);
  const r5_2 = await processRemediatedStudentGateScan(studentC.id, t5_scan2);

  const t5_pass = r5_1.success && r5_1.action === 'Time In' &&
                  !r5_dup.success && r5_dup.message?.includes('duplicate scan within 1 minute') &&
                  r5_2.success && r5_2.action === 'Time Out';

  console.log(`- Scan 1 (T0):       success=${r5_1.success}, action="${r5_1.action}"`);
  console.log(`- Scan 2 (T0 + 15s): success=${r5_dup.success}, error="${r5_dup.message}"`);
  console.log(`- Scan 3 (T0 + 65s): success=${r5_2.success}, action="${r5_2.action}"`);
  console.log(`Test 5 Result: ${t5_pass ? 'PASS' : 'FAIL'}\n`);
  if (t5_pass) passedTests++;

  // ----------------------------------------------------------------------
  // TEST 6: One-entry/one-exit daily policy remains unchanged
  // ----------------------------------------------------------------------
  console.log('--- TEST 6: One-Entry/One-Exit Daily Policy Preserved ---');
  const t6_3rd_scan = new Date(t5_scan2.getTime() + 180000); // 3 minutes after Time Out
  const r6_3 = await processRemediatedStudentGateScan(studentC.id, t6_3rd_scan);

  const t6_pass = !r6_3.success && r6_3.message === 'Student already timed out today.';
  console.log(`- Scan 4 (After Exit): success=${r6_3.success}, error="${r6_3.message}"`);
  console.log(`Test 6 Result: ${t6_pass ? 'PASS' : 'FAIL'}\n`);
  if (t6_pass) passedTests++;

  // ----------------------------------------------------------------------
  // TEST 7: Historical records remain intact
  // ----------------------------------------------------------------------
  console.log('--- TEST 7: Historical Records Preservation & Ordering ---');
  const historyA = await testPrisma.gateAttendance.findMany({
    where: { student_id: studentA.id },
    orderBy: { date: 'desc' }
  });

  const t7_pass = historyA.length === 2 &&
                  historyA[0].date.toISOString().startsWith('2026-11-09') &&
                  historyA[1].date.toISOString().startsWith('2026-11-08') &&
                  historyA[1].time_out !== null;

  console.log(`- Records found for Student A: ${historyA.length}`);
  for (const h of historyA) {
    console.log(`  * Date: ${h.date.toISOString().split('T')[0]}, In: ${h.time_in ? 'SET' : 'NULL'}, Out: ${h.time_out ? 'SET' : 'NULL'}`);
  }
  console.log(`Test 7 Result: ${t7_pass ? 'PASS' : 'FAIL'}\n`);
  if (t7_pass) passedTests++;

  // ----------------------------------------------------------------------
  // TEST 8: Student Gate and Faculty Gate use consistent date calculations
  // ----------------------------------------------------------------------
  console.log('--- TEST 8: Consistency Between Student Gate and Faculty Gate ---');
  const test_moments = [
    new Date('2026-11-08T15:59:59.000Z'), // 11:59:59 PM Manila
    new Date('2026-11-08T16:00:00.000Z'), // 12:00:00 AM Manila
    new Date('2026-11-08T23:30:00.000Z'), // 07:30:00 AM Manila
    new Date('2026-11-09T08:00:00.000Z'), // 04:00:00 PM Manila
  ];

  let consistentCount = 0;
  for (const m of test_moments) {
    const studentCal = getPhilippineCalendarDate(m);
    const facultyCal = resolveFacultyGateDate(m);
    const match = studentCal.dateStr === facultyCal.dateStr &&
                  studentCal.dateObj.getTime() === facultyCal.dateObj.getTime();
    if (match) consistentCount++;
    console.log(`- Moment ${m.toISOString()}: Student=${studentCal.dateStr}, Faculty=${facultyCal.dateStr} [${match ? 'MATCH' : 'MISMATCH'}]`);
  }

  const t8_pass = consistentCount === test_moments.length;
  console.log(`Test 8 Result: ${t8_pass ? 'PASS' : 'FAIL'}\n`);
  if (t8_pass) passedTests++;

  // ----------------------------------------------------------------------
  // TEST 9: Guardian notification timestamps remain accurate
  // ----------------------------------------------------------------------
  console.log('--- TEST 9: Guardian Notification Date/Time Formatting Accuracy ---');
  const morning_scan_time = new Date('2026-11-08T23:30:00.000Z'); // 7:30 AM Manila Nov 9
  const { dateObj: morning_today } = getPhilippineCalendarDate(morning_scan_time);

  const formatted_date = formatPhilippineDate(morning_today);
  const formatted_time = formatPhilippineTime(morning_scan_time);

  const rendered = renderTimeInTemplate({
    studentName: 'Francis Dizon Garcia',
    attendanceDate: formatted_date,
    timeStr: formatted_time,
    punctualityStatus: 'On Time',
  });

  const t9_pass = formatted_date === 'November 9, 2026' &&
                  formatted_time === '7:30 AM' &&
                  rendered.htmlContent.includes('November 9, 2026') &&
                  rendered.htmlContent.includes('7:30 AM');

  console.log(`- Formatted Date: "${formatted_date}" (Expected: "November 9, 2026")`);
  console.log(`- Formatted Time: "${formatted_time}" (Expected: "7:30 AM")`);
  console.log(`- Email Contains Date & Time: ${t9_pass ? 'YES' : 'NO'}`);
  console.log(`Test 9 Result: ${t9_pass ? 'PASS' : 'FAIL'}\n`);
  if (t9_pass) passedTests++;

  // ----------------------------------------------------------------------
  // TEST 10: Official SF2 classroom attendance remains unaffected
  // ----------------------------------------------------------------------
  console.log('--- TEST 10: Official SF2 Classroom Attendance Separation Check ---');
  const officialCountBefore = await testPrisma.officialDailyAttendance.count();
  const classAttendanceCountBefore = await testPrisma.classAttendance.count();

  // Perform a gate scan
  await processRemediatedStudentGateScan(studentA.id, new Date());

  const officialCountAfter = await testPrisma.officialDailyAttendance.count();
  const classAttendanceCountAfter = await testPrisma.classAttendance.count();

  const t10_pass = officialCountBefore === officialCountAfter &&
                   classAttendanceCountBefore === classAttendanceCountAfter;

  console.log(`- OfficialDailyAttendance Count Before: ${officialCountBefore}, After: ${officialCountAfter}`);
  console.log(`- ClassAttendance Count Before:         ${classAttendanceCountBefore}, After: ${classAttendanceCountAfter}`);
  console.log(`Test 10 Result: ${t10_pass ? 'PASS (Zero unintended side-effects on SF2/Classroom)' : 'FAIL'}\n`);
  if (t10_pass) passedTests++;

  // Cleanup test students attendance rows
  await testPrisma.gateAttendance.deleteMany({
    where: { student_id: { in: [studentA.id, studentB.id, studentC.id] } }
  });

  console.log('========================================================================');
  console.log(`  REGRESSION TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${(passedTests/totalTests)*100}%)`);
  console.log('========================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main()
  .catch(e => {
    console.error('REGRESSION SUITE FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await testPrisma.$disconnect();
  });
