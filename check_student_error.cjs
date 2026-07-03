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
  
  console.log('Looking for Student login...');
  const btn = await page.$('text/Student');
  if (btn) {
    await btn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Clicking Achievement tab...');
  const tabBtn = await page.$('text/Achievement');
  if (tabBtn) {
    await tabBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Clicking Grades tab...');
  const gbBtn = await page.$('text/Grades');
  if (gbBtn) {
    await gbBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Done checking Student Portal.');
  await browser.close();
})();
