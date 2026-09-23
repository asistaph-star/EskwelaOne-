

async function main() {
  console.log("1. Logging in as principal...");
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'principal@demo.com', password: 'password123' })
  });
  
  const cookie = loginRes.headers.get('set-cookie') || '';
  
  console.log("2. Fetching /admin/leaves...");
  const leavesRes = await fetch('http://localhost:4000/api/admin/leaves', {
    headers: { 'Cookie': cookie }
  });
  const text = await leavesRes.text();
  console.log("Status:", leavesRes.status);
  console.log("Body:", text);
}

main().catch(console.error);
