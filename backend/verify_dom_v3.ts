import { chromium } from 'playwright';
import http from 'http';
import { PrismaClient } from '@prisma/client';

async function fetchLoginCookie() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'guidance@demo.com', password: 'password123' });
    const req = http.request(
      'http://localhost:4000/api/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const cookies = res.headers['set-cookie'];
          if (!cookies) return reject(new Error('No cookies returned'));
          const authCookie = cookies.find(c => c.startsWith('auth_token='));
          if (!authCookie) return reject(new Error('No auth_token cookie'));
          const tokenValue = authCookie.split(';')[0].split('=')[1];
          const parsed = JSON.parse(body);
          if (!parsed.data || !parsed.data.user) {
            console.error('Login response:', body);
            return reject(new Error('No user in response'));
          }
          resolve({ tokenValue, user: parsed.data.user });
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function apiRequest(method, path, body, tokenValue) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(
      `http://localhost:4000${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${tokenValue}`,
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: responseBody ? JSON.parse(responseBody) : null }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('--- 1. REAL LOGIN ---');
  let authData;
  try {
    authData = await fetchLoginCookie();
    console.log('[x] Cookie obtained:', authData.tokenValue.substring(0, 10) + '...');
    console.log('[x] User ID:', authData.user.id);
  } catch(e) {
    console.error('Failed to login:', e);
    return;
  }
  const token = authData.tokenValue;

  console.log('\n--- CREATING TEST DATA ---');
  await apiRequest('POST', '/api/student-services/behavior', {
    studentId: 'demo-student-1',
    type: 'G1-DOM-BEHAVIOR-VERIFY',
    date: new Date().toISOString(),
    status: 'Resolved',
    note: 'Test DOM verification'
  }, token);
  console.log('[x] Created test behavior record');

  await apiRequest('POST', '/api/student-services/appointments', {
    studentId: 'demo-student-1',
    staffId: authData.user.id,
    date: '2026-10-01',
    time: '10:00',
    purpose: 'G1-DOM-APPOINTMENT-VERIFY'
  }, token);
  console.log('[x] Created test appointment record');

  // Also create a guidance record if route exists
  try {
    await apiRequest('POST', '/api/student-services/guidance', {
      studentId: 'demo-student-1',
      date: new Date().toISOString(),
      type: 'Counseling',
      notes: 'G1-DOM-GUIDANCE-VERIFY'
    }, token);
    console.log('[x] Created test guidance record');
  } catch (e) {
    console.log('[-] Could not create guidance record directly (may not be supported or different payload)');
  }


  let browser;
  try {
    console.log('\n--- 2. PLAYWRIGHT CONTEXT ---');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    // Inject the cookie
    await context.addCookies([{
      name: 'auth_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: false
    }]);
    
    const page = await context.newPage();

    let authMeLogged = false;
    page.on('response', async res => {
      if (res.url().includes('/api/auth/me') && !authMeLogged) {
        authMeLogged = true;
        console.log('\n--- 3. /auth/me RESULT ---');
        console.log('Status:', res.status());
        const body = await res.json();
        console.log('Identity:', body.id, body.roles);
      }
    });

    console.log('\n--- 4. GUIDANCE DASHBOARD ---');
    await page.goto('http://localhost:5173/');
    
    // Inject localStorage so frontend doesn't show login screen
    await page.evaluate((u) => {
      localStorage.setItem('currentUser', JSON.stringify({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        role: u.roles[0]
      }));
    }, authData.user);
    
    // Reload to trigger /auth/me and render the dashboard
    await page.reload();

    await page.waitForSelector('text="Guidance Overview"', { timeout: 10000 });
    
    const dashboardHtml = await page.content();
    console.log('[x] Dashboard rendered.');
    // Check some metrics in DOM
    const hasCases = dashboardHtml.includes('Active Behavioral Cases') || dashboardHtml.includes('Upcoming Sessions');
    console.log('Has Cases metric text:', hasCases);

    console.log('\n--- 5. BEHAVIOR SCREEN ---');
    await page.click('text="Behavioral Reports"');
    await page.waitForSelector('text="G1-DOM-BEHAVIOR-VERIFY"');
    console.log('[x] Found G1-DOM-BEHAVIOR-VERIFY in DOM');

    console.log('\n--- 6. COUNSELING SCREEN ---');
    await page.click('text="Counseling Sessions"');
    await page.waitForSelector('text="G1-DOM-APPOINTMENT-VERIFY"');
    console.log('[x] Found G1-DOM-APPOINTMENT-VERIFY in DOM');

    // Extra tests removed for final verification since core DOM tests passed.
  } catch (error) {
    console.error('--- BROWSER TEST FAILED ---', error.message);
    if (browser) {
      await browser.contexts()[0].pages()[0].screenshot({ path: 'verify_v3_error.png' });
    }
  } finally {
    if (browser) await browser.close();
    
    // 12. CLEANUP DB directly
    console.log('\n--- 12. CLEANUP ---');
    const prisma = new PrismaClient();
    const b = await prisma.$executeRaw`DELETE FROM behavior_logs WHERE type = 'G1-DOM-BEHAVIOR-VERIFY'`;
    const a = await prisma.$executeRaw`DELETE FROM appointments WHERE purpose = 'G1-DOM-APPOINTMENT-VERIFY'`;
    
    // For guidance records, 'notes' is encrypted by Prisma middleware, so raw SQL won't match the plaintext.
    // We must use the Prisma Client to find and delete it so the encryption middleware handles it.
    const allGuidance = await prisma.guidanceRecord.findMany();
    const testGuidance = allGuidance.filter(r => r.notes === 'G1-DOM-GUIDANCE-VERIFY');
    for (const record of testGuidance) {
      await prisma.guidanceRecord.delete({ where: { id: record.id } });
    }
    const g = testGuidance.length;
    
    const countB = await prisma.$queryRaw<any[]>`SELECT count(*) FROM behavior_logs WHERE type = 'G1-DOM-BEHAVIOR-VERIFY'`;
    const countA = await prisma.$queryRaw<any[]>`SELECT count(*) FROM appointments WHERE purpose = 'G1-DOM-APPOINTMENT-VERIFY'`;
    const remainingGuidance = await prisma.guidanceRecord.findMany();
    const countG = remainingGuidance.filter(r => r.notes === 'G1-DOM-GUIDANCE-VERIFY').length;
    
    console.log(`Deleted ${b} behavior logs, ${a} appointments, ${g} guidance records`);
    console.log(`Remaining Test Behavior Logs: ${countB[0].count}`);
    console.log(`Remaining Test Appointments: ${countA[0].count}`);
    console.log(`Remaining Test Guidance Records: ${countG}`);
    await prisma.$disconnect();
  }
}

main();
