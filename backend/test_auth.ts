import prisma from './src/config/database.js';
import jwt from 'jsonwebtoken';
import { config } from './src/config/env.js';

// Use standard Node.js fetch (Node 18+)

async function main() {
  console.log('Starting Row-Level Auth Tests...');
  const API_URL = 'http://localhost:4000/api';

  // Helper to generate a valid JWT for any user ID
  function getJwt(userId: string) {
    return jwt.sign({ userId }, config.jwt.secret, { expiresIn: '1h' });
  }

  // 1. Gather test users
  const studentA = await prisma.user.findFirst({ where: { user_roles: { some: { role: { name: 'Student' } } } }, include: { student: true } });
  const studentB = await prisma.user.findFirst({ where: { id: { not: studentA!.id }, user_roles: { some: { role: { name: 'Student' } } } }, include: { student: true } });
  
  const teacherA = await prisma.user.findFirst({ where: { user_roles: { some: { role: { name: 'Teacher' } } } }, include: { teacher: { include: { assignments: { include: { section: true } } } } } });
  const teacherB = await prisma.user.findFirst({ where: { id: { not: teacherA!.id }, user_roles: { some: { role: { name: 'Teacher' } } } }, include: { teacher: { include: { assignments: true } } } });

  let nurse = await prisma.user.findFirst({ where: { user_roles: { some: { role: { name: 'Nurse' } } } } });
  
  if (!nurse) {
    console.log('No Nurse found in seed. Creating a temporary Nurse user for testing...');
    const nurseRole = await prisma.role.findUnique({ where: { name: 'Nurse' } });
    if (!nurseRole) throw new Error("Nurse role doesn't even exist in DB");
    
    nurse = await prisma.user.create({
      data: {
        id: 'mock-nurse-id',
        email: 'nurse@digiskwela.test',
        password_hash: 'mock',
        first_name: 'Test',
        last_name: 'Nurse',
        user_roles: {
          create: { role_id: nurseRole.id }
        }
      }
    });
  }

  if (!studentA || !studentB || !teacherA || !teacherB || !nurse) {
    console.error('Missing required test users. Check seed data.');
    console.error(`studentA: ${!!studentA}, studentB: ${!!studentB}, teacherA: ${!!teacherA}, teacherB: ${!!teacherB}, nurse: ${!!nurse}`);
    process.exit(1);
  }

  const tokenStudentA = getJwt(studentA.id);
  const tokenNurse = getJwt(nurse.id);
  const tokenTeacherA = getJwt(teacherA.id);

  let passed = 0;
  let failed = 0;

  async function check(name: string, p: Promise<any>, expectStatus: number) {
    try {
      const res = await p;
      if (res.status === expectStatus) {
        console.log(`✅ PASS: ${name} (Expected ${expectStatus}, got ${res.status})`);
        passed++;
      } else {
        const body = await res.text();
        console.error(`❌ FAIL: ${name} (Expected ${expectStatus}, got ${res.status}) - ${body}`);
        failed++;
      }
    } catch (e: any) {
      console.error(`❌ ERROR: ${name} - ${e.message}`);
      failed++;
    }
  }

  const fetchWithToken = (path: string, token: string, options: any = {}) => {
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  };

  // --- SELF-ONLY CHECKS ---
  await check('1. Student A gets Student B gate', fetchWithToken(`/attendance/gate/${studentB.student!.id}`, tokenStudentA), 403);
  await check('2. Student A gets Student B class', fetchWithToken(`/attendance/class/${studentB.student!.id}`, tokenStudentA), 403);
  await check('3. Student A gets Student B excuses', fetchWithToken(`/attendance/excuses/${studentB.student!.id}`, tokenStudentA), 403);
  await check('4. Student A gets Student B appts', fetchWithToken(`/student-services/appointments/${studentB.student!.id}`, tokenStudentA), 403);
  await check('5. Student A gets Student B docs', fetchWithToken(`/student-services/doc-requests/${studentB.student!.id}`, tokenStudentA), 403);
  
  await check('6a. Student A gets OWN gate', fetchWithToken(`/attendance/gate/${studentA.student!.id}`, tokenStudentA), 200);
  await check('6b. Student A gets OWN appts', fetchWithToken(`/student-services/appointments/${studentA.student!.id}`, tokenStudentA), 200);

  // --- CLINIC ISOLATION ---
  await check('7. Nurse gets Clinic', fetchWithToken(`/student-services/clinic/${studentA.student!.id}`, tokenNurse), 200);
  
  // Actually test #8 (Student with clinic:read permission)
  const clinicPerm = await prisma.permission.findFirst({ where: { key: 'clinic:read' } });
  const studentRole = await prisma.role.findFirst({ where: { name: 'Student' } });
  if (clinicPerm && studentRole) {
    // Grant the permission
    await prisma.rolePermission.create({
      data: { role_id: studentRole.id, permission_id: clinicPerm.id }
    });
    
    // Now student A theoretically holds 'clinic:read' via their role
    // But the self-only fallback should still block them from seeing Student B's records
    await check('8. Student A with clinic:read gets Student B clinic (Expected 403 fallback)', 
      fetchWithToken(`/student-services/clinic/${studentB.student!.id}`, tokenStudentA), 403);
      
    // Cleanup the permission
    await prisma.rolePermission.delete({
      where: { role_id_permission_id: { role_id: studentRole.id, permission_id: clinicPerm.id } }
    });
  } else {
    console.error('Could not find clinic:read or Student role to test #8');
    failed++;
  }

  // --- FORCED STUDENT ID ---
  // We'll create an appointment specifying Student B's ID, but logged in as Student A
  const apptRes = await fetchWithToken('/student-services/appointments', tokenStudentA, {
    method: 'POST',
    body: JSON.stringify({
      studentId: studentB.student!.id, // Trying to spoof!
      teacherId: teacherA.teacher!.id,
      date: '2027-01-01',
      time: '10:00',
      purpose: 'Spoof Test',
      parentEmail: 'test@example.com'
    })
  });
  
  if (apptRes.status === 201) {
    const data = await apptRes.json();
    if (data.data.student_id === studentA.student!.id) {
      console.log(`✅ PASS: 9. POST /appointments spoof prevented (saved as own)`);
      passed++;
    } else {
      console.error(`❌ FAIL: 9. POST /appointments spoof succeeded! Saved as ${data.data.student_id}`);
      failed++;
    }
  } else {
    const body = await apptRes.text();
    console.error(`❌ FAIL: 9. POST /appointments returned ${apptRes.status} - ${body}`);
    failed++;
  }

  // Also test doc-requests spoofing
  const docReqRes = await fetchWithToken('/student-services/doc-requests', tokenStudentA, {
    method: 'POST',
    body: JSON.stringify({
      studentId: studentB.student!.id, // Trying to spoof!
      documentType: 'Form 137',
      purpose: 'Spoof Test',
    })
  });
  
  if (docReqRes.status === 201) {
    const data = await docReqRes.json();
    if (data.data.student_id === studentA.student!.id) {
      console.log(`✅ PASS: 10. POST /doc-requests spoof prevented (saved as own)`);
      passed++;
    } else {
      console.error(`❌ FAIL: 10. POST /doc-requests spoof succeeded! Saved as ${data.data.student_id}`);
      failed++;
    }
  } else {
    const body = await docReqRes.text();
    console.error(`❌ FAIL: 10. POST /doc-requests returned ${docReqRes.status} - ${body}`);
    failed++;
  }

  // --- GRADEBOOK OWNERSHIP ---
  const tA_Assignment = teacherA.teacher!.assignments[0];
  const tB_Assignment = teacherB.teacher!.assignments[0];

  if (!tA_Assignment || !tB_Assignment) {
    console.log('Skipping Gradebook tests - missing assignments in seed');
  } else {
    await check('11. Teacher A saves ledger for Teacher B class', fetchWithToken(`/gradebooks/ledger`, tokenTeacherA, {
      method: 'POST',
      body: JSON.stringify({ classId: tB_Assignment.id, terms: {} })
    }), 403);

    await check('12. Teacher A saves ledger for OWN class', fetchWithToken(`/gradebooks/ledger`, tokenTeacherA, {
      method: 'POST',
      body: JSON.stringify({ classId: tA_Assignment.id, terms: {} })
    }), 200);

    const term = 'T1';
    // Let's use the academic year from the assignment
    const academicYear = await prisma.academicYear.findUnique({ where: { id: tA_Assignment.academic_year_id }});
    const schoolYear = academicYear ? academicYear.name : '2024-2025';

    await check('13a. Teacher A gets grades for Teacher B section', fetchWithToken(`/gradebooks/grades?sectionId=${tB_Assignment.section_id}&subjectId=${tB_Assignment.subject_id}&term=${term}&schoolYear=${schoolYear}`, tokenTeacherA), 403);
    await check('13b. Teacher A gets grades for OWN section', fetchWithToken(`/gradebooks/grades?sectionId=${tA_Assignment.section_id}&subjectId=${tA_Assignment.subject_id}&term=${term}&schoolYear=${schoolYear}`, tokenTeacherA), 200);
  }

  // --- SECTION ENROLLMENTS ---
  const sectionId = tA_Assignment ? tA_Assignment.section_id : 'any';
  await check('14. Student gets section enrollments', fetchWithToken(`/academic/sections/${sectionId}/enrollments`, tokenStudentA), 403);
  if (tA_Assignment) {
    await check('15. Teacher gets assigned section enrollments', fetchWithToken(`/academic/sections/${sectionId}/enrollments`, tokenTeacherA), 200);
    const tokenTeacherB = getJwt(teacherB.id);
    await check('16. Teacher gets unassigned section enrollments', fetchWithToken(`/academic/sections/${sectionId}/enrollments`, tokenTeacherB), 403);
  }

  // --- DOCUMENT DOWNLOAD ---
  // Create a doc request for Student B
  const docReqB = await prisma.documentRequest.create({
    data: {
      id: 'mock-doc-req-b',
      student_id: studentB.student!.id,
      document_type: 'Form 137',
      purpose: 'Transfer',
      status: 'Submitted'
    }
  });
  
  const docB = await prisma.document.create({
    data: {
      id: 'mock-doc-b',
      storage_key: 'test/path.pdf',
      filename: 'path.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1024,
      uploaded_by: studentB.id
    }
  });

  await prisma.documentRequest.update({
    where: { id: 'mock-doc-req-b' },
    data: { attached_document_id: 'mock-doc-b' }
  });

  await check('17. Student A presigns Student B doc', fetchWithToken(`/documents/mock-doc-b/presign-download`, tokenStudentA, { method: 'POST' }), 403);

  // Cleanup mocks
  await prisma.documentRequest.delete({ where: { id: 'mock-doc-req-b' } });
  await prisma.document.delete({ where: { id: 'mock-doc-b' } });

  // --- MASS ENUMERATION FIX ---
  await check('18. Student gets users (role=Teacher bypass)', fetchWithToken(`/users?role=Teacher`, tokenStudentA), 403);

  // --- AUDIT LOGS ---
  // We'll just verify some audit logs exist for the spoofed appointment
  const logs = await prisma.auditLog.findMany({ where: { actor_user_id: studentA.id, action: 'APPOINTMENT_CREATED' }});
  if (logs.length > 0) {
    console.log(`✅ PASS: 19. Audit log found for Appointment Creation`);
    passed++;
  } else {
    console.error(`❌ FAIL: 19. No audit log found for Appointment Creation`);
    failed++;
  }

  console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
