import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("=== STEP 1: RAW DATABASE RECORD ===");
  const student = await prisma.student.findFirst({ where: { user_id: 'demo-student-1' } });
  if (!student) {
    console.log("Student demo-student-1 not found.");
  } else {
    const appts = await prisma.appointment.findMany({ 
      where: { student_id: student.id },
      orderBy: { created_at: 'desc' }
    });
    console.log("Found", appts.length, "appointments for demo student.");
    if (appts.length > 0) {
      console.log(JSON.stringify(appts[0], null, 2));
    }
  }

  console.log("\n=== STEP 3: TESTING TEACHER API ENDPOINT ===");
  console.log("Authenticating as teacher@demo.com...");
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@demo.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  
  if (loginData.success) {
    let setCookieHeader = loginRes.headers.get('set-cookie') || '';
    console.log("Successfully logged in. Extracting cookie...");

    console.log("\nFetching /api/admin/appointments/me ...");
    const apptRes = await fetch('http://localhost:4000/api/admin/appointments/me', {
      headers: { 'Cookie': setCookieHeader }
    });
    
    if (apptRes.status !== 200) {
      console.log(`Failed to fetch. Status: ${apptRes.status}`);
      console.log(await apptRes.text());
    } else {
      const apptData = await apptRes.json();
      console.log("RAW RESPONSE:");
      console.log(JSON.stringify(apptData, null, 2));
    }
  } else {
    console.log("Failed to login as teacher.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
