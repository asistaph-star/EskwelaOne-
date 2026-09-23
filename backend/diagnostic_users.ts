import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@demo.com', password: 'password123' })
  });
  const loginData = await loginRes.json() as any;
  const setCookieHeader = loginRes.headers.get('set-cookie') || '';
  
  console.log("Teacher logged in. Hitting /api/users...");
  const userRes = await fetch('http://localhost:4000/api/users', {
    headers: { 'Cookie': setCookieHeader }
  });
  console.log("Status:", userRes.status);
  console.log(await userRes.text());
}
main();
