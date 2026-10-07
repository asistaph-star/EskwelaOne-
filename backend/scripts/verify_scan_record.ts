/**
 * POST-SCAN DATABASE VERIFICATION — READ ONLY
 * Verifies the GateAttendance record created by the physical scan.
 */
import prisma from '../src/config/database';

const TEST_LRN = '123456789012';

async function main() {
  console.log('=== POST-SCAN DATABASE VERIFICATION ===\n');

  const student = await prisma.student.findUnique({
    where: { lrn: TEST_LRN },
    select: { id: true, user: { select: { first_name: true, last_name: true } } }
  });

  if (!student) {
    console.log('FAIL — Student not found for LRN', TEST_LRN);
    return;
  }

  console.log('Student: ', student.user?.first_name, student.user?.last_name, '| ID:', student.id);
  console.log();

  // Check ALL gate_attendance records for this student (not just today)
  // so we can see exactly what the physical scan created.
  const records = await prisma.gateAttendance.findMany({
    where: { student_id: student.id },
    orderBy: { date: 'desc' },
  });

  if (records.length === 0) {
    console.log('FAIL — No GateAttendance records found at all for this student.');
    return;
  }

  console.log(`Found ${records.length} GateAttendance record(s) total for this student:\n`);
  for (const r of records) {
    console.log('  Record ID  :', r.id);
    console.log('  Date       :', r.date.toISOString().split('T')[0]);
    console.log('  Status     :', r.status);
    console.log('  time_in    :', r.time_in);
    console.log('  time_out   :', r.time_out);
    console.log('  created_at :', r.created_at.toISOString());
    console.log('  updated_at :', r.updated_at.toISOString());
    console.log();
  }
}

main().finally(() => process.exit(0));
