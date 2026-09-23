import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`BROWSER ERROR: ${msg.text()}`);
    }
  });

  try {
    console.log("=== CONFIRMING REGISTRAR DASHBOARD ===");
    await page.goto('http://localhost:5173/');
    await page.fill('input[type="email"]', 'registrar@demo.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // wait for dashboard to appear
    await page.waitForSelector('text="Registrar Overview"', { timeout: 10000 });
    
    // wait for loading to disappear
    await page.waitForFunction(() => !document.body.innerText.includes('Loading dashboard statistics'), { timeout: 10000 });
    
    const dashboardText = await page.evaluate(() => document.body.innerText);
    const startIndex = dashboardText.indexOf('TOTAL ENROLLED');
    const extract = dashboardText.substring(startIndex, startIndex + 1000);
    console.log(`\nDASHBOARD KPI SNIPPET:\n${extract.replace(/\n/g, ' | ')}`);
  } catch (err) { console.error(err); } finally { await browser.close(); }
})();
