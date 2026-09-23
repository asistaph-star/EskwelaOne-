import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_INSECURE_DEV_SECRET';

async function main() {
  console.log("--- NEGATIVE TEST: CROSS-STUDENT ACCESS ---");
  
  // 1. Authenticate as demo-student-1
  const studentUser = await prisma.user.findUnique({ where: { email: 'student@demo.com' } });
  const token = jwt.sign({ userId: studentUser!.id, roles: ['Student'] }, JWT_SECRET, { expiresIn: '8h' });

  // 2. Dynamically find current academic year
  const currentYear = await prisma.academicYear.findFirst({ where: { is_current: true } });
  const ayId = currentYear!.id;

  // 3. Try to access a DIFFERENT student's history
  const otherStudentId = 'some-other-student-id-12345';
  console.log(`Authenticated as: demo-student-1`);
  console.log(`Attempting GET request to /api/enrollments/student/${otherStudentId}/history/${ayId}`);
  
  try {
    const res = await fetch(`http://localhost:4000/api/enrollments/student/${otherStudentId}/history/${ayId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await res.json();
    console.log(`HTTP Status: ${res.status}`);
    console.log("Response Data:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.log("Error from API:");
    console.log(err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
