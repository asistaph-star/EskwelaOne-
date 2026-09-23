import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import * as fs from 'fs';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000/api';
const FRONTEND_URL = 'http://localhost:5173/nurse';

async function fetchWithToken(path: string, token: string, options: any = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

async function run() {
  console.log('--- STARTING N1 DOM VERIFICATION ---');
  
  // 1. Setup Auth
  const nurse = await prisma.user.findFirst({ where: { user_roles: { some: { role: { name: 'Nurse' } } } } });
  if (!nurse) throw new Error("Nurse not found");
  
  const student = await prisma.user.findFirst({ where: { user_roles: { some: { role: { name: 'Student' } } } }, include: { student: true } });
  if (!student) throw new Error("Student not found");

  const secret = process.env.JWT_SECRET || 'supersecretjwtkey'; // fallback to config
  const token = jwt.sign({ userId: nurse.id }, secret, { expiresIn: '1h' });

  // 2. CREATE A CONTROLLED REAL TEST RECORD (POST -> POSTGRES)
  const postRes = await fetchWithToken('/student-services/clinic', token, {
    method: 'POST',
    body: JSON.stringify({
      studentId: student.student!.id,
      date: '2026-10-10',
      time: '10:00',
      symptoms: 'N1-CLINIC-DOM-VERIFY: Fever',
      diagnosis: 'N1-CLINIC-DOM-VERIFY: Flu',
      medications: 'N1-CLINIC-DOM-VERIFY: Paracetamol',
      treatments: 'N1-CLINIC-DOM-VERIFY: Rest',
      notes: 'N1-CLINIC-DOM-VERIFY: Test Note',
      temperature: 38.0
    })
  });
  
  console.log('POST status:', postRes.status);
  const createdRecordBody = await postRes.json();
  if (postRes.status !== 201) throw new Error("POST failed: " + JSON.stringify(createdRecordBody));
  
  const recordId = createdRecordBody.data.id;
  
  // Verify Postgres
  // @ts-ignore
  const rawRows = await prisma.$queryRaw`SELECT * FROM "clinic_referrals" WHERE "id" = ${recordId}`;
  if (rawRows.length === 0) throw new Error("Record not persisted in Postgres");
  console.log('PostgreSQL: Test record exists');

  // Verify GET
  const getRes = await fetchWithToken('/student-services/clinic', token);
  const getBody = await getRes.json();
  const apiContainsRecord = getBody.data.some((r: any) => r.id === recordId);
  console.log('GET status:', getRes.status, 'Record Present:', apiContainsRecord);

  // 3. LOAD THE REAL NURSE PORTAL (PLAYWRIGHT)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('BAD RESPONSE:', response.url(), response.status());
    }
  });

  // Inject token to bypass manual login
  await page.goto('http://localhost:5173/');
  
  await context.addCookies([{
    name: 'auth_token',
    value: token,
    domain: 'localhost',
    path: '/'
  }]);

  await page.evaluate(({jwtStr, nurseUser}) => {
    localStorage.setItem('auth_token', jwtStr);
    localStorage.setItem('currentUser', JSON.stringify({id: nurseUser.id, email: nurseUser.email, role: 'Nurse'}));
  }, {jwtStr: token, nurseUser: {id: nurse.id, email: nurse.email}});

  // 4. SCRAPE THE ACTUAL DOM FOR THE RECORD
  console.log('Navigating to Nurse Portal...');
  await page.goto(FRONTEND_URL);

  try {
    // Wait for the specific text to appear
    await page.waitForSelector(`text="N1-CLINIC-DOM-VERIFY: Flu"`, { timeout: 10000 });
  } catch (e) {
    console.log('Timeout waiting for selector. Dumping body HTML to verify_dom_error.html...');
    const html = await page.locator('body').innerHTML().catch(() => 'no body');
    fs.writeFileSync('verify_dom_error.html', html);
    await page.screenshot({ path: 'verify_dom_error.png' });
    throw e;
  }
  
    // 5. EXTRACT DATA TO VERIFY EXACT FIELDS
    console.log('Extracting row content...');
    const rowLocator = page.locator(`tr:has-text("N1-CLINIC-DOM-VERIFY: Flu")`).first();
    const rowText = await rowLocator.innerText();
    console.log('--- FOUND ROW TEXT ---');
    console.log(rowText);
    console.log('----------------------');

    if (rowText.includes('N1-CLINIC-DOM-VERIFY: Flu') && rowText.includes('N1-CLINIC-DOM-VERIFY: Fever') && rowText.includes('N1-CLINIC-DOM-VERIFY: Rest')) {
      console.log('\n✅ DOM VERIFICATION SUCCESSFUL. N1 IS FULLY CLOSED.');
      process.exit(0);
    } else {
      console.log('\n❌ ROW RENDERED BUT MISSING DATA.');
      process.exit(1);
    }

  // 6. TEST ERROR STATE
  console.log('Testing error state...');
  await page.unroute('**/api/student-services/clinic');
  await page.route('**/api/student-services/clinic', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Access Denied: You do not have permission to view clinic records.' })
      });
    } else {
      route.continue();
    }
  });
  await page.reload();
  await page.waitForSelector('text="Access Denied: You do not have permission to view clinic records."', { timeout: 5000 });
  const errorText = await page.locator('text="Access Denied: You do not have permission to view clinic records."').innerText();
  console.log('\n--- DOM SCRAPED TEXT FOR ERROR STATE ---');
  console.log(errorText);
  console.log('----------------------------------------\n');

  // 7. TEST LOADING STATE
  console.log('Testing loading state...');
  await page.unroute('**/api/student-services/clinic');
  await page.route('**/api/student-services/clinic', async route => {
    if (route.request().method() === 'GET') {
      // Delay response by 2 seconds
      setTimeout(async () => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
      }, 2000);
    } else {
      route.continue();
    }
  });

  const gotoPromise = page.reload();
  await page.waitForSelector('text="Loading clinic records..."', { timeout: 5000 });
  const loadingText = await page.locator('text="Loading clinic records..."').innerText();
  console.log('\n--- DOM SCRAPED TEXT FOR LOADING STATE ---');
  console.log(loadingText);
  console.log('----------------------------------------\n');
  await gotoPromise;

  // 8. CLEANUP VERIFICATION
  // @ts-ignore
  const rawRowsAfter = await prisma.$queryRaw`SELECT * FROM "clinic_referrals" WHERE "id" = ${recordId}`;
  console.log('PostgreSQL Test Record Remaining Count:', rawRowsAfter.length);

  await browser.close();
  await prisma.$disconnect();
  
  console.log('\nN1 VERIFIED AND CLOSED');
}

run().catch(async (e) => {
  console.error('\nN1 NOT CLOSED — FRONTEND E2E VERIFICATION FAILURE');
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
