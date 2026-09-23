import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.$queryRaw<any[]>`SELECT pg_get_constraintdef(c.oid) AS constraint_def FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE c.conname = 'chk_appointment_host' AND t.relname = 'appointments'`;
    console.log("Constraint Definition:", res);
    
    // Also let's try a proper INSERT that sets updated_at
    const teacher_id = 'demo-teacher-1';
    const staff_id = 'demo-guidance-1';
    const student_id = 'demo-student-1';
    
    await prisma.$executeRaw`
      INSERT INTO appointments (id, student_id, date, time, purpose, status, direction, updated_at, teacher_id, staff_id)
      VALUES (
        'violation-2',
        ${student_id},
        '2026-10-01',
        '14:00:00',
        'G1-GUIDANCE-TEST-2',
        'Pending',
        'teacher-to-parent',
        NOW(),
        ${teacher_id},
        ${staff_id}
      )
    `;
    console.log("INSERT succeeded unexpectedly.");
  } catch (e: any) {
    console.log("Error Caught:");
    console.log("Code:", e.code);
    console.log("Message:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
