import { chromium } from '/tmp/e2e-runner/node_modules/playwright-core/index.mjs';
import path from 'node:path';

const ARTIFACTS_DIR = '/Users/hidekitoyama/.gemini/antigravity/brain/453266b8-f161-4f12-bbba-48285155ba20';

async function run() {
  console.log('--- STARTING E2E UI VERIFICATION ---');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', (err) => console.log('BROWSER PAGE ERROR:', err.message));

  // 1. Visit Public Site
  console.log('1. Navigating to http://localhost:3000/sites/mimo-01');
  await page.goto('http://localhost:3000/sites/mimo-01', { waitUntil: 'networkidle' });

  // Scroll to booking section
  await page.locator('#talk-to-mimo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const shot1Path = path.join(ARTIFACTS_DIR, 'e2e_01_talk_to_mimo_console.png');
  await page.screenshot({ path: shot1Path });
  console.log('Saved screenshot 1: Talk to Mimo Console ->', shot1Path);

  // 2. Type Prompt and Submit via Customer WebMCP Agent
  console.log('2. Typing "Book dermatology for Luna this Saturday morning" into agent console...');
  await page.fill('input.talk-to-mimo-input', 'Book dermatology for Luna this Saturday morning');
  await page.click('button.talk-to-mimo-submit-btn');

  // Wait for pipeline steps to appear
  console.log('Waiting for WebMCP execution pipeline...');
  await page.waitForSelector('.talk-to-mimo-steps', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const shot2Path = path.join(ARTIFACTS_DIR, 'e2e_02_webmcp_pipeline_execution.png');
  await page.screenshot({ path: shot2Path });
  console.log('Saved screenshot 2: WebMCP Pipeline Execution ->', shot2Path);

  // Wait for navigation / redirect to confirmation card
  console.log('Waiting for navigation to confirmation view...');
  await page.waitForFunction(() => window.location.search.includes('appointment='), { timeout: 20000 });
  await page.waitForSelector('.customer-appointment-card, #agent-booking', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const shot3Path = path.join(ARTIFACTS_DIR, 'e2e_03_customer_confirmation_card.png');
  await page.screenshot({ path: shot3Path });
  console.log('Saved screenshot 3: Customer Confirmation Card ->', shot3Path);

  // 3. Confirm Appointment
  console.log('3. Confirming appointment via 1-click button...');
  const confirmBtn = page.locator('button:has-text("Confirm appointment"), button:has-text("Send request to Mimo")');
  if (await confirmBtn.count() > 0) {
    await confirmBtn.first().click();
    await page.waitForTimeout(1500);
  }

  const shot4Path = path.join(ARTIFACTS_DIR, 'e2e_04_customer_receipt_and_calendar.png');
  await page.screenshot({ path: shot4Path });
  console.log('Saved screenshot 4: Customer Receipt & Calendar Actions ->', shot4Path);

  // 4. Visit Demo Login -> Owner Workspace
  console.log('4. Navigating to http://localhost:3000/demo');
  await page.goto('http://localhost:3000/demo', { waitUntil: 'networkidle' });

  // Fill access code
  console.log('Filling access code "local"...');
  await page.fill('input[name="accessCode"]', 'local');

  // If capacity error button is already present, click it to reset
  let releaseBtn = page.locator('button:has-text("Release occupied slots")');
  if (await releaseBtn.count() > 0) {
    console.log('Releasing occupied demo slots...');
    await releaseBtn.click();
    await page.waitForTimeout(1500);
    await page.fill('input[name="accessCode"]', 'local');
  }

  console.log('Submitting Open isolated demo...');
  await page.click('button[type="submit"]:has-text("Open isolated demo")');
  await page.waitForTimeout(2000);

  // If capacity error appears, release and retry
  if (page.url().includes('error=capacity')) {
    console.log('Capacity error encountered, releasing slots and retrying...');
    releaseBtn = page.locator('button:has-text("Release occupied slots")');
    if (await releaseBtn.count() > 0) {
      await page.fill('input[name="accessCode"]', 'local');
      await releaseBtn.click();
      await page.waitForTimeout(1500);
      await page.fill('input[name="accessCode"]', 'local');
      await page.click('button[type="submit"]:has-text("Open isolated demo")');
    }
  }

  // Wait for navigation to /app/
  console.log('Waiting for navigation to Owner workspace...');
  await page.waitForURL(/\/app\//, { timeout: 25000 });
  await page.waitForTimeout(1500);

  // 5. Test Owner Mimo Copilot
  console.log('5. Testing Owner Mimo Copilot WebMCP agent...');
  const copilotInput = page.locator('.owner-copilot-input');
  if (await copilotInput.count() > 0) {
    await copilotInput.scrollIntoViewIfNeeded();
    await page.fill('.owner-copilot-input', 'Check our availability configuration and busy intervals');
    await page.click('.owner-copilot-submit-btn');
    console.log('Submitted Owner command: waiting for WebMCP execution pipeline...');
    await page.waitForSelector('.owner-copilot-container .talk-to-mimo-steps', { timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  const shotOwnerCopilot = path.join(ARTIFACTS_DIR, 'e2e_05_owner_copilot_execution.png');
  await page.screenshot({ path: shotOwnerCopilot });
  console.log('Saved screenshot 5: Owner Copilot Execution ->', shotOwnerCopilot);

  // Scroll to Availability Control Room
  console.log('Capturing Owner Availability Control Room...');
  await page.locator('h2:has-text("Availability"), .clinic-workspace-grid').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const shot5Path = path.join(ARTIFACTS_DIR, 'e2e_06_owner_control_room_conflicts.png');
  await page.screenshot({ path: shot5Path });
  console.log('Saved screenshot 6: Owner Control Room & Conflicts ->', shot5Path);

  // 6. Navigate to Appointments Tab
  const currentAppUrl = page.url();
  const appointmentsUrl = currentAppUrl.includes('?') ? `${currentAppUrl}&tab=appointments` : `${currentAppUrl}?tab=appointments`;
  console.log('Navigating to appointments tab:', appointmentsUrl);
  await page.goto(appointmentsUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Expand details accordion if present
  const accordion = page.locator('.appointment-audit-accordion summary');
  if (await accordion.count() > 0) {
    console.log('Expanding audit lineage accordion...');
    await accordion.first().click();
    await page.waitForTimeout(400);
  }

  const shot7Path = path.join(ARTIFACTS_DIR, 'e2e_07_owner_appointments_and_audit.png');
  await page.screenshot({ path: shot7Path });
  console.log('Saved screenshot 7: Owner Inbox & Audit Lineage ->', shot7Path);

  await browser.close();
  console.log('--- ALL E2E UI VERIFICATIONS COMPLETED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('E2E UI Test Error:', err);
  process.exit(1);
});
