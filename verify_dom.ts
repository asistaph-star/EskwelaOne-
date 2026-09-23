import { chromium } from 'playwright';

async function main() {
  console.log('--- STARTING DOM VERIFICATION ---');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // 1. Login
    console.log('Navigating to login...');
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'guidance@demo.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for Dashboard to load
    await page.waitForURL('**/guidance/dashboard', { timeout: 10000 });
    console.log('[x] Successfully logged in and reached Guidance Dashboard');

    // 2. Verify Dashboard
    await page.waitForSelector('text="Active Cases"');
    console.log('[x] Verified Dashboard Data (Active Cases visible)');

    // 3. Navigate to Behavior
    await page.click('text="Behavior"');
    await page.waitForURL('**/guidance/behavior');
    await page.waitForSelector('text="Log New Incident"');
    console.log('[x] Verified Behavior Screen');

    // 4. Navigate to Counseling
    await page.click('text="Counseling"');
    await page.waitForURL('**/guidance/counseling');
    await page.waitForSelector('text="Schedule Session"');
    console.log('[x] Verified Counseling Screen');

    console.log('--- DOM VERIFICATION PASS ---');
  } catch (error: any) {
    console.error('--- DOM VERIFICATION FAILED ---');
    console.error(error.message);
  } finally {
    if (browser) await browser.close();
  }
}

main();
