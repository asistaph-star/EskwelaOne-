import prisma from './src/config/database.js';
import jwt from 'jsonwebtoken';
import { config } from './src/config/env.js';

async function main() {
  console.log('--- STARTING PHASE N1 VERIFICATION ---');
  const API_URL = 'http://localhost:4000/api';

  function getJwt(userId: string) {
    return jwt.sign({ userId }, config.jwt.secret, { expiresIn: '1h' });
  }

  // Get test users
  const studentA = await prisma.user.findFirst({ where: { user_roles: { some: { role: { name: 'Student' } } } }, include: { student: true } });
  let studentB = await prisma.user.findFirst({ where: { id: { not: studentA?.id }, user_roles: { some: { role: { name: 'Student' } } } }, include: { student: true } });
  
  if (!studentB) {
    // Create fallback Student B
    const studentRole = await prisma.role.findUnique({ where: { name: 'Student' } });
    if (studentRole) {
      const u = await prisma.user.upsert({
        where: { email: 'studentb@digiskwela.test' },
        update: {},
        create: {
          id: 'mock-studentb-id',
          email: 'studentb@digiskwela.test',
          password_hash: 'mock',
          first_name: 'Student',
          last_name: 'B',
          status: 'active',
          user_roles: { create: { role_id: studentRole.id } }
        }
      });
      const s = await prisma.student.upsert({
        where: { id: 'mock-studentb-profile-id' },
        update: {},
        create: {
          id: 'mock-studentb-profile-id',
          user_id: u.id,
          lrn: '000000000000',
          grade_level: 1
        }
      });
      studentB = { ...u, student: s } as any;
    }
  }

  let nurse = await prisma.user.findFirst({ where: { user_roles: { some: { role: { name: 'Nurse' } } } } });

  if (!nurse) {
    const nurseRole = await prisma.role.findUnique({ where: { name: 'Nurse' } });
    if (nurseRole) {
      nurse = await prisma.user.upsert({
        where: { email: 'nurse@digiskwela.test' },
        update: {},
        create: {
          id: 'mock-nurse-id',
          email: 'nurse@digiskwela.test',
          password_hash: 'mock',
          first_name: 'Test',
          last_name: 'Nurse',
          status: 'active',
          user_roles: { create: { role_id: nurseRole.id } }
        }
      });
    }
  }

  if (!studentA || !studentB || !nurse) {
    console.error('Missing required test users.');
    console.error(`studentA: ${!!studentA}, studentB: ${!!studentB}, nurse: ${!!nurse}`);
    process.exit(1);
  }

  const tokenNurse = getJwt(nurse.id);
  const tokenStudentA = getJwt(studentA.id);

  async function fetchWithToken(path: string, token: string, options: any = {}) {
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  }

  let passed = 0;
  let failed = 0;

  async function check(name: string, p: Promise<any>, expectStatus: number) {
    try {
      const res = await p;
      if (res.status === expectStatus) {
        console.log(`✅ PASS: ${name}`);
        passed++;
        return res;
      } else {
        const body = await res.text();
        console.error(`❌ FAIL: ${name} (Expected ${expectStatus}, got ${res.status}: ${body})`);
        failed++;
        return null;
      }
    } catch (err: any) {
      console.error(`❌ ERROR: ${name} (${err.message})`);
      failed++;
      return null;
    }
  }

  // 1. Zod Validation Rejection (Malformed Input)
  await check('1. POST /clinic malformed input rejected', fetchWithToken('/student-services/clinic', tokenNurse, {
    method: 'POST',
    body: JSON.stringify({
      studentId: studentA.student!.id,
      date: 'invalid-date', // malformed
      time: '12:00'
    })
  }), 422);

  // 2. Successful POST /clinic
  const postRes = await check('2. POST /clinic successful (N1-CLINIC-VERIFY)', fetchWithToken('/student-services/clinic', tokenNurse, {
    method: 'POST',
    body: JSON.stringify({
      studentId: studentA.student!.id,
      date: '2025-06-10',
      time: '09:00',
      symptoms: 'N1-CLINIC-VERIFY: Headache',
      diagnosis: 'N1-CLINIC-VERIFY: Tension Headache',
      medications: 'N1-CLINIC-VERIFY: Paracetamol',
      treatments: 'N1-CLINIC-VERIFY: Rest',
      notes: 'N1-CLINIC-VERIFY: Note',
      temperature: 37.5,
      bloodPressure: '120/80',
      heartRate: '80',
      recorded_by: 'malicious-spoof-id' // Testing mass assignment
    })
  }), 201);

  if (!postRes) process.exit(1);
  const createdRecord = (await postRes.json()).data;
  
  if (createdRecord.recorded_by === 'malicious-spoof-id') {
    console.error('❌ FAIL: Mass Assignment Vulnerability! recorded_by was spoofed.');
    failed++;
  } else if (createdRecord.recorded_by === nurse.id) {
    console.log('✅ PASS: Mass Assignment Prevented. recorded_by matches session Nurse ID.');
    passed++;
  } else {
    console.error('❌ FAIL: Mass Assignment check failed unexpectedly.');
    failed++;
  }

  const recordId = createdRecord.id;

  // 3. PostgreSQL Raw Ciphertext Check (Bypass Prisma Decryption)
  console.log('\n--- 3. DATABASE VERIFICATION (CIPHERTEXT) ---');
  // @ts-ignore
  const rawRows = await prisma.$queryRaw`SELECT * FROM "clinic_referrals" WHERE "id" = ${recordId}`;
  const rawRecord = rawRows[0];
  if (!rawRecord) {
    console.error('❌ FAIL: Database record not found via Raw Query.');
    failed++;
  } else {
    const isEncrypted = (val: string) => val && !val.includes('N1-CLINIC-VERIFY') && val.length > 50;
    if (isEncrypted(rawRecord.symptoms) && isEncrypted(rawRecord.diagnosis) && isEncrypted(rawRecord.medications) && isEncrypted(rawRecord.treatments) && isEncrypted(rawRecord.notes)) {
      console.log('✅ PASS: Sensitive fields are properly encrypted in the database at rest.');
      passed++;
    } else {
      console.error('❌ FAIL: Sensitive fields are stored in plaintext!');
      console.log('Raw symptoms:', rawRecord.symptoms);
      failed++;
    }
  }

  // 4. API GET /clinic (Global Limit 100)
  const getRes = await check('4. GET /clinic global endpoint', fetchWithToken('/student-services/clinic', tokenNurse), 200);
  if (getRes) {
    const list = (await getRes.json()).data;
    if (Array.isArray(list) && list.length <= 100) {
      console.log(`✅ PASS: GET /clinic returned ${list.length} records (<= 100)`);
      passed++;
      const found = list.find((r: any) => r.id === recordId);
      if (found && found.symptoms.includes('N1-CLINIC-VERIFY')) {
        console.log('✅ PASS: Application successfully decrypted the fields for the API response.');
        passed++;
      } else {
        console.error('❌ FAIL: Created record not found in GET /clinic or decryption failed.');
        failed++;
      }
    } else {
      console.error('❌ FAIL: GET /clinic response format invalid or exceeds 100.');
      failed++;
    }
  }

  // 5. API GET /clinic/:studentId Authorized (Nurse)
  await check('5. GET /clinic/:studentId authorized (Nurse)', fetchWithToken(`/student-services/clinic/${studentA.student!.id}`, tokenNurse), 200);

  // 6. API GET /clinic/:studentId Unauthorized (Student accessing another student's record)
  // First we need to temporarily give the Student clinic:read permission to test the ID-tampering fallback
  const clinicPerm = await prisma.permission.findFirst({ where: { key: 'clinic:read' } });
  const studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
  let permAdded = false;
  if (clinicPerm && studentRole) {
    try {
      await prisma.rolePermission.create({ data: { role_id: studentRole.id, permission_id: clinicPerm.id } });
      permAdded = true;
    } catch(e) {} // might already exist
  }
  
  await check('6. GET /clinic/:studentId unauthorized (Student tampering)', fetchWithToken(`/student-services/clinic/${studentB.student!.id}`, tokenStudentA), 403);
  
  if (permAdded && clinicPerm && studentRole) {
    await prisma.rolePermission.delete({ where: { role_id_permission_id: { role_id: studentRole.id, permission_id: clinicPerm.id } } });
  }

  // 7. Cleanup
  console.log('\n--- 7. CLEANUP ---');
  await prisma.clinicReferral.delete({ where: { id: recordId } });
  
  // @ts-ignore
  const checkRawRows = await prisma.$queryRaw`SELECT * FROM "clinic_referrals" WHERE "id" = ${recordId}`;
  if (checkRawRows.length === 0) {
    console.log('✅ PASS: Test artifact successfully deleted.');
    passed++;
  } else {
    console.error('❌ FAIL: Test artifact still exists in the database.');
    failed++;
  }

  console.log(`\n=== RESULTS ===\nPassed: ${passed}\nFailed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Test Execution Failed:', e);
  process.exit(1);
});
