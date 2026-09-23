import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("--- CONFIRMING ADMIN / PRINCIPAL LOGIN ---");
  
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  
  if (loginData.success && loginData.data.user.roles.includes('Admin')) {
     console.log("Admin login SUCCESS. Role: Admin");
  } else {
     console.log("Admin login FAILED.", loginData);
  }

  const loginRes2 = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'principal@demo.com', password: 'password123' })
  });
  const loginData2 = await loginRes2.json();
  
  if (loginData2.success && loginData2.data.user.roles.includes('Principal')) {
     console.log("Principal login SUCCESS. Role: Principal");
  } else {
     console.log("Principal login FAILED.", loginData2);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
