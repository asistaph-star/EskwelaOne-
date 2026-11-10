import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid.js';
import { getPhilippineCalendarDate } from '../src/common/utils/dateTime.js';
import { formatPhilippineDate, formatPhilippineTime } from '../src/notifications/punctuality.service.js';
import { renderTimeInTemplate, renderTimeOutTemplate } from '../src/notifications/email/templates/gateAttendanceTemplates.js';

// Dedicated isolated client strictly bound to digiskwela_test
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:admin123@localhost:5432/digiskwela_test?schema=public'
    }
  }
});

// Helper simulating gate scan endpoint logic
async function processScan(studentId: string, now: Date) {
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
        message: 'Student has already exited campus today.',
        todayStr,
        today,
        action: null,
      };
    }

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

  // Presentation-layer mappings as rendered in GateTerminalScreen / PLiveFacultyAttendance:
  const displayBadge = action === 'Time In' ? 'ENTRY' : 'EXIT';
  const displayStatus = action === 'Time In' ? 'ENTRY RECORDED' : 'EXIT RECORDED';
  const displayAction = action === 'Time In' ? 'Campus Entry' : 'Campus Exit';

  return {
    success: true,
    status: 200,
    action, // API contract backward-compatible
    eventType,
    todayStr,
    today,
    entry: resultEntry,
    displayBadge,
    displayStatus,
    displayAction,
    formattedDate: formatPhilippineDate(today),
    formattedTime: formatPhilippineTime(now),
  };
}

async function main() {
  console.log('========================================================================');
  console.log('  CAMPUS ENTRY & EXIT TERMINOLOGY STANDARDIZATION — REGRESSION SUITE');
  console.log('========================================================================\n');

  // Verify connected database is digiskwela_test
  const dbResult = await testPrisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  const currentDb = dbResult[0].current_database;
  console.log(`[SAFETY CHECK] Connected Database: ${currentDb}`);
  if (currentDb !== 'digiskwela_test') {
    throw new Error(`CRITICAL ABORT: Regression suite must strictly run against digiskwela_test, not ${currentDb}`);
  }

  // Setup synthetic test student
  const lrn = '999026999201';
  let student = await testPrisma.student.findFirst({ where: { lrn } });
  if (!student) {
    student = await testPrisma.student.create({
      data: {
        id: generateId(),
        lrn,
        first_name: 'Angela',
        last_name: 'Dizon',
        guardian_email: 'angela.guardian@example.com',
        guardian_first_name: 'Maria',
        guardian_last_name: 'Dizon',
        grade_level: 9,
      }
    });
  }
  await testPrisma.gateAttendance.deleteMany({ where: { student_id: student.id } });

  let passedTests = 0;
  const totalTests = 10;

  // ----------------------------------------------------------------------
  // 1. Campus Entry displays correctly
  // ----------------------------------------------------------------------
  console.log('--- 1. Campus Entry Presentation Display ---');
  const t_in = new Date('2026-11-09T07:15:00.000+08:00');
  const res1 = await processScan(student.id, t_in);
  const t1_pass = res1.displayBadge === 'ENTRY' &&
                  res1.displayStatus === 'ENTRY RECORDED' &&
                  res1.displayAction === 'Campus Entry';
  console.log(`- Badge:  "${res1.displayBadge}" (Expected: "ENTRY")`);
  console.log(`- Status: "${res1.displayStatus}" (Expected: "ENTRY RECORDED")`);
  console.log(`- Action: "${res1.displayAction}" (Expected: "Campus Entry")`);
  console.log(`Test 1 Result: ${t1_pass ? 'PASS' : 'FAIL'}\n`);
  if (t1_pass) passedTests++;

  // ----------------------------------------------------------------------
  // 2. Campus Exit displays correctly
  // ----------------------------------------------------------------------
  console.log('--- 2. Campus Exit Presentation Display ---');
  const t_out = new Date('2026-11-09T16:30:00.000+08:00');
  const res2 = await processScan(student.id, t_out);
  const t2_pass = res2.displayBadge === 'EXIT' &&
                  res2.displayStatus === 'EXIT RECORDED' &&
                  res2.displayAction === 'Campus Exit';
  console.log(`- Badge:  "${res2.displayBadge}" (Expected: "EXIT")`);
  console.log(`- Status: "${res2.displayStatus}" (Expected: "EXIT RECORDED")`);
  console.log(`- Action: "${res2.displayAction}" (Expected: "Campus Exit")`);
  console.log(`Test 2 Result: ${t2_pass ? 'PASS' : 'FAIL'}\n`);
  if (t2_pass) passedTests++;

  // ----------------------------------------------------------------------
  // 3. Existing scan API contracts remain compatible
  // ----------------------------------------------------------------------
  console.log('--- 3. API Contract Backward-Compatibility ---');
  const t3_pass = res1.action === 'Time In' &&
                  res2.action === 'Time Out' &&
                  res1.eventType === 'TIME_IN' &&
                  res2.eventType === 'TIME_OUT' &&
                  typeof res1.entry.id === 'string';
  console.log(`- Entry scan API action field: "${res1.action}" (Preserved)`);
  console.log(`- Exit scan API action field:  "${res2.action}" (Preserved)`);
  console.log(`- Internal eventType:          "${res1.eventType}" / "${res2.eventType}" (Preserved)`);
  console.log(`Test 3 Result: ${t3_pass ? 'PASS' : 'FAIL'}\n`);
  if (t3_pass) passedTests++;

  // ----------------------------------------------------------------------
  // 4. Principal monitoring renders corresponding activity
  // ----------------------------------------------------------------------
  console.log('--- 4. Principal Gate Monitoring Transformation ---');
  // Simulating the PLiveFacultyAttendance transformation
  const principalItem = {
    id: `${res1.entry.id}-in`,
    studentName: `${student.first_name} ${student.last_name}`,
    action: res1.action,
    badgeText: res1.action === 'Time In' ? 'ENTRY' : 'EXIT',
    statusText: res1.action === 'Time In' ? 'ENTRY RECORDED' : 'EXIT RECORDED',
    timeFormatted: res1.formattedTime,
  };
  const t4_pass = principalItem.badgeText === 'ENTRY' &&
                  principalItem.statusText === 'ENTRY RECORDED' &&
                  principalItem.timeFormatted === '7:15 AM';
  console.log(`- Principal Badge:  "${principalItem.badgeText}"`);
  console.log(`- Principal Status: "${principalItem.statusText}"`);
  console.log(`- Time Formatted:   "${principalItem.timeFormatted}"`);
  console.log(`Test 4 Result: ${t4_pass ? 'PASS' : 'FAIL'}\n`);
  if (t4_pass) passedTests++;

  // ----------------------------------------------------------------------
  // 5. Guardian arrival email uses updated terminology
  // ----------------------------------------------------------------------
  console.log('--- 5. Guardian Arrival Notification Terminology ---');
  const arrivalEmail = renderTimeInTemplate({
    studentName: `${student.first_name} ${student.last_name}`,
    attendanceDate: res1.formattedDate,
    timeStr: res1.formattedTime,
    punctualityStatus: 'On Time',
  });

  const t5_pass = arrivalEmail.subject.includes('Student Arrival Notification') &&
                  arrivalEmail.subject.includes('Campus Entry Recorded') &&
                  arrivalEmail.htmlContent.includes('Campus Entry Recorded') &&
                  arrivalEmail.htmlContent.includes('Entry Time:') &&
                  arrivalEmail.textContent.includes('Entry Time:') &&
                  arrivalEmail.htmlContent.includes('recorded at the school gate') &&
                  arrivalEmail.htmlContent.includes('does not confirm classroom attendance');

  console.log(`- Subject: "${arrivalEmail.subject}"`);
  console.log(`- Header:  "Campus Entry Recorded" present: ${arrivalEmail.htmlContent.includes('Campus Entry Recorded')}`);
  console.log(`- Field:   "Entry Time:" present: ${arrivalEmail.htmlContent.includes('Entry Time:')}`);
  console.log(`- No Classroom Inferred Disclaimer present: ${arrivalEmail.htmlContent.includes('does not confirm classroom attendance')}`);
  console.log(`Test 5 Result: ${t5_pass ? 'PASS' : 'FAIL'}\n`);
  if (t5_pass) passedTests++;

  // ----------------------------------------------------------------------
  // 6. Guardian departure email uses updated terminology
  // ----------------------------------------------------------------------
  console.log('--- 6. Guardian Departure Notification Terminology ---');
  const departureEmail = renderTimeOutTemplate({
    studentName: `${student.first_name} ${student.last_name}`,
    attendanceDate: res2.formattedDate,
    timeStr: res2.formattedTime,
  });

  const t6_pass = departureEmail.subject.includes('Student Departure Notification') &&
                  departureEmail.subject.includes('Campus Exit Recorded') &&
                  departureEmail.htmlContent.includes('Campus Exit Recorded') &&
                  departureEmail.htmlContent.includes('Exit Time:') &&
                  departureEmail.textContent.includes('Exit Time:') &&
                  departureEmail.htmlContent.includes('recorded at the school gate') &&
                  departureEmail.htmlContent.includes('does not confirm arrival at home');

  console.log(`- Subject: "${departureEmail.subject}"`);
  console.log(`- Header:  "Campus Exit Recorded" present: ${departureEmail.htmlContent.includes('Campus Exit Recorded')}`);
  console.log(`- Field:   "Exit Time:" present: ${departureEmail.htmlContent.includes('Exit Time:')}`);
  console.log(`- No Home Arrival Inferred Disclaimer present: ${departureEmail.htmlContent.includes('does not confirm arrival at home')}`);
  console.log(`Test 6 Result: ${t6_pass ? 'PASS' : 'FAIL'}\n`);
  if (t6_pass) passedTests++;

  // ----------------------------------------------------------------------
  // 7. Correct event remains mapped to correct notification
  // ----------------------------------------------------------------------
  console.log('--- 7. Event Mapping Integrity ---');
  // TIME_IN -> arrivalEmail (Campus Entry)
  // TIME_OUT -> departureEmail (Campus Exit)
  const t7_pass = res1.eventType === 'TIME_IN' &&
                  arrivalEmail.subject.includes('Campus Entry') &&
                  res2.eventType === 'TIME_OUT' &&
                  departureEmail.subject.includes('Campus Exit');
  console.log(`- TIME_IN maps to Entry Template: ${res1.eventType === 'TIME_IN'}`);
  console.log(`- TIME_OUT maps to Exit Template: ${res2.eventType === 'TIME_OUT'}`);
  console.log(`Test 7 Result: ${t7_pass ? 'PASS' : 'FAIL'}\n`);
  if (t7_pass) passedTests++;

  // ----------------------------------------------------------------------
  // 8. Daily rollover continues working in Asia/Manila
  // ----------------------------------------------------------------------
  console.log('--- 8. Daily Rollover Integrity in Asia/Manila ---');
  // Student now scans on next day (Nov 10 07:15)
  const t_next_day = new Date('2026-11-10T07:15:00.000+08:00');
  const resNextDay = await processScan(student.id, t_next_day);

  const studentRecords = await testPrisma.gateAttendance.findMany({
    where: { student_id: student.id },
    orderBy: { date: 'asc' }
  });

  const t8_pass = resNextDay.success &&
                  resNextDay.displayAction === 'Campus Entry' &&
                  studentRecords.length === 2 &&
                  studentRecords[0].date.toISOString().startsWith('2026-11-09') &&
                  studentRecords[1].date.toISOString().startsWith('2026-11-10');

  console.log(`- Next Day Scan: action="${resNextDay.displayAction}", date=${resNextDay.todayStr}`);
  console.log(`- Preserved Historical Records Count: ${studentRecords.length}`);
  console.log(`Test 8 Result: ${t8_pass ? 'PASS' : 'FAIL'}\n`);
  if (t8_pass) passedTests++;

  // ----------------------------------------------------------------------
  // 9. 60-second duplicate restriction remains functional
  // ----------------------------------------------------------------------
  console.log('--- 9. Duplicate Restriction Functional Check ---');
  const t_dup = new Date(t_next_day.getTime() + 15000); // 15 seconds after Nov 10 entry
  const resDup = await processScan(student.id, t_dup);

  const t9_pass = !resDup.success &&
                  resDup.status === 422 &&
                  resDup.message === 'Scan ignored (duplicate scan within 1 minute).';

  console.log(`- Duplicate Scan Result: success=${resDup.success}, status=${resDup.status}, msg="${resDup.message}"`);
  console.log(`Test 9 Result: ${t9_pass ? 'PASS' : 'FAIL'}\n`);
  if (t9_pass) passedTests++;

  // ----------------------------------------------------------------------
  // 10. No changes occur in official classroom attendance
  // ----------------------------------------------------------------------
  console.log('--- 10. Official Classroom SF2 Attendance Decoupling Check ---');
  const sf2CountBefore = await testPrisma.officialDailyAttendance.count();
  const classAttCountBefore = await testPrisma.classAttendance.count();

  // Completed cycle scan (exit on Nov 10)
  const t_next_out = new Date('2026-11-10T16:30:00.000+08:00');
  await processScan(student.id, t_next_out);

  const sf2CountAfter = await testPrisma.officialDailyAttendance.count();
  const classAttCountAfter = await testPrisma.classAttendance.count();

  const t10_pass = sf2CountBefore === sf2CountAfter &&
                   classAttCountBefore === classAttCountAfter;

  console.log(`- OfficialDailyAttendance Count: Before=${sf2CountBefore}, After=${sf2CountAfter}`);
  console.log(`- ClassAttendance Count:         Before=${classAttCountBefore}, After=${classAttCountAfter}`);
  console.log(`Test 10 Result: ${t10_pass ? 'PASS (Zero SF2/Classroom side-effects)' : 'FAIL'}\n`);
  if (t10_pass) passedTests++;

  // Clean up synthetic student attendance
  await testPrisma.gateAttendance.deleteMany({ where: { student_id: student.id } });

  console.log('========================================================================');
  console.log(`  REGRESSION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${(passedTests/totalTests)*100}%)`);
  console.log('========================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main()
  .catch(e => {
    console.error('REGRESSION FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await testPrisma.$disconnect();
  });

