import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });

  async function scrapePortal(role, email) {
    console.log(`\n=== ${role.toUpperCase()} PORTAL (${email}) ===`);
    const page = await browser.newPage();
    try {
      await page.goto('http://localhost:5173/');
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Extract Sidebar items to see what features are supposed to be there
      const sidebarItems = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('a, button'));
        return items.map(el => el.innerText.trim()).filter(text => text.length > 0 && text.length < 50);
      });
      console.log(`\nSidebar / Nav Items:\n${[...new Set(sidebarItems)].join(', ')}`);

      // Extract main dashboard content
      const dashboardHtml = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, .card, table, tr'));
        return headings.map(h => h.innerText.replace(/\n/g, ' ')).join('\n');
      });
      console.log(`\nDashboard Snippet:\n${dashboardHtml.substring(0, 1000)}`);
      
    } catch (e) {
      console.error(`Error scraping ${role}:`, e);
    } finally {
      await page.close();
    }
  }

  await scrapePortal('Principal', 'principal@demo.com');
  await scrapePortal('Registrar', 'registrar@demo.com');
  await scrapePortal('Admin', 'admin@demo.com');

  await browser.close();
})();
