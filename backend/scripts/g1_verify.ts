import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/common/utils/uuid.js';
import appPrisma from '../src/config/database.js';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
const API_URL = 'http://localhost:4000/api';

async function login(email: string, role: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' })
  });
  if (!res.ok) throw new Error(`Login failed for ${email}`);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error(`No cookie for ${email}`);
  const match = setCookie.match(/auth_token=([^;]+)/);
  if (!match) throw new Error(`No auth_token for ${email}`);
  return match[1];
}

async function run() {
  console.log('--- STARTING G1 VERIFICATION ---');

  // 1. Get Tokens
  const guidanceToken = await login('guidance@demo.com', 'Guidance');
  const teacherToken = await login('teacher@demo.com', 'Teacher');
  const studentToken = await login('student@demo.com', 'Student');
  console.log('[x] Tokens retrieved.');

  const guidanceUser = await prisma.user.findUnique({ where: { email: 'guidance@demo.com' } });
  const studentUser = await prisma.user.findUnique({ where: { email: 'student@demo.com' } });
  const teacherUser = await prisma.user.findUnique({ where: { email: 'teacher@demo.com' } });
  const student = await prisma.student.findUnique({ where: { user_id: studentUser!.id } });
  const teacher = await prisma.teacher.findUnique({ where: { user_id: teacherUser!.id } });
  const staff = await prisma.staff.findUnique({ where: { user_id: guidanceUser!.id } });

  // 2. Remove Temporary Data
  console.log('\n--- CLEANING UP TEMPORARY DATA ---');
  await prisma.behaviorLog.deleteMany({ where: { note: { contains: 'G1-GUIDANCE' } } });
  await prisma.guidanceRecord.deleteMany({ where: { reason: { contains: 'G1-GUIDANCE' } } });
  await prisma.appointment.deleteMany({ where: { purpose: { contains: 'G1-GUIDANCE' } } });
  console.log('[x] Cleanup complete.');

  // 3. Database Ciphertext Verification
  console.log('\n--- DATABASE CIPHERTEXT VERIFICATION ---');
  const testGuidanceId = generateId();
  await appPrisma.guidanceRecord.create({
    data: {
      id: testGuidanceId,
      student_id: student!.id,
      counselor_id: guidanceUser!.id,
      date: new Date(),
      type: 'Counseling',
      reason: 'G1-GUIDANCE-CIPHERTEXT-TEST: Plaintext Reason',
      notes: 'G1-GUIDANCE-CIPHERTEXT-TEST: Plaintext Notes',
      action_taken: 'G1-GUIDANCE-CIPHERTEXT-TEST: Plaintext Action',
    }
  });

  const rawGuidance = await prisma.$queryRaw<any[]>`SELECT reason, notes, action_taken FROM guidance_records WHERE id = ${testGuidanceId}`;
  console.log('Raw DB Value (reason):', rawGuidance[0].reason.substring(0, 50) + '...');
  console.log('Raw DB Value (notes):', rawGuidance[0].notes.substring(0, 50) + '...');
  
  const appPrismaGuidance = await appPrisma.guidanceRecord.findUnique({ where: { id: testGuidanceId } });
  console.log('App Prisma Value (reason):', appPrismaGuidance!.reason);
  console.log('Ciphertext Verified:', rawGuidance[0].reason !== appPrismaGuidance!.reason);

  // 4. Guidance Appointment DB Verification
  console.log('\n--- APPOINTMENT HOST VERIFICATION ---');
  const testApptId = generateId();
  await prisma.appointment.create({
    data: {
      id: testApptId,
      student_id: student!.id,
      staff_id: staff!.id,
      date: new Date('2026-10-01'),
      time: new Date('1970-01-01T14:00:00Z'),
      purpose: 'G1-GUIDANCE-APPOINTMENT-VERIFY',
      status: 'Pending',
      direction: 'teacher-to-parent',
    }
  });

  const rawAppt = await prisma.$queryRaw<any[]>`SELECT teacher_id, staff_id FROM appointments WHERE id = ${testApptId}`;
  console.log('New Staff Appointment (teacher_id, staff_id):', rawAppt[0].teacher_id, rawAppt[0].staff_id);
  
  const oldTeacherAppt = await prisma.$queryRaw<any[]>`SELECT id, teacher_id, staff_id FROM appointments WHERE teacher_id IS NOT NULL LIMIT 1`;
  if (oldTeacherAppt.length > 0) {
    console.log('Existing Teacher Appt (teacher_id, staff_id):', oldTeacherAppt[0].teacher_id, oldTeacherAppt[0].staff_id);
  }

  try {
    // Attempt violation
    await prisma.$executeRaw`INSERT INTO appointments (id, student_id, date, time, purpose, direction, teacher_id, staff_id) VALUES ('violation-1', ${student!.id}, '2026-10-01', '14:00', 'G1-GUIDANCE', 'teacher-to-parent', ${teacher!.id}, ${staff!.id})`;
    console.log('Constraint Violation Failed: INSERT succeeded unexpectedly');
  } catch (e: any) {
    console.log('Constraint Violation Caught Successfully:', e.message.substring(0, 100));
  }

  // 5. Guidance API Verification
  console.log('\n--- GUIDANCE API VERIFICATION ---');
  // POST Behavior
  const resBehavior = await fetch(`${API_URL}/student-services/behavior`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': `auth_token=${guidanceToken}` },
    body: JSON.stringify({
      studentId: student!.id,
      type: 'Misconduct',
      date: new Date().toISOString(),
      note: 'G1-GUIDANCE-API-VERIFY',
      reported_by: teacherUser!.id // SPOOF ATTEMPT
    })
  });
  const behaviorData = await resBehavior.json();
  console.log('POST /behavior (spoof attempt) status:', resBehavior.status);
  console.log('Spoof defended? (reporter == guidance):', behaviorData.data.reported_by === guidanceUser!.id);

  // PATCH Behavior
  const patchBehavior = await fetch(`${API_URL}/student-services/behavior/${behaviorData.data.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': `auth_token=${guidanceToken}` },
    body: JSON.stringify({ status: 'Resolved' })
  });
  console.log('PATCH /behavior/:id status:', patchBehavior.status);

  // GET Behavior
  const getBehavior = await fetch(`${API_URL}/student-services/behavior/${student!.id}`, {
    headers: { 'Cookie': `auth_token=${guidanceToken}` }
  });
  console.log('GET /behavior/:studentId status:', getBehavior.status);

  // POST Appointment
  const postAppt = await fetch(`${API_URL}/student-services/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': `auth_token=${guidanceToken}` },
    body: JSON.stringify({
      studentId: student!.id,
      date: '2026-10-05',
      time: '10:00',
      purpose: 'G1-GUIDANCE-API-VERIFY',
    })
  });
  const apptData = await postAppt.json();
  console.log('POST /appointments status:', postAppt.status);
  console.log('Staff ID assigned?', apptData.data.staff_id === staff!.id);
  console.log('Teacher ID is NULL?', apptData.data.teacher_id === null);

  // GET Appointments
  const getAppt = await fetch(`${API_URL}/student-services/appointments/me`, {
    headers: { 'Cookie': `auth_token=${guidanceToken}` }
  });
  const apptsList = await getAppt.json();
  console.log('GET /appointments/me (Guidance) count:', apptsList.data?.length);

  // 6. Security Tests (Regression & Tampering)
  console.log('\n--- SECURITY & REGRESSION VERIFICATION ---');
  
  // Student trying to read Guidance Dashboard
  const studentGuidance = await fetch(`${API_URL}/student-services/guidance`, {
    headers: { 'Cookie': `auth_token=${studentToken}` }
  });
  console.log('Student GET /guidance status:', studentGuidance.status);

  // Teacher reading their appointments
  const teacherAppt = await fetch(`${API_URL}/student-services/appointments/me`, {
    headers: { 'Cookie': `auth_token=${teacherToken}` }
  });
  const teacherApptsList = await teacherAppt.json();
  console.log('Teacher GET /appointments/me status:', teacherAppt.status);
  console.log('Teacher appointment correctly has teacher_id?', teacherApptsList.data.length > 0 ? teacherApptsList.data[0].teacher_id !== null : 'No data');

  // Teacher trying to update Guidance's appointment
  const tamperAppt = await fetch(`${API_URL}/student-services/appointments/${apptData.data.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': `auth_token=${teacherToken}` },
    body: JSON.stringify({ status: 'Confirmed' })
  });
  console.log('Teacher updating Guidance appointment status:', tamperAppt.status);

  // 7. Cleanup
  console.log('\n--- FINAL CLEANUP ---');
  const d1 = await prisma.behaviorLog.deleteMany({ where: { note: { contains: 'G1-GUIDANCE' } } });
  const d2 = await prisma.guidanceRecord.deleteMany({ where: { reason: { contains: 'G1-GUIDANCE' } } });
  const d3 = await prisma.appointment.deleteMany({ where: { purpose: { contains: 'G1-GUIDANCE' } } });
  console.log(`Deleted ${d1.count} behaviors, ${d2.count} guidance records, ${d3.count} appointments.`);

  console.log('--- DONE ---');
}

run().catch(console.error).finally(() => prisma.$disconnect());
