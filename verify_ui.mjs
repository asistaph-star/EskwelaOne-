import { chromium } from 'playwright';

(async () => {
  console.log("=== UI VERIFICATION ===");
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page1 = await browser.newPage();
    console.log("\n--- TEACHER UI VERIFICATION ---");
    await page1.goto('http://localhost:5173/');
    await page1.fill('input[type="email"]', 'teacher@demo.com');
    await page1.fill('input[type="password"]', 'password123');
    await page1.click('button[type="submit"]');
    await page1.waitForTimeout(3000);

    await page1.click('text="Appointments"');
    // Wait for the UI to fetch data and render rows. We assume a table or some list exists.
    // The previous script showed it took a moment to render.
    await page1.waitForTimeout(3000);
    
    // We will extract the innerText of the main content area to prove what is visible.
    // Assuming the main content is within a container. If not, just grabbing body innerText 
    // or specific table rows.
    const teacherDom = await page1.evaluate(() => {
      // Let's find the table rows or cards that hold the appointments
      const rows = Array.from(document.querySelectorAll('tr'));
      if (rows.length > 0) {
        return rows.map(r => r.innerText.replace(/\n/g, ' | ')).join('\n');
      }
      return document.body.innerText; 
    });
    console.log("TEACHER APPOINTMENTS ROW CONTENT:");
    console.log(teacherDom);
    await page1.close();

    const page2 = await browser.newPage();
    console.log("\n--- STUDENT UI VERIFICATION ---");
    await page2.goto('http://localhost:5173/');
    await page2.fill('input[type="email"]', 'student@demo.com');
    await page2.fill('input[type="password"]', 'password123');
    await page2.click('button[type="submit"]');
    await page2.waitForTimeout(3000);

    await page2.click('text="Book Appointment"');
    await page2.waitForTimeout(3000);
    
    const studentDom = await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      if (rows.length > 0) {
        return rows.map(r => r.innerText.replace(/\n/g, ' | ')).join('\n');
      }
      return document.body.innerText; 
    });
    console.log("STUDENT APPOINTMENTS ROW CONTENT:");
    console.log(studentDom);
    await page2.close();

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
