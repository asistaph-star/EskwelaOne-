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
  
  console.log('Looking for Principal login...');
  const btn = await page.$('text/Principal');
  if (btn) {
    await btn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Clicking Welfare tab...');
  const tabBtn = await page.$('text/Welfare');
  if (tabBtn) {
    await tabBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Clicking Academics tab...');
  const gbBtn = await page.$('text/Academics');
  if (gbBtn) {
    await gbBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Done checking Principal Portal.');
  await browser.close();
})();
