/**
 * CONTROLLED TEST DATA RESET
 * 
 * Target: demo-student-1
 * Date: 2026-10-05 (Server local date)
 * 
 * Deletes ONLY the GateAttendance record for the test student on the current day,
 * so the physical scanner tests can be cleanly repeated from Time In.
 */

import prisma from '../src/config/database';

async function main() {
  console.log('=== CONTROLLED TEST DATA RESET ===\n');

  const student = await prisma.student.findUnique({
    where: { lrn: '123456789012' }, // Find by known LRN
    select: { id: true, user: { select: { first_name: true, last_name: true } } }
  });

  if (!student) {
    console.log('FAIL — Student demo-student-1 not found.');
    return;
  }

  console.log(`Target Student: ${student.user?.first_name} ${student.user?.last_name} | ID: ${student.id}`);

  // Find today's record
  const now = new Date();
  const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const today = new Date(todayStr);

  const todayRecord = await prisma.gateAttendance.findFirst({
    where: {
      student_id: student.id,
      date: today
    }
  });

  if (!todayRecord) {
    console.log(`INFO — No record found for date ${todayStr}. Already clean.`);
  } else {
    console.log('\nFound record to delete:');
    console.log('  ID       :', todayRecord.id);
    console.log('  Date     :', todayRecord.date.toISOString());
    console.log('  time_in  :', todayRecord.time_in);
    console.log('  time_out :', todayRecord.time_out);
    console.log('  status   :', todayRecord.status);

    // Delete ONLY this specific record
    await prisma.gateAttendance.delete({
      where: { id: todayRecord.id }
    });
    console.log('\nSUCCESS — Record deleted.');
  }

  // Prove current state
  console.log('\n--- VERIFICATION ---');
  
  const remainingRecords = await prisma.gateAttendance.findMany({
    where: { student_id: student.id },
    orderBy: { date: 'desc' }
  });

  console.log(`Student now has ${remainingRecords.length} remaining historical record(s):`);
  for (const r of remainingRecords) {
    console.log(`  Date: ${r.date.toISOString().split('T')[0]} | ID: ${r.id}`);
  }

  console.log('\n=== RESET COMPLETE ===');
}

main().finally(() => process.exit(0));
