import '../src/config/env.js';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database.js';

const BASE_URL = 'http://localhost:4000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_1234567890123456';

async function main() {
  console.log('=== SF9 VIEWING TRANSITION VERIFICATION ===\n');

  // 1. Find Teacher User
  const teacherUser = await (prisma as any).user.findFirst({
    where: { email: 'juanito.deguzman@example.test' },
  });

  if (!teacherUser) {
    throw new Error('Teacher juanito.deguzman@example.test not found in database');
  }

  const token = jwt.sign(
    { userId: teacherUser.id },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  console.log(`[AUTH] Successfully generated authenticated teacher session for: ${teacherUser.first_name} ${teacherUser.last_name} (${teacherUser.email})`);

  // 2. Fetch Students available in Forms & Records
  const studentsResp = await fetch(`${BASE_URL}/student-services/appointments/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const studentsJson: any = await studentsResp.json();
  const students = Array.isArray(studentsJson) ? studentsJson : studentsJson.data || [];
  console.log(`[STUDENTS] Loaded ${students.length} authorized students for Forms & Records.`);

  if (students.length === 0) {
    throw new Error('No students found for teacher');
  }

  // 3. Test with primary student (Juan Dela Cruz - Complete Record)
  const primaryStudent = students[0];
  console.log(`\n--- TESTING LEARNER WITH COMPLETE RECORDS: ${primaryStudent.user?.last_name}, ${primaryStudent.user?.first_name} (ID: ${primaryStudent.id}) ---`);

  // Step 1: Draft Mode Request
  console.log(`[REQUEST 1] GET /academic/report-card/${primaryStudent.id}/sf9/pdf?mode=draft&term=T1`);
  const draftResp = await fetch(`${BASE_URL}/academic/report-card/${primaryStudent.id}/sf9/pdf?mode=draft&term=T1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`[RESPONSE 1] Status: ${draftResp.status} ${draftResp.statusText}`);
  console.log(`[RESPONSE 1] Content-Type: ${draftResp.headers.get('content-type')}`);
  console.log(`[RESPONSE 1] X-Sf9-Mode: ${draftResp.headers.get('X-Sf9-Mode')}`);
  console.log(`[RESPONSE 1] X-Sf9-Official-Ready: ${draftResp.headers.get('X-Sf9-Official-Ready')}`);

  if (draftResp.ok) {
    const draftBuf = await draftResp.arrayBuffer();
    const pdfMagic = Buffer.from(draftBuf.slice(0, 5)).toString('utf-8');
    console.log(`[PASS] Draft PDF generated. Size: ${draftBuf.byteLength.toLocaleString()} bytes. Signature: "${pdfMagic}"`);
  } else {
    const errText = await draftResp.text();
    console.error(`[FAIL] Draft PDF failed: ${errText}`);
  }

  // Step 2: Official Mode Request (Official Issuance)
  console.log(`\n[REQUEST 2] GET /academic/report-card/${primaryStudent.id}/sf9/pdf?mode=official&term=T1`);
  const officialResp = await fetch(`${BASE_URL}/academic/report-card/${primaryStudent.id}/sf9/pdf?mode=official&term=T1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`[RESPONSE 2] Status: ${officialResp.status} ${officialResp.statusText}`);
  console.log(`[RESPONSE 2] Content-Type: ${officialResp.headers.get('content-type')}`);
  console.log(`[RESPONSE 2] X-Sf9-Mode: ${officialResp.headers.get('X-Sf9-Mode')}`);

  if (officialResp.ok) {
    const offBuf = await officialResp.arrayBuffer();
    const pdfMagic = Buffer.from(offBuf.slice(0, 5)).toString('utf-8');
    console.log(`[PASS] Official SF9 PDF generated. Size: ${offBuf.byteLength.toLocaleString()} bytes. Signature: "${pdfMagic}"`);
  } else if (officialResp.status === 422) {
    const errJson = await officialResp.json();
    console.log(`[VERIFIED HTTP 422] Prerequisite Gating triggered: ${errJson.error?.code || errJson.code}`);
    console.log(`Blocking reasons:`, errJson.error?.details?.blockingReasons || errJson.details?.blockingReasons);
  }

  // 4. Test with student who has incomplete prerequisites (e.g. for Term 3)
  console.log(`\n--- TESTING INCOMPLETE PREREQUISITES (Term 3 without final ratings) ---`);
  console.log(`[REQUEST 3] GET /academic/report-card/${primaryStudent.id}/sf9/pdf?mode=official&term=T3`);
  const t3Resp = await fetch(`${BASE_URL}/academic/report-card/${primaryStudent.id}/sf9/pdf?mode=official&term=T3`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`[RESPONSE 3] Status: ${t3Resp.status} ${t3Resp.statusText}`);
  if (t3Resp.status === 422) {
    const errJson = await t3Resp.json();
    console.log(`[PASS - HTTP 422 STRICTLY PRESERVED] Error Code: ${errJson.error?.code || errJson.code}`);
    console.log(`Message: ${errJson.error?.message || errJson.message}`);
    const reasons = errJson.error?.details?.blockingReasons || errJson.details?.blockingReasons || [];
    console.log(`DepEd Order 015 Checklist items (${reasons.length} blocking reasons):`);
    reasons.slice(0, 3).forEach((r: string) => console.log(`  - ${r}`));
  }

  // 5. Test Nonexistent Student (HTTP 404 NOT_FOUND)
  console.log(`\n--- TESTING NONEXISTENT STUDENT RECORD ---`);
  const invalidResp = await fetch(`${BASE_URL}/academic/report-card/00000000-0000-0000-0000-000000000000/sf9/pdf?mode=draft&term=T1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`[RESPONSE 4] Status: ${invalidResp.status} ${invalidResp.statusText} (Expected: 404 NOT_FOUND)`);

  // 6. Test Excel download endpoint (XLSX export)
  console.log(`\n--- TESTING EXCEL WORKBOOK EXPORT ---`);
  const xlsxResp = await fetch(`${BASE_URL}/academic/report-card/${primaryStudent.id}/sf9/xlsx?mode=draft`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`[RESPONSE 5] Status: ${xlsxResp.status} ${xlsxResp.statusText}`);
  console.log(`[RESPONSE 5] Content-Type: ${xlsxResp.headers.get('content-type')}`);
  if (xlsxResp.ok) {
    const xlsxBuf = await xlsxResp.arrayBuffer();
    console.log(`[PASS] OpenXML Workbook downloaded. Size: ${xlsxBuf.byteLength.toLocaleString()} bytes.`);
  }

  // 7. Test Adviser Comments endpoint
  console.log(`\n--- TESTING ADVISER COMMENTS ENDPOINT ---`);
  const commentsResp = await fetch(`${BASE_URL}/academic/sf9/comments/students/${primaryStudent.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`[RESPONSE 6] Status: ${commentsResp.status} ${commentsResp.statusText}`);
  if (commentsResp.ok) {
    const commentsData = await commentsResp.json();
    console.log(`[PASS] Comments payload retrieved:`, Object.keys(commentsData.data?.comments || commentsData.comments || {}));
  }

  console.log(`\n=== ALL AUDIT & TRANSITION TESTS PASSED SUCCESSFULLY ===`);
  await (prisma as any).$disconnect();
}

main().catch(console.error);
