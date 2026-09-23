import { chromium } from 'playwright';

async function run() {
  console.log('--- STARTING AUTH SECURITY AUDIT ---');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const FRONTEND_URL = 'http://localhost:5173/';
  const API_URL = 'http://localhost:4000/api';

  async function apiFetch(endpoint: string) {
    return page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: 'include' });
      return { status: res.status, body: await res.json().catch(() => null) };
    }, `${API_URL}${endpoint}`);
  }

  // 1. Log in normally
  console.log('\n[1] Logging in as Student (student@demo.com)...');
  await page.goto(FRONTEND_URL);
  
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'student@demo.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForSelector('text="Student Portal"', { timeout: 10000 });
  console.log('✅ Logged in successfully.');

  const originalUser = await page.evaluate(() => JSON.parse(localStorage.getItem('currentUser') || '{}'));
  console.log('Original localStorage.currentUser:', originalUser);

  // Initial API request to verify normal auth
  console.log('\n[2] Testing initial API auth...');
  let apiRes = await apiFetch('/auth/me');
  console.log('GET /auth/me Status:', apiRes.status);
  console.log('Backend Identity:', apiRes.body.data.email, apiRes.body.data.roles);

  // 3. User-ID Tampering
  console.log('\n[3] Testing User-ID Tampering...');
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    user.id = 'TAMPERED-ID-999';
    localStorage.setItem('currentUser', JSON.stringify(user));
  });
  await page.reload();
  await page.waitForTimeout(2000);
  
  apiRes = await apiFetch('/auth/me');
  console.log('GET /auth/me Status after ID Tampering:', apiRes.status);
  console.log('Backend Identity:', apiRes.body?.data?.id === 'TAMPERED-ID-999' ? 'TAMPERED' : 'ORIGINAL (' + apiRes.body?.data?.id + ')');

  // 4. Role Tampering
  console.log('\n[4] Testing Role Tampering...');
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    user.role = 'Admin';
    localStorage.setItem('currentUser', JSON.stringify(user));
  });
  await page.reload();
  await page.waitForTimeout(2000);
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (bodyText.includes('Admin')) {
    console.log('UI thinks user is Admin!');
  } else {
    console.log('UI did NOT change to Admin portal.');
  }

  console.log('Testing Admin-only API access...');
  apiRes = await apiFetch('/users'); 
  console.log('GET /users Status:', apiRes.status);
  if (apiRes.status === 401 || apiRes.status === 403 || apiRes.status === 404) {
    console.log('✅ Backend successfully rejected the forged role.');
  } else {
    console.log('❌ BACKEND ACCEPTED FORGED ROLE! Status:', apiRes.status);
  }

  // 5. Permission Tampering
  console.log('\n[5] Testing Permission Tampering...');
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    user.permissions = ['clinic:read', 'admin:write'];
    localStorage.setItem('currentUser', JSON.stringify(user));
  });
  await page.reload();
  await page.waitForTimeout(2000);

  console.log('Testing protected API access...');
  apiRes = await apiFetch('/student-services/clinic');
  console.log('GET /student-services/clinic Status:', apiRes.status);

  // 6. Logout test (Are we fully logged out?)
  console.log('\n[6] Testing Logout...');
  // Let's actually find the logout button in UI and click it if possible, or just call the API
  await page.evaluate(async (url) => {
    await fetch(url, { method: 'POST', credentials: 'include' });
  }, `${API_URL}/auth/logout`);
  console.log('Called /auth/logout API');
  
  await page.reload();
  await page.waitForTimeout(2000);
  apiRes = await apiFetch('/auth/me');
  console.log('GET /auth/me after logout Status:', apiRes.status);
  
  const isLoginFormAfterLogout = await page.evaluate(() => !!document.querySelector('input[type="email"]'));
  if (isLoginFormAfterLogout) {
    console.log('✅ UI shows login form after logout.');
  }

  // 7. Stale LocalStorage (No Cookie)
  console.log('\n[7] Testing Stale LocalStorage (Invalid Session)...');
  await page.evaluate(() => {
    // Re-inject the fake user to simulate stale local storage
    const user = { id: 'STALE', role: 'Student', email: 'stale@demo.com' };
    localStorage.setItem('currentUser', JSON.stringify(user));
  });
  await page.reload();
  await page.waitForTimeout(2000);

  const staleUser = await page.evaluate(() => localStorage.getItem('currentUser'));
  console.log('LocalStorage currentUser present?', !!staleUser);
  
  apiRes = await apiFetch('/auth/me');
  console.log('GET /auth/me with stale localStorage Status:', apiRes.status);

  const isLoginForm = await page.evaluate(() => !!document.querySelector('input[type="email"]'));
  if (isLoginForm) {
    console.log('✅ UI correctly redirected to Login screen despite stale localStorage.');
  } else {
    console.log('❌ UI thinks user is logged in (shows portal), but backend is blocking API calls.');
  }

  console.log('\n--- AUDIT COMPLETE ---');
  await browser.close();
}

run().catch(console.error);
