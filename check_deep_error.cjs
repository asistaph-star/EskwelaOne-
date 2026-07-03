const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE LOG ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  console.log('Looking for Teacher login...');
  const btn = await page.$('text/Teacher');
  if (btn) {
    await btn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Get all buttons in the sidebar (we assume they are the main tabs)
  // Let's just click some known sidebar text
  const tabs = ["Dashboard", "Classroom", "Gradebook", "Attendance", "Clinic", "AI Tools", "Pro Dev", "Calendar", "Templates", "Messages"];
  
  for (const tabName of tabs) {
    console.log('Clicking sidebar tab:', tabName);
    const elements = await page.$$('text/' + tabName);
    for (const el of elements) {
      try {
        await el.click();
        await new Promise(r => setTimeout(r, 300));
        
        // check if crashed
        const crashed = await page.$('text/React Crashed');
        if (crashed) {
          const pre = await page.$eval('pre', el => el.textContent);
          console.log('CRASHED on tab:', tabName, pre);
          await browser.close();
          return;
        }
      } catch (e) {
        // ignore non-clickable
      }
    }
  }

  console.log('No crash found in Teacher sidebar.');
  await browser.close();
})();
