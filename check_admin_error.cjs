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
  
  console.log('Looking for Admin login...');
  const btn = await page.$('text/Admin');
  if (btn) {
    await btn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Clicking Network tab...');
  const netBtn = await page.$('text/Network');
  if (netBtn) {
    await netBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Clicking Audit tab...');
  const audBtn = await page.$('text/Audit');
  if (audBtn) {
    await audBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Done checking Admin Portal.');
  await browser.close();
})();
