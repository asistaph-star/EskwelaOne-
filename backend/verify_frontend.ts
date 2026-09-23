import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('--- STARTING FRONTEND E2E DOM VERIFICATION ---');

  // Inject a mock token and user so the app thinks we are logged in as Nurse
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem('currentUser', JSON.stringify({id: 'nurse1', email: 'nurse@digiskwela.test'}));
  });

  // Intercept the API calls to return custom states
  await page.route('**/api/auth/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { user: { id: 'nurse1', email: 'nurse@digiskwela.test', roles: ['Nurse'] } } })
    });
  });

  await page.route('**/api/users?role=Student', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] })
    });
  });

  await page.route('**/api/student-services/clinic', async route => {
    if (route.request().method() === 'GET') {
      // Simulate slow response to check loading state
      setTimeout(async () => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] })
        });
      }, 1000);
    } else {
      route.continue();
    }
  });

  console.log('Navigating to Nurse Portal...');
  const gotoPromise = page.goto('http://localhost:5173/nurse');

  // Verify Loading State
  console.log('Testing Loading State...');
  // The moment the page starts rendering, the loading state should appear before the 1000ms timeout
  const loadingVisible = await page.waitForSelector('text="Loading clinic records..."', { state: 'visible', timeout: 2000 }).catch(() => null);
  if (loadingVisible) {
    console.log('✅ PASS: Loading state rendered successfully.');
  } else {
    console.log('❌ FAIL: Loading state not found.');
  }

  await gotoPromise;
  await page.screenshot({ path: 'playwright_state.png' });
  
  // Wait for the timeout to resolve and empty state to appear
  console.log('Testing Empty State...');
  const emptyVisible = await page.waitForSelector('text="No clinic records found."', { state: 'visible', timeout: 3000 }).catch(() => null);
  if (emptyVisible) {
    console.log('✅ PASS: Empty state rendered successfully after loading.');
  } else {
    console.log('❌ FAIL: Empty state not found.');
    await page.screenshot({ path: 'playwright_empty_fail.png' });
  }

  // Now, test Error State by reloading and intercepting with 500 error
  console.log('Testing Error State...');
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

  await page.goto('http://localhost:5173/nurse');
  const errorVisible = await page.waitForSelector('text="Access Denied: You do not have permission to view clinic records."', { state: 'visible', timeout: 3000 }).catch(() => null);
  if (errorVisible) {
    console.log('✅ PASS: Error state rendered successfully.');
  } else {
    console.log('❌ FAIL: Error state not found.');
    await page.screenshot({ path: 'playwright_error_fail.png' });
  }

  console.log('--- FRONTEND VERIFICATION COMPLETE ---');
  await browser.close();
}

run().catch(console.error);
