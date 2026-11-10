import prisma from '../src/config/database.js';

async function main() {
  console.log('=== DIGISKWELA: TRANSACTIONAL NOTIFICATION STATUS TRANSITION ===\n');

  // Step 1: Confirm current database is digiskwela_acceptance
  const dbNameResult = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  const currentDb = dbNameResult[0].current_database;
  console.log(`[CHECK 1] current_database(): ${currentDb}`);
  if (currentDb !== 'digiskwela_acceptance') {
    throw new Error(`CRITICAL ABORT: Expected database 'digiskwela_acceptance', but connected to '${currentDb}'`);
  }

  const targetIds = [
    '01a1b999-d07d-73cc-bc7f-542449ef6c51',
    '01a1b999-d853-73ee-81ba-fed7baf6195a',
    '01a1b99d-a7ba-72f6-a6ba-636171d35047'
  ];

  // Step 2: Pre-update verification of the exact 3 notification records
  console.log(`\n[CHECK 2] Verifying pre-update state of the 3 target notification records...`);
  const preRecords = await prisma.gateAttendanceNotification.findMany({
    where: { id: { in: targetIds } },
    include: {
      student: { select: { lrn: true, first_name: true, last_name: true } },
      attendance: { select: { id: true, time_in: true, time_out: true } }
    },
    orderBy: { created_at: 'asc' }
  });

  if (preRecords.length !== 3) {
    throw new Error(`CRITICAL ABORT: Expected 3 records, found ${preRecords.length}`);
  }

  for (const r of preRecords) {
    console.log(`- ID: ${r.id}`);
    console.log(`  Student: ${r.student.first_name} ${r.student.last_name} (LRN: ${r.student.lrn})`);
    console.log(`  Recipient: ${r.recipient_email}`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Attempts: ${r.attempt_count}`);
    console.log(`  Recorded Error: ${r.error_message}`);
    console.log(`  Attendance ID: ${r.attendance_id}`);

    if (r.status !== 'PENDING') {
      throw new Error(`CRITICAL ABORT: Record ${r.id} status is '${r.status}', expected 'PENDING'`);
    }
    if (!r.error_message || !r.error_message.includes('Key not found')) {
      throw new Error(`CRITICAL ABORT: Record ${r.id} does not contain expected HTTP 401 'Key not found' error: '${r.error_message}'`);
    }
  }

  // Step 3: Execute the three status updates transactionally, conditional on status = 'PENDING'
  console.log(`\n[EXECUTE 3] Executing transactional conditional status update (PENDING -> FAILED)...`);
  const transitionNote = 'Provider authentication error (HTTP 401: Key not found). Preserved for audit evidence; replay prevented.';

  const updateResults = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const id of targetIds) {
      const updateResult = await tx.gateAttendanceNotification.updateMany({
        where: {
          id: id,
          status: 'PENDING'
        },
        data: {
          status: 'FAILED',
          error_message: transitionNote
        }
      });

      if (updateResult.count !== 1) {
        throw new Error(`Transaction rollback: Record ${id} update count was ${updateResult.count}, expected 1.`);
      }
      results.push({ id, count: updateResult.count });
    }
    return results;
  });

  console.log(`Transactional update committed successfully! Updated count: ${updateResults.length}`);

  // Step 4: Post-update verification
  console.log(`\n[VERIFY 4] Verifying post-update records in digiskwela_acceptance...`);
  const postRecords = await prisma.gateAttendanceNotification.findMany({
    where: { id: { in: targetIds } },
    include: {
      student: { select: { lrn: true, first_name: true, last_name: true } },
      attendance: { select: { id: true, time_in: true, time_out: true } }
    },
    orderBy: { created_at: 'asc' }
  });

  for (const r of postRecords) {
    console.log(`- ID: ${r.id}`);
    console.log(`  Student: ${r.student.first_name} ${r.student.last_name} (LRN: ${r.student.lrn})`);
    console.log(`  Recipient: ${r.recipient_email}`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Attempts: ${r.attempt_count}`);
    console.log(`  Error: ${r.error_message}`);
    console.log(`  Created At: ${r.created_at.toISOString()}`);
    console.log(`  Updated At: ${r.updated_at.toISOString()}`);
    console.log(`  Attendance ID: ${r.attendance_id}`);

    if (r.status !== 'FAILED') {
      throw new Error(`POST-VERIFICATION ERROR: Record ${r.id} status is '${r.status}', expected 'FAILED'`);
    }
  }

  // Step 5: Verify outbox backlog is strictly ZERO
  const remainingBacklog = await prisma.gateAttendanceNotification.count({
    where: { status: { in: ['PENDING', 'PROCESSING'] } }
  });
  console.log(`\n[VERIFY 5] Remaining PENDING or PROCESSING outbox backlog: ${remainingBacklog}`);
  if (remainingBacklog !== 0) {
    throw new Error(`POST-VERIFICATION ERROR: Outbox backlog is ${remainingBacklog}, expected strictly 0`);
  }

  // Step 6: Full table breakdown
  const statusCounts = await prisma.gateAttendanceNotification.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  console.log(`\n[AUDIT 6] Full outbox status breakdown in digiskwela_acceptance:`);
  for (const sc of statusCounts) {
    console.log(`  ${sc.status}: ${sc._count.id}`);
  }
}

main()
  .catch(e => {
    console.error('EXECUTION FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

