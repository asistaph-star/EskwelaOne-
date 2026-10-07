/**
 * PREFLIGHT CHECK — READ ONLY
 * Verifies test student state before physical scan.
 * Does NOT create, update, or delete any records.
 */
import prisma from '../src/config/database';

const TEST_LRN = '123456789012';

async function main() {
  console.log('=== PREFLIGHT CHECK (READ-ONLY) ===\n');

  // 1. Resolve student via encrypted Prisma client
  const student = await prisma.student.findUnique({
    where: { lrn: TEST_LRN },
    include: {
      user: { select: { first_name: true, last_name: true, email: true, status: true } }
    }
  });

  if (!student) {
    console.log('RESULT 1 — Student lookup: FAIL — No student found for LRN', TEST_LRN);
    return;
  }

  console.log('RESULT 1 — Student lookup: PASS');
  console.log('  Student ID:', student.id);
  console.log('  Name:', student.user?.first_name, student.user?.last_name);
  console.log('  User email:', student.user?.email);
  console.log('  User status:', student.user?.status);
  console.log();

  // 2. Check for existing GateAttendance record for TODAY
  const now = new Date();
  const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
    .toISOString().split('T')[0];
  const today = new Date(todayStr);

  console.log('Checking GateAttendance for date:', todayStr, '(server local date)');

  const existing = await prisma.gateAttendance.findUnique({
    where: {
      student_id_date: {
        student_id: student.id,
        date: today,
      }
    }
  });

  if (!existing) {
    console.log('RESULT 2 — Existing GateAttendance for today: NONE');
    console.log('  → Safe state: First scan will be a Time In.');
  } else {
    console.log('RESULT 2 — Existing GateAttendance for today: FOUND');
    console.log('  Record ID  :', existing.id);
    console.log('  Status     :', existing.status);
    console.log('  time_in    :', existing.time_in);
    console.log('  time_out   :', existing.time_out);
    console.log('  created_at :', existing.created_at);
    console.log('  updated_at :', existing.updated_at);
    console.log();
    if (existing.time_out) {
      console.log('  → WARNING: Student already has time_in AND time_out today.');
      console.log('    Next scan will be REJECTED (already timed out).');
    } else {
      console.log('  → WARNING: Student already has time_in today. No time_out yet.');
      console.log('    Next scan will attempt Time Out (not Time In).');
      console.log('    Check updated_at to see if debounce (60s) would block it.');
      const secondsSinceUpdate = (now.getTime() - existing.updated_at.getTime()) / 1000;
      console.log('    Seconds since last update:', secondsSinceUpdate.toFixed(1));
      if (secondsSinceUpdate < 60) {
        console.log('    → BLOCKED: Within 60-second debounce window. Scan would be rejected.');
      } else {
        console.log('    → Next scan would record Time Out.');
      }
    }
  }

  console.log();

  // 3. Check Principal user permissions
  console.log('RESULT 3 — Principal permission check:');
  const principals = await (prisma as any).$queryRaw`
    SELECT u.email, p.key as permission
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE r.name = 'Principal'
    AND p.key IN ('attendance:write', 'attendance:write_all', 'attendance:read')
    LIMIT 20
  `;

  if (!principals || principals.length === 0) {
    console.log('  → NOT VERIFIED: No Principal role permissions found for attendance endpoints.');
  } else {
    const distinctPerms = [...new Set((principals as any[]).map((p: any) => p.permission))];
    console.log('  Permissions held by Principal role:', distinctPerms.join(', '));
    const canScan = distinctPerms.includes('attendance:write') || distinctPerms.includes('attendance:write_all');
    const canRead = distinctPerms.includes('attendance:read');
    console.log('  Can call POST /api/attendance/gate/scan:', canScan ? 'PASS' : 'FAIL');
    console.log('  Can call GET  /api/attendance/gate     :', canRead  ? 'PASS' : 'FAIL');
  }

  console.log('\n=== END PREFLIGHT ===');
}

main().finally(() => process.exit(0));
