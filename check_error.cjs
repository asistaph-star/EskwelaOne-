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
  const teacherBtn = await page.$('text/Teacher');
  if (teacherBtn) {
    await teacherBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Clicking Classroom Hub...');
  const classBtn = await page.$('text/Enter Classroom');
  if (classBtn) {
    await classBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Clicking Attendance tab...');
  const attBtn = await page.$('text/Attendance');
  if (attBtn) {
    await attBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Clicking Gradebook tab...');
  const gbBtn = await page.$('text/Gradebook');
  if (gbBtn) {
    await gbBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Done checking.');
  await browser.close();
})();
