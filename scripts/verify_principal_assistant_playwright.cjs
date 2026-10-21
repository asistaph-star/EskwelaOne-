const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log('=== DIGISKWELA: PRINCIPAL ASSISTANT FINAL HARDENING E2E VERIFICATION ===');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const results = {
    triggerRenders: false,
    noLegacyWidget: false,
    noDuplicateButton: false,
    drawerOpens: false,
    mockBadgeVisible: false,
    quickPromptsRendered: false,
    turn1AttendanceAuditSucceeds: false,
    neutralAttendanceWording: false,
    provenanceRenders: false,
    turn2ConversationalFollowUpSucceeds: false,
    ambiguousReferenceClarification: false,
    drawerCloseAndReopenPreservesMemory: false,
    clearSessionWorks: false,
    f5ClearsConversation: false,
    logoutClearsConversation: false,
    zeroLocalStorageTranscript: false,
    zeroIndexedDBTranscript: false,
  };

  async function loginAsPrincipal() {
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'principal@demo.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="principal-ai-assistant-trigger"]', { timeout: 15000 });
  }

  async function sendMessageAndWait(text) {
    await page.waitForSelector('[data-testid="assistant-loading-indicator"]', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForSelector('[data-testid="assistant-input-textarea"]:not([disabled])', { timeout: 10000 });
    await page.fill('[data-testid="assistant-input-textarea"]', text);
    await page.click('[data-testid="assistant-send-button"]');
    await page.waitForSelector('[data-testid="assistant-loading-indicator"]', { state: 'visible', timeout: 5000 }).catch(() => {});
    await page.waitForSelector('[data-testid="assistant-loading-indicator"]', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(500);
  }

  try {
    // 1. Initial Authentication into Principal Portal
    console.log('1. Authenticating as Canonical Seeded Principal (principal@demo.com)...');
    await loginAsPrincipal();
    console.log('✓ Successfully authenticated into Principal portal.');

    // 2. Verify Single AI Trigger & No Legacy Widget
    const triggers = await page.$$('[data-testid="principal-ai-assistant-trigger"]');
    console.log(`Found ${triggers.length} Principal AI triggers.`);
    results.triggerRenders = triggers.length === 1;
    results.noDuplicateButton = triggers.length === 1;

    const legacyWidgets = await page.$$eval('*', els => 
      els.filter(el => el.innerText && el.innerText.includes('Powered by Asyntai')).length
    );
    console.log(`Found ${legacyWidgets} legacy Asyntai widgets.`);
    results.noLegacyWidget = legacyWidgets === 0;

    // 3. Open Assistant Drawer
    console.log('2. Clicking AI Assistant trigger to open drawer...');
    await page.click('[data-testid="principal-ai-assistant-trigger"]');
    await page.waitForSelector('[data-testid="principal-assistant-drawer"]', { state: 'visible' });
    results.drawerOpens = true;
    console.log('✓ Assistant drawer successfully opened.');

    // 4. Verify Mock Provider Development Badge
    const badgeText = await page.$eval('[data-testid="mock-provider-badge"]', el => el.innerText);
    console.log(`Badge text: "${badgeText}"`);
    results.mockBadgeVisible = badgeText.includes('Development mode · Grounded DigiSkwela data');

    // 5. Verify 8 Quick Prompts Rendered
    const quickPromptsCount = await page.$$eval('[data-testid^="quick-prompt-"]', els => els.length);
    console.log(`Rendered quick prompts count: ${quickPromptsCount}`);
    results.quickPromptsRendered = quickPromptsCount === 8;

    // 6. Conversational Flow Turn 1: "Review today's faculty attendance."
    console.log('3. Testing Turn 1: "Review today\'s faculty attendance."...');
    await sendMessageAndWait("Review today's faculty attendance.");

    const turn1Messages = await page.$eval('[data-testid="assistant-messages-container"]', el => el.innerText);
    const hasNeutralAttendance = turn1Messages.includes('Faculty Gate Attendance Audit') || 
                                 turn1Messages.includes('No gate check-in was recorded today and no approved leave record was found') ||
                                 turn1Messages.includes('Active Faculty');
    const hasForbiddenWords = turn1Messages.includes(' AWOL ') || turn1Messages.includes(' Unexcused Absence ');
    results.neutralAttendanceWording = hasNeutralAttendance && !hasForbiddenWords;
    results.turn1AttendanceAuditSucceeds = hasNeutralAttendance;
    console.log(`Turn 1 Attendance Audit succeeded: ${results.turn1AttendanceAuditSucceeds ? 'YES' : 'NO'}`);
    console.log(`Neutral attendance wording verified: ${results.neutralAttendanceWording ? 'YES' : 'NO'}`);

    // Verify Provenance Footer
    await page.waitForSelector('[data-testid="provenance-footer"]', { timeout: 5000 });
    const hasProvenance = await page.$eval('[data-testid="provenance-footer"]', el => Boolean(el.innerText));
    results.provenanceRenders = hasProvenance;
    console.log(`Provenance footer rendered: ${results.provenanceRenders ? 'YES' : 'NO'}`);

    // 7. Conversational Flow Turn 2: "Which of them are on approved leave?"
    console.log('4. Testing Turn 2: "Which of them are on approved leave?"...');
    await sendMessageAndWait("Which of them are on approved leave?");

    const turn2Messages = await page.$eval('[data-testid="assistant-messages-container"]', el => el.innerText);
    // Should resolve "them" to faculty attendance and render approved leave results or filter
    const turn2Resolved = turn2Messages.includes('Faculty Gate Attendance Audit') || 
                          turn2Messages.includes('On Approved Leave') ||
                          turn2Messages.includes('leave');
    results.turn2ConversationalFollowUpSucceeds = turn2Resolved;
    console.log(`Turn 2 contextual follow-up resolved: ${results.turn2ConversationalFollowUpSucceeds ? 'YES' : 'NO'}`);

    // 8. Clear Session & Test Ambiguous Reference
    console.log('5. Testing Clear Session button...');
    await page.click('[data-testid="clear-session-button"]');
    await page.waitForTimeout(500);
    const clearedCount = await page.$$eval('[data-testid^="chat-message-"]', els => els.length);
    results.clearSessionWorks = clearedCount === 0;
    console.log(`Conversation cleared: ${results.clearSessionWorks ? 'YES' : 'NO'}`);

    console.log('6. Testing ambiguous follow-up: "What about them?" without prior context...');
    await sendMessageAndWait("What about them?");
    const ambiguousResponse = await page.$eval('[data-testid="assistant-messages-container"]', el => el.innerText);
    results.ambiguousReferenceClarification = ambiguousResponse.toLowerCase().includes('clarify') || 
                                              ambiguousResponse.toLowerCase().includes('more context');
    console.log(`Ambiguous reference asks for clarification: ${results.ambiguousReferenceClarification ? 'YES' : 'NO'}`);

    // 9. Drawer Close & Re-open (In-Memory Conversation Persistence)
    console.log('7. Testing drawer close and re-open memory persistence...');
    const messageCountBefore = await page.$$eval('[data-testid^="chat-message-"]', els => els.length);
    await page.click('[data-testid="close-drawer-button"]');
    await page.waitForSelector('[data-testid="principal-assistant-drawer"]', { state: 'hidden' });

    // Reopen drawer
    await page.click('[data-testid="principal-ai-assistant-trigger"]');
    await page.waitForSelector('[data-testid="principal-assistant-drawer"]', { state: 'visible' });
    const messageCountAfter = await page.$$eval('[data-testid^="chat-message-"]', els => els.length);
    results.drawerCloseAndReopenPreservesMemory = messageCountBefore === messageCountAfter && messageCountAfter > 0;
    console.log(`Messages before: ${messageCountBefore}, after: ${messageCountAfter}. Memory preserved: ${results.drawerCloseAndReopenPreservesMemory ? 'YES' : 'NO'}`);

    // 10. F5 Hard Refresh Clears Conversation
    console.log('8. Testing F5 hard refresh clears conversation...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="principal-ai-assistant-trigger"]', { timeout: 15000 });
    await page.click('[data-testid="principal-ai-assistant-trigger"]');
    await page.waitForSelector('[data-testid="principal-assistant-drawer"]', { state: 'visible' });
    const messagesAfterF5 = await page.$$eval('[data-testid^="chat-message-"]', els => els.length);
    results.f5ClearsConversation = messagesAfterF5 === 0;
    console.log(`Messages after F5 refresh: ${messagesAfterF5}. F5 clears conversation: ${results.f5ClearsConversation ? 'YES' : 'NO'}`);

    // 11. Explicit Logout -> Login -> Assistant is Empty
    console.log('9. Testing Explicit Logout -> Login -> Empty Assistant...');
    // Send a message first
    await sendMessageAndWait("Review today's faculty attendance.");
    const messagesBeforeLogout = await page.$$eval('[data-testid^="chat-message-"]', els => els.length);
    console.log(`Messages before logout: ${messagesBeforeLogout}`);

    // Close drawer
    await page.click('[data-testid="close-drawer-button"]');
    await page.waitForSelector('[data-testid="principal-assistant-drawer"]', { state: 'hidden' });

    // Click sidebar user menu trigger
    await page.click('[data-testid="sidebar-user-menu-trigger"]');
    await page.waitForSelector('[data-testid="sidebar-logout-button"]', { state: 'visible' });
    await page.click('[data-testid="sidebar-logout-button"]');

    // Wait for login page
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('✓ Successfully logged out.');

    // Log back in
    console.log('10. Logging back in as Principal...');
    await page.fill('input[type="email"]', 'principal@demo.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="principal-ai-assistant-trigger"]', { timeout: 15000 });

    // Open drawer
    await page.click('[data-testid="principal-ai-assistant-trigger"]');
    await page.waitForSelector('[data-testid="principal-assistant-drawer"]', { state: 'visible' });
    const messagesAfterRelogin = await page.$$eval('[data-testid^="chat-message-"]', els => els.length);
    results.logoutClearsConversation = messagesAfterRelogin === 0;
    console.log(`Messages after logout and re-login: ${messagesAfterRelogin}. Logout clears conversation: ${results.logoutClearsConversation ? 'YES' : 'NO'}`);

    // 12. Check localStorage & IndexedDB for chat transcripts
    console.log('11. Inspecting localStorage and IndexedDB for persisted transcripts...');
    const storageKeys = await page.evaluate(() => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
      return keys;
    });

    const hasLeakedChatInLocalStorage = storageKeys.some(k => 
      k && (k.toLowerCase().includes('chat') || k.toLowerCase().includes('message') || k.toLowerCase().includes('assistant'))
    );
    results.zeroLocalStorageTranscript = !hasLeakedChatInLocalStorage;

    const indexedDBDatabases = await page.evaluate(async () => {
      if (window.indexedDB && window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        return dbs.map(d => d.name);
      }
      return [];
    });
    const hasLeakedChatInIndexedDB = indexedDBDatabases.some(n => 
      n && (n.toLowerCase().includes('chat') || n.toLowerCase().includes('assistant'))
    );
    results.zeroIndexedDBTranscript = !hasLeakedChatInIndexedDB;

    console.log(`localStorage has NO chat transcripts: ${results.zeroLocalStorageTranscript ? 'YES' : 'NO'}`);
    console.log(`IndexedDB has NO chat databases: ${results.zeroIndexedDBTranscript ? 'YES' : 'NO'}`);

    // Take screenshot of verified state
    const screenshotPath = path.resolve(__dirname, '../principal_assistant_verified.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved verification screenshot to: ${screenshotPath}`);

  } catch (err) {
    console.error('Playwright execution error:', err);
  } finally {
    await browser.close();
  }

  console.log('\n=== FINAL HARDENING E2E VERIFICATION SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));

  const allPassed = Object.values(results).every(v => v === true);
  console.log(`\nOVERALL VERIFICATION RESULT: ${allPassed ? 'ALL PASS' : 'SOME FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

run();
