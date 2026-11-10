import prisma from '../src/config/database.js';

async function main() {
  const dbNameResult = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  const currentDb = dbNameResult[0].current_database;
  console.log(`Current Database: ${currentDb}`);

  if (currentDb !== 'digiskwela_acceptance') {
    throw new Error(`Database assertion failed: expected 'digiskwela_acceptance', got '${currentDb}'`);
  }

  const targetIds = [
    '01a1b999-d07d-73cc-bc7f-542449ef6c51',
    '01a1b999-d853-73ee-81ba-fed7baf6195a',
    '01a1b99d-a7ba-72f6-a6ba-636171d35047'
  ];

  const records = await prisma.gateAttendanceNotification.findMany({
    where: { id: { in: targetIds } },
    include: {
      student: {
        select: {
          lrn: true,
          first_name: true,
          last_name: true
        }
      },
      attendance: {
        select: {
          id: true,
          time_in: true,
          time_out: true,
          date: true
        }
      }
    },
    orderBy: { created_at: 'asc' }
  });

  console.log(`\nFound ${records.length} target records:`);
  for (const r of records) {
    console.log(`---`);
    console.log(`Notification ID: ${r.id}`);
    console.log(`Student:         ${r.student.first_name} ${r.student.last_name} (LRN: ${r.student.lrn})`);
    console.log(`Recipient:       ${r.recipient_email} (${r.recipient_role})`);
    console.log(`Status:          ${r.status}`);
    console.log(`Attempts:        ${r.attempt_count} / ${r.max_attempts}`);
    console.log(`Error Message:   ${r.error_message}`);
    console.log(`Created At:      ${r.created_at.toISOString()}`);
    console.log(`Updated At:      ${r.updated_at.toISOString()}`);
    console.log(`Attendance ID:   ${r.attendance_id}`);
    console.log(`Time In/Out:     In=${r.attendance.time_in ? r.attendance.time_in.toISOString() : 'null'} Out=${r.attendance.time_out ? r.attendance.time_out.toISOString() : 'null'}`);
  }

  const pendingOrProcessing = await prisma.gateAttendanceNotification.findMany({
    where: { status: { in: ['PENDING', 'PROCESSING'] } }
  });
  console.log(`\nTotal PENDING/PROCESSING records across entire outbox: ${pendingOrProcessing.length}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
