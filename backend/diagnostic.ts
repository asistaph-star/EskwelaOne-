import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_INSECURE_DEV_SECRET';

async function main() {
  console.log("--- RE-VERIFYING API CALL RESPONSE ---");
  
  const studentUser = await prisma.user.findUnique({ where: { email: 'student@demo.com' } });
  const token = jwt.sign({ userId: studentUser!.id }, JWT_SECRET, { expiresIn: '8h' });

  // Find the actual student profile ID
  const studentProfile = await prisma.student.findUnique({ where: { user_id: studentUser!.id } });
  const studentId = studentProfile!.id;
  
  // Dynamically find current academic year
  const currentYear = await prisma.academicYear.findFirst({ where: { is_current: true } });
  const ayId = currentYear!.id;

  console.log(`Making GET request to /api/enrollments/student/${studentId}/history/${ayId}`);
  
  try {
    const res = await fetch(`http://localhost:4000/api/enrollments/student/${studentId}/history/${ayId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await res.json();
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
