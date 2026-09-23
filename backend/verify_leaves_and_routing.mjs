import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });

  console.log("=== CONFIRMING PRINCIPAL ROUTING AND LEAVE MANAGEMENT ===");
  const pPage = await browser.newPage();
  pPage.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  try {
    await pPage.goto('http://localhost:5173/');
    await pPage.fill('input[type="email"]', 'principal@demo.com');
    await pPage.fill('input[type="password"]', 'password123');
    await pPage.click('button[type="submit"]');
    await pPage.waitForTimeout(3000);

    // Get the page title/heading to prove routing
    const pHeading = await pPage.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.innerText : "No heading found";
    });
    console.log("Principal Landing Heading:", pHeading);

    // Navigate to Leave Management
    await pPage.click('text="Leave Management"');
    await pPage.waitForTimeout(3000);

    // Dump Leave Management content
    const pLeavesContent = await pPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, .card'));
      if (rows.length > 0) {
        return rows.map(r => r.innerText.replace(/\n/g, ' | ')).join('\n');
      }
      return document.body.innerText.substring(0, 500); 
    });
    console.log("\nPrincipal Leave Management DOM Snippet:");
    console.log(pLeavesContent);
  } finally {
    await pPage.close();
  }

  console.log("\n=== CONFIRMING ADMIN ROUTING ===");
  const aPage = await browser.newPage();
  try {
    await aPage.goto('http://localhost:5173/');
    await aPage.fill('input[type="email"]', 'admin@demo.com');
    await aPage.fill('input[type="password"]', 'password123');
    await aPage.click('button[type="submit"]');
    await aPage.waitForTimeout(3000);

    const aHeading = await aPage.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.innerText : "No heading found";
    });
    console.log("Admin Landing Heading:", aHeading);
  } finally {
    await aPage.close();
  }

  await browser.close();
})();
