import puppeteer from 'puppeteer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log("Starting UI Verification via Puppeteer...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    // 1. PRINCIPAL WORKFLOW
    console.log("Logging in as Principal...");
    await page.goto('http://localhost:5173');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'principal@demo.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    console.log("Navigating to Document Requests...");
    // Wait for dashboard to load
    await page.waitForSelector('nav');
    // Click Document Requests in sidebar
    const [docLink] = await page.$x("//a[contains(., 'Document Requests')]");
    if (docLink) {
        await docLink.click();
    } else {
        throw new Error("Could not find Document Requests link");
    }
    
    // Find the UI_VERIFICATION_TEST row
    console.log("Approving document as Principal...");
    await page.waitForXPath("//td[contains(., 'UI_VERIFICATION_TEST')]");
    // Click Approve
    const [approveBtn] = await page.$x("//td[contains(., 'UI_VERIFICATION_TEST')]/..//button[contains(., 'Approve')]");
    if (approveBtn) await approveBtn.click();
    
    // Fill modal and submit
    await page.waitForXPath("//h3[contains(., 'Approve Request')]");
    await page.type('textarea', 'Principal approval test UI');
    const [modalSubmit] = await page.$x("//button[contains(., 'Approve Request') and not(contains(@class, 'cancel'))]");
    if (modalSubmit) await modalSubmit.click();
    
    // Wait for modal to disappear
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Refreshing page...");
    await page.reload();
    await page.waitForXPath("//td[contains(., 'UI_VERIFICATION_TEST')]");
    
    const [statusNode] = await page.$x("//td[contains(., 'UI_VERIFICATION_TEST')]/..//span[contains(text(), 'Principal Approved')]");
    if (statusNode) {
      console.log("SUCCESS: Principal Approved status PERSISTED after refresh!");
      await page.screenshot({ path: 'C:/Users/Nhico/.gemini/antigravity-ide/brain/e9412adf-78ca-4e45-9ea7-14296c8705d9/principal_refresh_proof.png' });
    } else {
      throw new Error("FAILED: Status did not persist after refresh for Principal.");
    }

    // Logout
    const [logoutBtn] = await page.$x("//button[contains(., 'Log Out') or contains(., 'Logout')]");
    if (logoutBtn) await logoutBtn.click();
    await page.waitForSelector('input[type="email"]');
    
    // 2. REGISTRAR WORKFLOW
    console.log("Logging in as Registrar...");
    await page.type('input[type="email"]', 'registrar@demo.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    console.log("Navigating to Document Requests...");
    await page.waitForSelector('nav');
    const [docLinkReg] = await page.$x("//a[contains(., 'Document Requests')]");
    if (docLinkReg) await docLinkReg.click();
    
    console.log("Marking Ready for Pickup...");
    await page.waitForXPath("//td[contains(., 'UI_VERIFICATION_TEST')]");
    
    const [readyBtn] = await page.$x("//td[contains(., 'UI_VERIFICATION_TEST')]/..//button[contains(., 'Mark Ready')]");
    if (readyBtn) await readyBtn.click();
    await new Promise(r => setTimeout(r, 2000));

    console.log("Marking Completed...");
    const [completeBtn] = await page.$x("//td[contains(., 'UI_VERIFICATION_TEST')]/..//button[contains(., 'Complete')]");
    if (completeBtn) await completeBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Refreshing page...");
    await page.reload();
    await page.waitForXPath("//td[contains(., 'UI_VERIFICATION_TEST')]");
    
    const [completedNode] = await page.$x("//td[contains(., 'UI_VERIFICATION_TEST')]/..//span[contains(text(), 'Completed')]");
    if (completedNode) {
      console.log("SUCCESS: Completed status PERSISTED after refresh!");
      await page.screenshot({ path: 'C:/Users/Nhico/.gemini/antigravity-ide/brain/e9412adf-78ca-4e45-9ea7-14296c8705d9/registrar_refresh_proof.png' });
    } else {
      throw new Error("FAILED: Status did not persist after refresh for Registrar.");
    }

    // 3. DATABASE VERIFICATION
    console.log("Querying database directly...");
    const dbRecord = await prisma.documentRequest.findFirst({
        where: { purpose: 'UI_VERIFICATION_TEST' }
    });
    console.log("DB Record Status:", dbRecord?.status);
    if (dbRecord?.status === 'Completed') {
        console.log("SUCCESS: Database status successfully verified as Completed!");
    } else {
        throw new Error("FAILED: Database status does not match!");
    }

  } catch (err) {
    console.error("UI Test Failed:", err);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

run();
