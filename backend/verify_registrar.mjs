import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:5173/');
    await page.fill('input[type="email"]', 'registrar@demo.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // 1. Academic Records
    const recordsNav = page.locator('div', { hasText: 'Academic Records (SF10)' }).last();
    await recordsNav.click({ force: true });
    await page.waitForTimeout(2000);
    const recordsDOM = await page.locator('table').textContent();
    console.log(`\nACADEMIC RECORDS TABLE:\n${recordsDOM?.replace(/\s{2,}/g, ' | ')}`);

    // 2. Student Enrollment
    const enrollNav = page.locator('div', { hasText: 'Student Enrollment' }).last();
    await enrollNav.click({ force: true });
    await page.waitForTimeout(2000);
    const enrollDOM = await page.evaluate(() => document.body.innerText);
    const extract = enrollDOM.substring(enrollDOM.indexOf('Student Enrollment & Admissions'), enrollDOM.indexOf('Student Enrollment & Admissions') + 1000);
    console.log(`\nENROLLMENT SCREEN:\n${extract.replace(/\n/g, ' | ')}`);
  } catch (err) { console.error(err); } finally { await browser.close(); }
})();
