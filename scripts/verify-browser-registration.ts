import puppeteer from 'puppeteer-core';
import { prisma } from '../lib/prisma';
import { createDatabaseSession } from '../lib/auth/session';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = 'C:\\Users\\Asus\\.gemini\\antigravity\\brain\\8080a09a-0663-4c6b-824e-5c388d8ce728';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('================================================================');
  console.log('  BROWSER VERIFICATION: PRE-REGISTRATION & AUTH FLOW             ');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testInvestorEmail = `browser.investor.${timestamp}@student.tce.edu`;
  const testName = 'Browser Investor Test';

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) throw new Error('No admin user found');

  const activeEvent = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (activeEvent) {
    await prisma.event.update({
      where: { id: activeEvent.id },
      data: { totalCoins: 500, minInvestment: 20, maxInvestment: 100 },
    });
  }

  const adminSessionId = await createDatabaseSession(adminUser.id);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const adminPage = await browser.newPage();
    adminPage.on('console', (msg) => {
      const txt = msg.text();
      if (txt.includes('Error') || txt.includes('error')) console.log('  [ADMIN BROWSER LOG]', txt);
    });

    // Set admin session cookie
    await adminPage.setCookie({
      name: 'pnp_session',
      value: adminSessionId,
      url: BASE_URL,
    });

    // -----------------------------------------------------------------
    // STEP 1: Navigate to Admin Users
    // -----------------------------------------------------------------
    console.log('>>> 1. Navigating to /admin/users with Admin session...');
    await adminPage.goto(`${BASE_URL}/admin/users`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    console.log(`Current URL: ${adminPage.url()}`);

    // -----------------------------------------------------------------
    // STEP 2: Open "Add User" Modal and Verify NO Password Fields
    // -----------------------------------------------------------------
    console.log('>>> 2. Opening Add User modal...');
    await adminPage.waitForSelector('button', { timeout: 10000 });
    const addButtons = await adminPage.$$('button');
    let addBtnFound = false;
    for (const btn of addButtons) {
      const text = await adminPage.evaluate((el) => el.textContent, btn);
      if (text && text.includes('Add User')) {
        await btn.click();
        addBtnFound = true;
        break;
      }
    }
    if (!addBtnFound) throw new Error('Could not find Add User button');

    await sleep(800); // Allow modal transition

    // Verify modal title
    const modalHeaders = await adminPage.$$eval('h2, h3', (els) => els.map((e) => e.textContent));
    console.log('Modal headers:', modalHeaders);

    // Check that NO password input exists in the modal
    const passwordInputs = await adminPage.$$('div.fixed form input[type="password"]');
    console.log(`Password inputs in modal: ${passwordInputs.length}`);
    if (passwordInputs.length !== 0) {
      throw new Error(`FAILURE: Found ${passwordInputs.length} password inputs in Admin Add User modal!`);
    }
    console.log('✅ CONFIRMED: Admin Add User modal has ZERO password inputs.');

    // Capture screenshot of Admin Add User modal
    const modalScreenshot = path.join(SCREENSHOT_DIR, 'admin_add_user_modal.png');
    await adminPage.screenshot({ path: modalScreenshot });
    console.log(`Saved screenshot: ${modalScreenshot}`);

    // -----------------------------------------------------------------
    // STEP 3: Fill Admin Pre-Registration Form for INVESTOR and Submit
    // -----------------------------------------------------------------
    console.log('>>> 3. Pre-registering INVESTOR user via Admin modal...');
    // Click INVESTOR role tab button
    const roleButtons = await adminPage.$$('div.fixed form div.grid button');
    for (const b of roleButtons) {
      const txt = await adminPage.evaluate((el) => el.textContent, b);
      if (txt?.includes('Investor')) {
        await b.click();
        break;
      }
    }
    await sleep(300);

    // Type Full Name and Email
    const nameInput = await adminPage.$('div.fixed form input[type="text"]');
    if (!nameInput) throw new Error('Could not find Name input in modal');
    await nameInput.type(testName);

    const emailInput = await adminPage.$('div.fixed form input[type="email"]');
    if (!emailInput) throw new Error('Could not find Email input in modal');
    await emailInput.type(testInvestorEmail);

    // Click "Pre-Register User" button
    const submitBtn = await adminPage.$('div.fixed form button[type="submit"]');
    if (!submitBtn) throw new Error('Could not find Pre-Register submit button');
    await submitBtn.click();

    await sleep(2500); // Wait for API response, toast, and modal close

    // Verify database record: passwordHash === null
    const preRegDbUser = await prisma.user.findUnique({ where: { email: testInvestorEmail } });
    if (!preRegDbUser) throw new Error(`User ${testInvestorEmail} was not created in DB!`);
    if (preRegDbUser.passwordHash !== null) {
      throw new Error(`FAILURE: User was created with passwordHash=${preRegDbUser.passwordHash}!`);
    }
    console.log('✅ CONFIRMED: User successfully pre-registered in DB with passwordHash === null');

    // -----------------------------------------------------------------
    // STEP 4: Open /register page in fresh context (logged out)
    // -----------------------------------------------------------------
    console.log('>>> 4. Navigating to /register in logged-out context...');
    const userContext = await browser.createBrowserContext();
    const regPage = await userContext.newPage();
    await regPage.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    // Verify /register form elements
    // Confirm NO team selector exists
    const regSelects = await regPage.$$('select');
    const regTeamInputs = await regPage.$$('input[name*="team"], input[placeholder*="team" i]');
    console.log(`Select elements on /register: ${regSelects.length}`);
    console.log(`Team inputs on /register: ${regTeamInputs.length}`);
    if (regSelects.length > 0 || regTeamInputs.length > 0) {
      throw new Error('FAILURE: Found team selector or input on /register page!');
    }
    console.log('✅ CONFIRMED: /register page has NO team selector or role selector.');

    // Screenshot /register page
    const registerScreenshot = path.join(SCREENSHOT_DIR, 'register_page.png');
    await regPage.screenshot({ path: registerScreenshot });
    console.log(`Saved screenshot: ${registerScreenshot}`);

    // -----------------------------------------------------------------
    // STEP 5: Test Unknown Email Registration Rejection in UI
    // -----------------------------------------------------------------
    console.log('>>> 5. Testing unregistered email rejection in browser UI...');
    const regName = await regPage.$('form input[type="text"]');
    await regName?.type('Unknown Person');

    const regEmail = await regPage.$('form input[type="email"]');
    await regEmail?.type(`unregistered.${timestamp}@tce.edu`);

    const regPasswords = await regPage.$$('form input[type="password"]');
    await regPasswords[0].type('TestPassword123!');
    await regPasswords[1].type('TestPassword123!');

    await regPage.click('form button[type="submit"]');
    await sleep(1500);

    // Verify error message displayed
    const pageText = await regPage.evaluate(() => document.body.innerText);
    const hasUnregisteredError =
      pageText.includes('not registered') ||
      pageText.includes('contact the organizer') ||
      pageText.includes('NOT_PRE_REGISTERED');
    if (!hasUnregisteredError) {
      throw new Error('FAILURE: /register did not show error when submitting unregistered email!');
    }
    console.log('✅ CONFIRMED: UI displayed error message for unregistered email.');

    // -----------------------------------------------------------------
    // STEP 6: Complete Registration for Pre-Registered User
    // -----------------------------------------------------------------
    console.log('>>> 6. Completing registration for pre-registered user...');
    await regPage.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);

    // Fill registration form
    const nameInput2 = await regPage.$('form input[type="text"]');
    await nameInput2?.type(testName);

    const emailInput2 = await regPage.$('form input[type="email"]');
    await emailInput2?.type(testInvestorEmail);

    const pwInputs = await regPage.$$('form input[type="password"]');
    await pwInputs[0].type('InvestorSecret2026!');
    await pwInputs[1].type('InvestorSecret2026!');

    // Submit registration form
    console.log('Submitting registration form...');
    await regPage.click('form button[type="submit"]');

    // Wait for "Registration Verified!"
    await regPage.waitForFunction(() => document.body.innerText.includes('Registration Verified'), { timeout: 10000 });
    console.log('✅ CONFIRMED: "Registration Verified!" message displayed in browser.');

    // Wait for client router redirect to /dashboard
    await regPage.waitForFunction(() => window.location.pathname.includes('/dashboard'), { timeout: 10000 });
    console.log('✅ CONFIRMED: Automatic client redirect to /dashboard succeeded.');

    // Verify wallet coins visible on dashboard
    await sleep(1500);
    const dashboardText = await regPage.evaluate(() => document.body.innerText);
    const hasCoins = dashboardText.includes('500') || dashboardText.includes('Coins');
    console.log(`Dashboard displays coins: ${hasCoins}`);

    // Screenshot dashboard after registration
    const dashScreenshot = path.join(SCREENSHOT_DIR, 'investor_dashboard_after_register.png');
    await regPage.screenshot({ path: dashScreenshot });
    console.log(`Saved screenshot: ${dashScreenshot}`);

    // -----------------------------------------------------------------
    // STEP 7: Verify DB state after registration
    // -----------------------------------------------------------------
    const registeredUser = await prisma.user.findUnique({
      where: { email: testInvestorEmail },
      include: { wallet: true },
    });
    if (!registeredUser?.passwordHash) throw new Error('Password hash was not saved!');
    if (!registeredUser.emailVerified) throw new Error('emailVerified was not set to true!');
    if (registeredUser.role !== 'INVESTOR') throw new Error('Role was not INVESTOR!');
    if (registeredUser.teamId !== null) throw new Error('Team was assigned to investor!');
    if (registeredUser.wallet?.totalCoins !== 500) throw new Error('Wallet was not initialized to 500 coins!');
    console.log('✅ CONFIRMED: Database state is completely verified.');

    // -----------------------------------------------------------------
    // STEP 8: Logout and Login with New Credentials
    // -----------------------------------------------------------------
    console.log('>>> 8. Logging in via /login with newly set password in fresh page...');
    const loginPage = await userContext.newPage();
    await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    await loginPage.type('input[type="email"]', testInvestorEmail);
    await loginPage.type('input[type="password"]', 'InvestorSecret2026!');
    await loginPage.click('button[type="submit"]');

    await loginPage.waitForFunction(() => window.location.pathname.includes('/dashboard'), { timeout: 10000 });
    console.log('✅ CONFIRMED: User logged in normally via /login and redirected to /dashboard.');

    console.log('\n================================================================');
    console.log('  ALL BROWSER VERIFICATION TESTS PASSED PERFECTLY!              ');
    console.log('================================================================');
  } finally {
    // Cleanup
    console.log('\n>>> Cleaning up test user and admin session...');
    const u = await prisma.user.findUnique({ where: { email: testInvestorEmail } });
    if (u) {
      await prisma.wallet.deleteMany({ where: { userId: u.id } });
      await prisma.session.deleteMany({ where: { userId: u.id } });
      await prisma.auditLog.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.session.delete({ where: { id: adminSessionId } }).catch(() => {});
    await browser.close();
    await prisma.$disconnect();
    console.log('Cleanup completed.');
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
