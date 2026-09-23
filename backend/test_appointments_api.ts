import { PrismaClient } from '@prisma/client';

async function main() {
  console.log("=== API TEST: BOTH DIRECTIONS ===");

  console.log("1. Teacher logging in...");
  const tLoginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@demo.com', password: 'password123' })
  });
  const tCookie = tLoginRes.headers.get('set-cookie') || '';
  
  console.log("2. Teacher creating appointment (teacher-to-parent) for demo-student-1...");
  const createRes = await fetch('http://localhost:4000/api/admin/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': tCookie },
    body: JSON.stringify({
      studentId: 'demo-student-1',
      date: '2026-10-15',
      time: '14:30',
      purpose: 'API Test: Behavior concern',
      direction: 'teacher-to-parent'
    })
  });
  const createData = await createRes.json();
  console.log("Create Response:", JSON.stringify(createData));

  console.log("\n3. Student logging in...");
  const sLoginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@demo.com', password: 'password123' })
  });
  const sCookie = sLoginRes.headers.get('set-cookie') || '';

  console.log("4. Student fetching their appointments...");
  const sApptRes = await fetch('http://localhost:4000/api/student-services/appointments/demo-student-1', {
    headers: { 'Cookie': sCookie }
  });
  const sApptData = await sApptRes.json();
  
  console.log("Found", sApptData.data?.length || 0, "appointments for Student.");
  const incomingFromTeacher = sApptData.data?.find((a: any) => a.purpose === 'API Test: Behavior concern');
  
  if (incomingFromTeacher) {
    console.log("SUCCESS! The teacher's request is successfully visible in the Student's appointment list.");
    console.log("Incoming request details:", JSON.stringify(incomingFromTeacher, null, 2));
  } else {
    console.log("FAILED to find the teacher's request in Student's appointments.");
  }
}

main();
