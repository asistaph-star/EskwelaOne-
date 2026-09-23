const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`PAGE ERROR: ${msg.text()}`);
    }
  });
  page.on('pageerror', error => {
    console.log(`PAGE ERROR EXCEPTION: ${error.message}`);
  });

  await page.goto('http://localhost:5173');
  await page.fill('input[type="email"]', 'testteacher@digiskwela.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button:has-text("Sign In")');

  await page.waitForTimeout(2000);
  console.log('Clicking Attendance...');
  await page.click('button:has-text("Attendance")');
  await page.waitForTimeout(1000);
  console.log('Clicking Excuse Letters...');
  await page.click('button:has-text("Excuse Letters")');
  await page.waitForTimeout(3000);

  await browser.close();
})();
