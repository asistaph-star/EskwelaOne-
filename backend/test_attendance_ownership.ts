import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:4000/api';

async function main() {
  console.log('Testing Attendance Ownership Constraint...');

  // 1. Get the current teacher (Ana R. Soriano)
  const teacherUser = await prisma.user.findFirst({
    where: { first_name: 'Ana', last_name: 'Soriano' }
  });
  if (!teacherUser) throw new Error("Teacher Ana not found");

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: teacherUser.email, password: 'password123' })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }
  const setCookie = loginRes.headers.get('set-cookie');
  const tokenMatch = setCookie?.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;
  console.log("Token received:", token ? "YES" : "NO");

  // 3. Find a class Ana does NOT teach.
  // First, find Ana's teacher profile
  const teacherProfile = await prisma.teacher.findUnique({ where: { user_id: teacherUser.id } });
  
  const assignmentNotOwned = await prisma.teacherSubjectAssignment.findFirst({
    where: {
      teacher_id: { not: teacherProfile!.id }
    },
    include: { teacher: { include: { user: true } }, section: true }
  });

  if (!assignmentNotOwned) {
    console.log("Could not find an assignment owned by another teacher. Let's create a fake one to test.");
    // We will create a dummy teacher and assignment just for this test
    const dummyUser = await prisma.user.create({
      data: { id: 'dummy-usr', email: 'dummy@test.com', password_hash: 'x', first_name: 'D', last_name: 'T' }
    });
    const dummyTeacher = await prisma.teacher.create({
      data: { id: 'dummy-tch', user_id: dummyUser.id, employee_id: 'D001' }
    });
    const year = await prisma.academicYear.findFirst({ where: { is_current: true } });
    const sec = await prisma.section.findFirst();
    const sub = await prisma.subject.findFirst();
    
    await prisma.teacherSubjectAssignment.create({
      data: {
        id: 'dummy-assign',
        academic_year_id: year!.id,
        teacher_id: dummyTeacher.id,
        section_id: sec!.id,
        subject_id: sub!.id
      }
    });
  }

  const targetClassId = assignmentNotOwned ? assignmentNotOwned.id : 'dummy-assign';
  console.log(`Attempting to submit attendance for class ${targetClassId} (owned by someone else)...`);

  try {
    const res = await fetch(`${API_BASE}/attendance/classes/${targetClassId}/records/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        records: [
          { studentEnrollmentId: 'some-id', date: '2025-06-10', status: 'P' }
        ]
      })
    });
    
    if (res.ok) {
        console.error("FAIL: The request succeeded but it should have failed!", await res.json());
    } else {
        console.log("SUCCESS: Request rejected as expected.");
        console.log(`Status Code: ${res.status}`);
        console.log(`Response Body:`, await res.json());
    }
  } catch (err: any) {
    console.error("Network or unexpected error:", err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
