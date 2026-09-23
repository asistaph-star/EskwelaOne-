import { chromium } from 'playwright';

(async () => {
  console.log("=== UI TEST: APPOINTMENTS ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);

  try {
    console.log("1. Logging in as teacher...");
    await page.goto('http://localhost:5173/');
    await page.fill('input[type="email"]', 'teacher@demo.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    console.log("2. Navigating to Teacher Appointments...");
    await page.click('text="Appointments"');
    await page.waitForTimeout(2000);

    console.log("3. Verifying incoming appointment from Student...");
    const hasIncoming = await page.evaluate(() => {
      return document.body.innerText.includes('Discuss Grades') && 
             document.body.innerText.includes('parent@demo.com');
    });
    console.log(`Incoming Appointment Visible: ${hasIncoming ? 'YES' : 'NO'}`);

    console.log("4. Requesting an appointment with a Parent...");
    await page.click('text="Request Appointment with Parent"');
    await page.waitForTimeout(1000);
    
    // Select first valid student option
    try {
      await page.waitForSelector('select option[value]:not([value=""])', { timeout: 3000 });
      const options = await page.$$eval('select option', opts => opts.map(o => o.value).filter(v => v !== ""));
      if (options.length > 0) {
        await page.selectOption('select', options[0]);
      } else {
        console.log("No students found in dropdown.");
      }
    } catch (e) {
      console.log("No students found in dropdown (timeout).");
    }

    await page.fill('input[type="date"]', '2026-10-15');
    await page.fill('input[type="time"]', '14:30');
    await page.fill('textarea[placeholder="Describe the purpose of this meeting..."]', 'Behavior concern from Math class');
    
    await page.click('button:has-text("Send Request")');
    await page.waitForTimeout(2000);
    
    console.log("5. Checking if outgoing request is visible...");
    const hasOutgoing = await page.evaluate(() => {
      return document.body.innerText.includes('Behavior concern from Math class');
    });
    console.log(`Outgoing Appointment Visible (Teacher side): ${hasOutgoing ? 'YES' : 'NO'}`);
  } catch (err) {
    console.error("Error in Teacher flow:", err);
  }

  try {
    console.log("\n6. Logging out...");
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    page2.setDefaultTimeout(5000);

    console.log("7. Logging in as student...");
    await page2.goto('http://localhost:5173/');
    await page2.fill('input[type="email"]', 'student@demo.com');
    await page2.fill('input[type="password"]', 'password123');
    await page2.click('button[type="submit"]');
    
    await page2.waitForTimeout(3000);

    console.log("8. Navigating to Student Appointments...");
    await page2.click('text="Book Appointment"');
    await page2.waitForTimeout(2000);

    console.log("9. Verifying incoming appointment from Teacher...");
    const hasIncomingStudent = await page2.evaluate(() => {
      return document.body.innerText.includes('Behavior concern from Math class');
    });
    console.log(`Incoming Appointment Visible (Student side): ${hasIncomingStudent ? 'YES' : 'NO'}`);
  } catch (err) {
    console.error("Error in Student flow:", err);
  }

  await browser.close();
})();
