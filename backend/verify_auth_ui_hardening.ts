import { chromium } from 'playwright';

async function run() {
  console.log('--- STARTING AUTH UI HARDENING VERIFICATION ---');
  
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

  async function performUILogout() {
    // StudentPortal has Logout button directly visible
    const studentLogout = page.locator('button', { hasText: 'Logout' });
    if (await studentLogout.isVisible()) {
      await studentLogout.click();
      return;
    }

    // For other portals, click the profile toggle which has the ChevronDown icon
    const chevron = page.locator('.lucide-chevron-down');
    if (await chevron.count() > 0) {
      // The parent container has the onClick handler
      await chevron.last().locator('..').click({ force: true });
      await page.waitForTimeout(500); // wait for menu to mount
      const menuLogout = page.locator('button', { hasText: 'Logout' });
      if (await menuLogout.isVisible()) {
        await menuLogout.click();
        return;
      }
    }
    
    // Fallback just in case
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('api_unauthorized'));
    });
  }

  const ROLES_TESTS = [
    { email: 'student@demo.com', checkText: 'My Portal', expectedRole: 'Student' },
    { email: 'teacher@demo.com', checkText: 'Dashboard Overview', expectedRole: 'Teacher' },
    { email: 'principal@demo.com', checkText: 'Dashboard Overview', expectedRole: 'Principal' },
    { email: 'nurse@demo.com', checkText: 'Dashboard Overview', expectedRole: 'Nurse' },
    { email: 'admin@demo.com', checkText: 'System Dashboard', expectedRole: 'Admin' }
  ];

  // 1. Test Refresh and Logout Flow for All Core Roles
  console.log('\\n[1] Testing Refresh & Logout For Core Roles...');
  
  for (const t of ROLES_TESTS) {
    console.log(`\\n--- Testing ${t.expectedRole} (${t.email}) ---`);
    await context.clearCookies();
    await page.goto(FRONTEND_URL);
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', t.email);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Verify Login
    await page.waitForSelector('.lucide-bell', { timeout: 10000 });
    console.log(`✅ Logged in to ${t.expectedRole} portal.`);

    // Verify Auth Me Before Refresh
    let me = await apiFetch('/auth/me');
    if (me.status !== 200 || !me.body?.data?.roles?.includes(t.expectedRole)) {
      console.log(`❌ FAIL — /auth/me invalid for ${t.expectedRole} before refresh.`);
      process.exit(1);
    }

    // Refresh Page
    await page.reload();
    await page.waitForSelector('.lucide-bell', { timeout: 10000 });
    console.log(`✅ ${t.expectedRole} portal survived refresh.`);

    // Logout
    await performUILogout();
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log(`✅ UI returned to login screen after logout.`);

    // Verify /auth/me after logout
    me = await apiFetch('/auth/me');
    if (me.status !== 401) {
      console.log(`❌ FAIL — /auth/me returned ${me.status} instead of 401 after logout.`);
      process.exit(1);
    }
    console.log(`✅ /auth/me returned 401 unauthenticated.`);

    // Verify LocalStorage is cleared
    const currentUser = await page.evaluate(() => localStorage.getItem('currentUser'));
    if (currentUser) {
      console.log(`❌ FAIL — localStorage.currentUser was not cleared after logout.`);
      process.exit(1);
    }
    console.log(`✅ localStorage.currentUser cleared.`);

    // Refresh after logout
    await page.reload();
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log(`✅ Remained on login screen after post-logout refresh.`);
  }

  // 2. Tampering Tests
  console.log('\\n[2] Testing Security Tampering...');
  
  // Login as student for tampering
  await context.clearCookies();
  await page.goto(FRONTEND_URL);
  await page.fill('input[type="email"]', 'student@demo.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.lucide-bell', { timeout: 10000 });

  console.log('\\n[2A] Role Tampering...');
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    user.role = 'Admin';
    localStorage.setItem('currentUser', JSON.stringify(user));
  });
  await page.reload();
  await page.waitForTimeout(3000);
  const finalRole = await page.evaluate(() => JSON.parse(localStorage.getItem('currentUser') || '{}').role);
  if (finalRole === 'Student') {
    console.log('✅ PASS — cached role tampering rejected & overwritten by server identity');
  } else {
    console.log(`❌ FAIL — role remained: ${finalRole}`);
    process.exit(1);
  }

  console.log('\\n[2B] User-ID Tampering...');
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    user.id = 'TAMPERED-ID-999';
    localStorage.setItem('currentUser', JSON.stringify(user));
  });
  await page.reload();
  await page.waitForTimeout(3000);
  const finalId = await page.evaluate(() => JSON.parse(localStorage.getItem('currentUser') || '{}').id);
  if (finalId !== 'TAMPERED-ID-999' && finalId) {
    console.log('✅ PASS — cached user-ID tampering rejected & corrected from server identity');
  } else {
    console.log(`❌ FAIL — ID remained: ${finalId}`);
    process.exit(1);
  }

  console.log('\\n[2C] Permission Tampering...');
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    user.permissions = ['clinic:read', 'admin:write'];
    localStorage.setItem('currentUser', JSON.stringify(user));
  });
  await page.reload();
  await page.waitForTimeout(3000);
  const finalPermissions = await page.evaluate(() => JSON.parse(localStorage.getItem('currentUser') || '{}').permissions || []);
  if (!finalPermissions.includes('admin:write')) {
    console.log('✅ PASS — cached permission tampering rejected & overwritten');
  } else {
    console.log(`❌ FAIL — permissions remained: ${finalPermissions}`);
    process.exit(1);
  }

  console.log('\\n[2D] Stale Session Test...');
  await context.clearCookies(); // Kill the actual backend session, keep localStorage
  await page.reload();
  await page.waitForTimeout(3000);
  const staleUser = await page.evaluate(() => localStorage.getItem('currentUser'));
  if (!staleUser) {
    console.log('✅ PASS — stale cache session rejected');
  } else {
    console.log('❌ FAIL — user was not cleared from localStorage after session expired!');
    process.exit(1);
  }

  console.log('\\n--- ALL UI HARDENING TESTS PASSED ---');
  await browser.close();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
