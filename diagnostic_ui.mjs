import { chromium } from 'playwright';

(async () => {
  console.log("Starting Playwright diagnostic...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Navigating to http://localhost:5173/");
  await page.goto('http://localhost:5173/');

  // Login
  console.log("Logging in as student@demo.com...");
  await page.fill('input[type="email"]', 'student@demo.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Wait for login to complete and dashboard to load
  await page.waitForTimeout(3000);

  // Navigate to Appointments
  console.log("Navigating to Appointments tab...");
  await page.click('text="Book Appointment"');

  await page.waitForTimeout(2000);

  // Evaluate the dropdown contents
  console.log("Evaluating dropdown options...");
  
  // Extract optgroups and their options
  const dropdownStructure = await page.$$eval('select', selects => {
    // Find the select that has "Choose a teacher or staff"
    const targetSelect = Array.from(selects).find(s => 
      s.innerHTML.includes('Choose a teacher or staff')
    );
    if (!targetSelect) return null;
    
    const structure = [];
    
    // Check direct options (e.g. the placeholder)
    Array.from(targetSelect.children).forEach(child => {
      if (child.tagName.toLowerCase() === 'option') {
        structure.push({ type: 'option', text: child.text.trim(), value: child.value });
      } else if (child.tagName.toLowerCase() === 'optgroup') {
        const groupOptions = Array.from(child.children).map(o => ({ value: o.value, text: o.text.trim() }));
        structure.push({ type: 'optgroup', label: child.label, options: groupOptions });
      }
    });
    
    return structure;
  });

  console.log("Dropdown Structure:");
  console.log(JSON.stringify(dropdownStructure, null, 2));

  await browser.close();
})();
