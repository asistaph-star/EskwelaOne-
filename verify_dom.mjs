import { chromium } from 'playwright';

async function main() {
  console.log('--- STARTING DOM VERIFICATION ---');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    
    // 1. Login
    console.log('Navigating to login...');
    await page.goto('http://localhost:5173/');
    await page.fill('input[type="email"]', 'guidance@demo.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for Dashboard to load
    await page.waitForSelector('text="Dashboard Overview"');
    console.log('[x] Successfully logged in and reached Guidance Dashboard');

    // 2. Verify Dashboard
    await page.waitForSelector('text="Active Cases"');
    console.log('[x] Verified Dashboard Data (Active Cases visible)');

    // 3. Navigate to Behavior
    await page.click('text="Behavioral Reports"');
    await page.waitForSelector('text="Log New Incident"');
    console.log('[x] Verified Behavior Screen');

    // 4. Navigate to Counseling
    await page.click('text="Counseling Sessions"');
    await page.waitForSelector('text="Schedule Session"');
    console.log('[x] Verified Counseling Screen');

    console.log('--- DOM VERIFICATION PASS ---');
  } catch (error) {
    if (browser && browser.contexts().length > 0 && browser.contexts()[0].pages().length > 0) {
      const p = browser.contexts()[0].pages()[0];
      await p.screenshot({ path: 'error.png' });
      const html = await p.content();
      console.log('--- PAGE HTML ---');
      console.log(html.substring(0, 5000));
      console.log('Saved error screenshot to error.png');
    }
    console.error('--- DOM VERIFICATION FAILED ---');
    console.error(error.message);
  } finally {
    if (browser) await browser.close();
  }
}

main();
