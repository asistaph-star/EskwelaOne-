import { PrismaClient } from '@prisma/client';

async function testTz() {
  const p = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:admin123@localhost:5432/digiskwela_phase2c_test?schema=public' } }
  });

  const [res] = await p.$queryRawUnsafe<any[]>('SELECT NOW() as pg_now, CURRENT_TIMESTAMP as pg_ts;');
  console.log('Postgres NOW:', res.pg_now);
  console.log('JS Date:', new Date().toISOString());

  // Test updating updated_at via Prisma
  const testId = 'test_tz_check';
  await p.$queryRawUnsafe(`
    INSERT INTO gate_attendance_notifications (id, attendance_id, student_id, event_type, recipient_role, recipient_email, recipient_name, status, next_attempt_at, created_at, updated_at)
    VALUES ('test_tz_check', 'none', 'none', 'TIME_IN', 'GUARDIAN', 'a@b.com', 'Name', 'PROCESSING', NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);

  const pastDate = new Date(Date.now() - 10 * 60 * 1000);
  await p.gateAttendanceNotification.update({
    where: { id: testId },
    data: { updated_at: pastDate }
  });

  const row = await p.gateAttendanceNotification.findUnique({ where: { id: testId } });
  console.log('Updated row updated_at via Prisma update:', row?.updated_at);
  console.log('Is row updated_at <= now - 5 mins?', row && row.updated_at.getTime() <= Date.now() - 5 * 60 * 1000);

  await p.gateAttendanceNotification.delete({ where: { id: testId } });
  await p.$disconnect();
}

testTz().catch(console.error);

