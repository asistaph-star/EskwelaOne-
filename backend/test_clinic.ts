import prisma from './src/config/database.js';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

function getJwt(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '1h' });
}

async function main() {
  const fetchWithToken = async (path: string, token: string, options: RequestInit = {}) => {
    return fetch(`http://localhost:4000/api${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  };

  const nurse = await prisma.user.findFirst({
    where: { user_roles: { some: { role: { name: 'Nurse' } } } }
  });
  const student = await prisma.user.findFirst({
    where: { user_roles: { some: { role: { name: 'Student' } } } },
    include: { student: true }
  });

  if (!nurse || !student) throw new Error("Missing test users");

  const tokenNurse = getJwt(nurse.id);

  console.log("Submitting POST /student-services/clinic ...");
  const postRes = await fetchWithToken('/student-services/clinic', tokenNurse, {
    method: 'POST',
    body: JSON.stringify({
      studentId: student.student!.id,
      date: '2026-09-01',
      time: '14:30',
      symptoms: 'Headache, fever',
      diagnosis: 'Flu',
      temperature: 38.5
    })
  });
  
  if (postRes.status !== 201) {
    console.error("POST Failed:", await postRes.text());
    process.exit(1);
  }
  const postData = await postRes.json();
  console.log("POST Success. Saved record ID:", postData.data.id);
  console.log("Saved symptoms:", postData.data.symptoms);

  console.log("\nFetching GET /student-services/clinic/:studentId ...");
  const getRes = await fetchWithToken(`/student-services/clinic/${student.student!.id}`, tokenNurse);
  if (getRes.status !== 200) {
    console.error("GET Failed:", await getRes.text());
    process.exit(1);
  }
  const getData = await getRes.json();
  const record = getData.data.find((r: any) => r.id === postData.data.id);
  console.log("GET Success. Found record:", !!record);
  console.log("Retrieved symptoms:", record?.symptoms);
  
  process.exit(0);
}
main().catch(console.error);
