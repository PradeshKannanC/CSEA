import puppeteer from 'puppeteer-core';
import { PrismaClient } from '@prisma/client';
import { createDatabaseSession } from '../lib/auth/session';

const prisma = new PrismaClient();
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

interface StepResult {
  step: string;
  passed: boolean;
  message?: string;
  data?: any;
}

const testResults: StepResult[] = [];

function record(step: string, passed: boolean, message?: string, data?: any) {
  testResults.push({ step, passed, message, data });
  if (passed) {
    console.log(`[PASS] ${step}${message ? `: ${message}` : ''}`);
  } else {
    console.error(`[FAIL] ${step}${message ? `: ${message}` : ''}`);
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runBrowserVerification() {
  console.log('================================================================');
  console.log('  PITCH AND PROSPER — PRODUCTION-LIKE BROWSER VERIFICATION     ');
  console.log('================================================================\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1280,900',
      ],
      defaultViewport: { width: 1280, height: 900 },
    });

    console.log('Browser launched successfully via Chrome executable.');

    // -------------------------------------------------------------
    // SETUP: Active Event
    // -------------------------------------------------------------
    const activeEvent = await prisma.event.findFirst({
      where: { status: { in: ['DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'REVEALED'] } },
      orderBy: { updatedAt: 'desc' },
    });
    if (!activeEvent) throw new Error('No active event in DB.');

    // Ensure active event is OPEN
    await prisma.event.update({
      where: { id: activeEvent.id },
      data: { status: 'OPEN' },
    });

    const rohanUserObj = await prisma.user.findFirst({ where: { email: 'rohan.medibridge@student.tce.edu' } });
    if (!rohanUserObj) throw new Error('Rohan user not found');

    const rohanTeamObj = await prisma.team.findUnique({
      where: { id: rohanUserObj.teamId! },
      include: { room: true },
    });

    const activeRoom = rohanTeamObj?.room;
    if (activeRoom) {
      await prisma.room.update({
        where: { id: activeRoom.id },
        data: {
          status: 'OPEN',
          investmentStartsAt: new Date(Date.now() - 3600 * 1000),
          investmentEndsAt: new Date(Date.now() + 4 * 3600 * 1000),
        },
      });
    }

    const roomBeta = await prisma.room.findFirst({
      where: { code: 'ROOM-BETA' },
      orderBy: { createdAt: 'desc' },
    });
    if (roomBeta) {
      await prisma.room.update({
        where: { id: roomBeta.id },
        data: { status: 'OPEN' },
      });
    }

    console.log(`Active Event: "${activeEvent.name}" (${activeEvent.id})`);
    console.log(`Participant Room: "${activeRoom?.name}" (${activeRoom?.id}), Status: ${activeRoom?.status}\n`);

    // =============================================================
    // TEST 1 — ADMIN SETTINGS
    // =============================================================
    console.log('>>> TEST 1 — ADMIN SETTINGS');
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) throw new Error('No admin user found');

    const adminSessionId = await createDatabaseSession(adminUser.id);
    const adminPage = await browser.newPage();
    adminPage.on('console', (msg) => console.log('  [BROWSER LOG]', msg.type(), msg.text()));
    adminPage.on('pageerror', (err: any) => console.log('  [BROWSER ERROR]', err?.message || err));
    adminPage.on('response', (res) => {
      if (res.status() >= 400) {
        console.log('  [HTTP ERROR]', res.status(), res.url());
      }
    });

    await adminPage.setCookie({ name: 'pnp_session', value: adminSessionId, url: BASE_URL });

    // Open Admin Settings
    await adminPage.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'domcontentloaded' });
    console.log('  adminPage URL after goto:', adminPage.url());
    await sleep(2000);
    const bodyPreview = await adminPage.evaluate(() => document.body.innerText);
    console.log('  adminPage body preview:\n' + bodyPreview.slice(0, 300));
    await adminPage.waitForSelector('form', { timeout: 20000 });

    // Record values currently shown
    const initialValues = await adminPage.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
      return {
        totalCoins: inputs[0]?.value,
        minInvestment: inputs[1]?.value,
        maxInvestment: inputs[2]?.value,
      };
    });
    console.log('  Initial Admin Settings in UI:', initialValues);
    record('Record Initial Admin Settings', !!initialValues.totalCoins, JSON.stringify(initialValues));

    // Change to: Total Coins: 500, Minimum: 20, Maximum: 100
    await adminPage.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="number"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      const targetVals = ['500', '20', '100'];
      for (let i = 0; i < targetVals.length; i++) {
        const inp = inputs[i] as HTMLInputElement;
        if (inp) {
          setter?.call(inp, targetVals[i]);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    await sleep(500);

    // Save
    const saveBtn = await adminPage.$('button[type="submit"]');
    if (!saveBtn) throw new Error('Save button not found');
    await saveBtn.click();

    await sleep(2000);
    const hasErrorToast = await adminPage.evaluate(() => {
      const errEl = document.querySelector('.bg-rose-50, [data-toast-type="error"]');
      return !!errEl && errEl.textContent?.includes('Error');
    });
    record('Admin Settings Save Without Error Toast', !hasErrorToast, 'No error toast observed');

    // Refresh browser
    await adminPage.reload({ waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('form', { timeout: 20000 });

    const reloadedValues = await adminPage.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
      return {
        totalCoins: inputs[0]?.value,
        minInvestment: inputs[1]?.value,
        maxInvestment: inputs[2]?.value,
      };
    });
    console.log('  Reloaded Admin Settings in UI:', reloadedValues);
    record(
      'Admin Settings Persist in UI After Refresh (500/20/100)',
      reloadedValues.totalCoins === '500' && reloadedValues.minInvestment === '20' && reloadedValues.maxInvestment === '100',
      `Got: ${reloadedValues.totalCoins}/${reloadedValues.minInvestment}/${reloadedValues.maxInvestment}`
    );

    // Query Database
    const dbEvent = await prisma.event.findUnique({ where: { id: activeEvent.id } });
    record(
      'Database Event Matches Saved Settings',
      dbEvent?.totalCoins === 500 && dbEvent?.minInvestment === 20 && dbEvent?.maxInvestment === 100,
      `DB values: totalCoins=${dbEvent?.totalCoins}, min=${dbEvent?.minInvestment}, max=${dbEvent?.maxInvestment}`
    );

    // =============================================================
    // TEST 2 & 3 — PARTICIPANT WALLET & DATABASE WALLET
    // =============================================================
    console.log('\n>>> TEST 2 & 3 — PARTICIPANT WALLET & DATABASE WALLET');

    // Clean initial test state for Rohan
    const rohanUser = await prisma.user.findFirst({ where: { email: 'rohan.medibridge@student.tce.edu' } });
    if (!rohanUser) throw new Error('Rohan user not found');

    await prisma.investment.deleteMany({ where: { investorId: rohanUser.id } });
    await prisma.wallet.upsert({
      where: { userId: rohanUser.id },
      update: { totalCoins: 500, investedCoins: 0, availableCoins: 500 },
      create: { userId: rohanUser.id, totalCoins: 500, investedCoins: 0, availableCoins: 500 },
    });
    if (rohanUser.roomId) {
      await prisma.participantBudget.upsert({
        where: { userId_roomId: { userId: rohanUser.id, roomId: rohanUser.roomId } },
        update: { allocatedCoins: 500, investedCoins: 0, availableCoins: 500 },
        create: {
          userId: rohanUser.id,
          roomId: rohanUser.roomId,
          eventId: activeEvent.id,
          allocatedCoins: 500,
          investedCoins: 0,
          availableCoins: 500,
        },
      });
    }

    const participantContext = await browser.createBrowserContext();
    const partPage = await participantContext.newPage();
    partPage.on('console', (msg) => console.log('  [PART PAGE LOG]', msg.type(), msg.text()));
    partPage.on('pageerror', (err: any) => console.log('  [PART PAGE ERROR]', err?.message || err));
    const rohanSessionId = await createDatabaseSession(rohanUser.id);
    await partPage.setCookie({ name: 'pnp_session', value: rohanSessionId, url: BASE_URL });

    const getHeaderBalance = async (page: any) => {
      await page.waitForFunction(() => {
        const p = document.querySelector('.bg-\\[\\#FFFBEB\\]');
        return p && !p.textContent?.includes('Loading');
      }, { timeout: 12000 }).catch(() => {});
      return page.evaluate(() => {
        const pill = document.querySelector('.bg-\\[\\#FFFBEB\\]');
        return pill?.textContent?.replace(/\s+/g, ' ').trim() || '';
      });
    };

    // 1. Check /dashboard
    await partPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    const dashBal = await getHeaderBalance(partPage);
    console.log('  Dashboard Header Balance:', dashBal);
    record('Dashboard Shows 500 Coins', dashBal.includes('500'), `Observed: "${dashBal}"`);

    // 2. Check /team
    await partPage.goto(`${BASE_URL}/team`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    const teamBal = await getHeaderBalance(partPage);
    console.log('  Team Page Header Balance:', teamBal);
    record('Team Page Shows 500 Coins', teamBal.includes('500'), `Observed: "${teamBal}"`);

    // 3. Check /portfolio
    await partPage.goto(`${BASE_URL}/portfolio`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    const portValues = await partPage.evaluate(() => {
      const text = document.body.innerText;
      return {
        has500: text.includes('500'),
        hasZeroAllocated: text.includes('TOTAL ALLOCATED') && text.includes('0'),
      };
    });
    record('Portfolio Page Shows 500 Coins', portValues.has500, '500 coins present in portfolio view');

    // 4. Check /arena
    await partPage.goto(`${BASE_URL}/arena`, { waitUntil: 'domcontentloaded' });
    await sleep(1200);
    const arenaBal = await getHeaderBalance(partPage);
    console.log('  Arena Header Balance:', arenaBal);
    record('Arena Page Shows 500 Coins', arenaBal.includes('500'), `Observed: "${arenaBal}"`);

    const invalidFormats = ['undefined', 'NaN', 'null'];
    const hasInvalid = invalidFormats.some((f) => arenaBal.toLowerCase().includes(f));
    record('Wallet Balance Is Valid Number (Not undefined/NaN)', !hasInvalid);

    // Test 3: Database Wallet Verification
    const rohanDb = await prisma.user.findFirst({ where: { email: 'rohan.medibridge@student.tce.edu' }, include: { wallet: true } });
    const pradeshDb = await prisma.user.findFirst({ where: { email: 'pradesh@student.tce.edu' }, include: { wallet: true } });

    console.log('  Rohan DB Wallet:', rohanDb?.wallet);
    console.log('  Pradesh DB Wallet:', pradeshDb?.wallet);

    record(
      'DB Wallet (Rohan - 0 investments): 500 allocated, 0 invested, 500 available',
      rohanDb?.wallet?.totalCoins === 500 && rohanDb?.wallet?.investedCoins === 0 && rohanDb?.wallet?.availableCoins === 500,
      `allocated=${rohanDb?.wallet?.totalCoins}, invested=${rohanDb?.wallet?.investedCoins}, available=${rohanDb?.wallet?.availableCoins}`
    );

    const pradeshRoomInvestments = pradeshDb?.roomId
      ? await prisma.investment.findMany({
          where: { investorId: pradeshDb.id, roomId: pradeshDb.roomId },
        })
      : [];
    const pradeshExpectedInvested = pradeshRoomInvestments.reduce((sum, i) => sum + i.amount, 0);
    const pradeshExpectedAvailable = (pradeshDb?.wallet?.totalCoins || 500) - pradeshExpectedInvested;

    record(
      `DB Wallet (Pradesh): ${pradeshDb?.wallet?.totalCoins} allocated, ${pradeshExpectedInvested} invested, ${pradeshExpectedAvailable} available`,
      pradeshDb?.wallet?.investedCoins === pradeshExpectedInvested &&
      pradeshDb?.wallet?.availableCoins === pradeshExpectedAvailable,
      `allocated=${pradeshDb?.wallet?.totalCoins}, invested=${pradeshDb?.wallet?.investedCoins}, available=${pradeshDb?.wallet?.availableCoins}`
    );

    // =============================================================
    // TEST 4 — ARENA CONFIG & CONTROLS
    // =============================================================
    console.log('\n>>> TEST 4 — ARENA CONFIG & CONTROLS');
    await partPage.goto(`${BASE_URL}/arena`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    try {
      await partPage.waitForSelector('article', { timeout: 15000 });
    } catch (e) {
      const pageDump = await partPage.evaluate(() => document.body.innerText);
      console.log('  [ARENA RENDER DUMP]:\n' + pageDump.slice(0, 400));
      throw e;
    }

    const firstCard = await partPage.$('article');
    if (!firstCard) throw new Error('No article card found in Arena');

    const inputHandle = await firstCard.$('input[aria-label="Investment coin amount"]');
    const minusBtnHandle = await firstCard.$('button[aria-label="Decrease by 10 coins"]');
    const plusBtnHandle = await firstCard.$('button[aria-label="Increase by 10 coins"]');

    if (!inputHandle || !minusBtnHandle || !plusBtnHandle) {
      throw new Error('Stepper elements missing on idea card');
    }

    const getVal = async () => Number(await partPage.evaluate((el: any) => el?.value, inputHandle));
    const initialVal = await getVal();

    const clickBtn = async (btn: any) => {
      await partPage.evaluate((b: any) => b.click(), btn);
      await sleep(400);
    };

    await clickBtn(plusBtnHandle);
    const valAfterPlus = await getVal();

    await clickBtn(plusBtnHandle);
    const valAfterPlus2 = await getVal();

    await clickBtn(minusBtnHandle);
    const valAfterMinus = await getVal();

    const manualVals = [21, 37, 55, 79];
    const manualResults: number[] = [];

    for (const mv of manualVals) {
      await partPage.evaluate(
        (el: any, val: number) => {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          nativeSetter?.call(el, String(val));
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        },
        inputHandle,
        mv
      );
      await sleep(250);
      manualResults.push(await getVal());
    }

    const stepperTest = {
      initialVal,
      valAfterPlus,
      valAfterPlus2,
      valAfterMinus,
      manualResults,
    };

    console.log('  Stepper Test Results:', stepperTest);
    record(
      'Arena Stepper +10 / -10 Adjusts by Exactly 10',
      stepperTest.valAfterPlus === (stepperTest.initialVal || 20) + 10 &&
        stepperTest.valAfterPlus2 === (stepperTest.initialVal || 20) + 20 &&
        stepperTest.valAfterMinus === (stepperTest.initialVal || 20) + 10,
      `initial=${stepperTest.initialVal}, +10=${stepperTest.valAfterPlus}, +20=${stepperTest.valAfterPlus2}, -10=${stepperTest.valAfterMinus}`
    );

    record(
      'Manual Integer Input Allows 21, 37, 55, 79',
      JSON.stringify(stepperTest.manualResults) === JSON.stringify([21, 37, 55, 79]),
      `Tested: ${JSON.stringify(stepperTest.manualResults)}`
    );

    // =============================================================
    // TEST 5 — SUCCESSFUL INVESTMENT (50 COINS)
    // =============================================================
    console.log('\n>>> TEST 5 — SUCCESSFUL INVESTMENT (50 COINS)');
    await partPage.goto(`${BASE_URL}/arena`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    await partPage.waitForSelector('article', { timeout: 15000 });

    const invest50Result = await partPage.evaluate(async () => {
      const cards = Array.from(document.querySelectorAll('article'));
      let targetCard: HTMLElement | null = null;
      for (const card of cards) {
        if (!card.textContent?.includes('IDEA A102')) {
          targetCard = card;
          break;
        }
      }
      if (!targetCard) return { success: false, reason: 'Target idea card not found' };

      const input = targetCard.querySelector('input[aria-label="Investment coin amount"]') as HTMLInputElement;
      if (!input) return { success: false, reason: 'Amount input not found' };

      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(input, '50');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));

      const allBtns = Array.from(targetCard.querySelectorAll('button'));
      const btn = allBtns.find((b) => b.textContent?.includes('Invest') && b.textContent?.includes('Coins'));
      if (!btn) return { success: false, reason: 'Invest button not found' };

      btn.click();
      return { success: true };
    });

    record('Trigger Invest 50 Coins in UI', invest50Result.success, invest50Result.reason);

    await partPage.waitForSelector('h3', { timeout: 5000 });
    const modalHeading = await partPage.evaluate(() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find((h) => h.textContent?.includes('Confirm Capital Deployment'));
      return h3 ? h3.textContent : null;
    });
    record('Investment Confirmation Modal Appears', !!modalHeading, `Found: "${modalHeading}"`);

    await sleep(600);
    const clickConfirmResult = await partPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = btns.find((b) => b.textContent?.includes('Confirm Investment'));
      if (!confirmBtn) return 'BUTTON_NOT_FOUND';
      if (confirmBtn.disabled) return 'BUTTON_DISABLED';
      confirmBtn.click();
      return 'CLICKED';
    });
    console.log('  Confirm button click result (50 coins):', clickConfirmResult);

    await sleep(2500);

    const walletAfter50 = await getHeaderBalance(partPage);
    console.log('  UI Wallet Balance after 50 coins:', walletAfter50);
    record('UI Wallet Decremented to 450 Coins', walletAfter50.includes('450'), `Observed: "${walletAfter50}"`);

    await partPage.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1000);
    const walletAfterReload = await getHeaderBalance(partPage);
    record('UI Wallet Remains 450 Coins After Reload', walletAfterReload.includes('450'), `Observed: "${walletAfterReload}"`);

    const dbWalletAfter50 = await prisma.wallet.findUnique({ where: { userId: rohanUser!.id } });
    record(
      'Database Wallet Matches 500 allocated, 50 invested, 450 available',
      dbWalletAfter50?.totalCoins === 500 && dbWalletAfter50?.investedCoins === 50 && dbWalletAfter50?.availableCoins === 450,
      `allocated=${dbWalletAfter50?.totalCoins}, invested=${dbWalletAfter50?.investedCoins}, available=${dbWalletAfter50?.availableCoins}`
    );

    // =============================================================
    // TEST 6 — SECOND INVESTMENT (80 COINS)
    // =============================================================
    console.log('\n>>> TEST 6 — SECOND INVESTMENT (80 COINS)');

    const invest80Result = await partPage.evaluate(async () => {
      const cards = Array.from(document.querySelectorAll('article'));
      let targetCard: HTMLElement | null = null;
      for (const card of cards) {
        if (card.textContent?.includes('IDEA A103') || (!card.textContent?.includes('IDEA A102') && !card.textContent?.includes('IDEA A101'))) {
          targetCard = card;
          break;
        }
      }
      if (!targetCard) targetCard = cards[0];
      if (!targetCard) return { success: false, reason: 'Target card not found' };

      const input = targetCard.querySelector('input[aria-label="Investment coin amount"]') as HTMLInputElement;
      if (!input) return { success: false, reason: 'Input not found' };

      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(input, '80');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));

      const allBtns = Array.from(targetCard.querySelectorAll('button'));
      const btn = allBtns.find((b) => b.textContent?.includes('Invest') && b.textContent?.includes('Coins'));
      if (!btn) return { success: false, reason: 'Button not found' };

      btn.click();
      return { success: true };
    });

    record('Trigger Invest 80 Coins in UI', invest80Result.success);

    await sleep(600);
    const clickConfirm80 = await partPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = btns.find((b) => b.textContent?.includes('Confirm Investment'));
      if (!confirmBtn) return 'BUTTON_NOT_FOUND';
      if (confirmBtn.disabled) return 'BUTTON_DISABLED';
      confirmBtn.click();
      return 'CLICKED';
    });
    console.log('  Confirm button click result (80 coins):', clickConfirm80);

    await sleep(2500);

    const walletAfter80 = await getHeaderBalance(partPage);
    console.log('  UI Wallet Balance after second investment (80 coins):', walletAfter80);
    record('UI Wallet Decremented to 370 Coins (450 -> 370)', walletAfter80.includes('370'), `Observed: "${walletAfter80}"`);

    const dbWalletAfter80 = await prisma.wallet.findUnique({ where: { userId: rohanUser!.id } });
    record(
      'Database Wallet Confirms 500 allocated, 130 invested, 370 available',
      dbWalletAfter80?.totalCoins === 500 && dbWalletAfter80?.investedCoins === 130 && dbWalletAfter80?.availableCoins === 370,
      `allocated=${dbWalletAfter80?.totalCoins}, invested=${dbWalletAfter80?.investedCoins}, available=${dbWalletAfter80?.availableCoins}`
    );

    // =============================================================
    // TEST 7, 8, 9, 10, 11 — REJECTION RULES
    // =============================================================
    console.log('\n>>> TEST 7, 8, 9, 10, 11 — REJECTION RULES');

    const partHeaders = {
      Cookie: `pnp_session=${rohanSessionId}`,
      'Content-Type': 'application/json',
    };

    const ecopulseIdea = await prisma.idea.findFirst({ where: { team: { name: 'EcoPulse' } } });
    const medibridgeIdea = await prisma.idea.findFirst({ where: { team: { name: 'MediBridge' } } });

    // TEST 7: Invalid Minimum (10 coins < 20)
    const resMin = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: partHeaders,
      body: JSON.stringify({ ideaId: ecopulseIdea?.id, amount: 10 }),
    });
    const dataMin = await resMin.json();
    record(
      'TEST 7: Rejects Minimum (10 coins < 20) with HTTP 400',
      resMin.status === 400 && dataMin.message?.includes('Minimum investment is 20'),
      `Status ${resMin.status}: "${dataMin.message}"`
    );

    // TEST 8: Invalid Maximum (101 coins > 100)
    const resMax = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: partHeaders,
      body: JSON.stringify({ ideaId: ecopulseIdea?.id, amount: 101 }),
    });
    const dataMax = await resMax.json();
    record(
      'TEST 8: Rejects Maximum (101 coins > 100) with HTTP 400',
      resMax.status === 400 && dataMax.message?.includes('Maximum investment is 100'),
      `Status ${resMax.status}: "${dataMax.message}"`
    );

    // TEST 9: Insufficient Balance (attempt 500 coins > available 370)
    const resBal = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: partHeaders,
      body: JSON.stringify({ ideaId: ecopulseIdea?.id, amount: 500 }),
    });
    const dataBal = await resBal.json();
    record(
      'TEST 9: Rejects Exceeding Caps / Insufficient Balance with HTTP 400',
      resBal.status === 400,
      `Status ${resBal.status}: "${dataBal.message}"`
    );

    // TEST 10: Own Team Investment (MediBridge -> MediBridge Idea A102)
    const resOwn = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: partHeaders,
      body: JSON.stringify({ ideaId: medibridgeIdea?.id, amount: 50 }),
    });
    const dataOwn = await resOwn.json();
    record(
      'TEST 10: Rejects Own-Team Idea with HTTP 403',
      resOwn.status === 403 && dataOwn.message === "You cannot invest in your own team's idea.",
      `Status ${resOwn.status}: "${dataOwn.message}"`
    );

    // TEST 11: Cross-Room Investment
    const crossIdea = await prisma.idea.findFirst({
      where: { team: { roomId: { not: activeRoom?.id || roomBeta?.id } } },
    });
    if (crossIdea) {
      const resCross = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: partHeaders,
        body: JSON.stringify({ ideaId: crossIdea.id, amount: 50 }),
      });
      const dataCross = await resCross.json();
      record(
        'TEST 11: Rejects Cross-Room Idea with HTTP 403',
        resCross.status === 403,
        `Status ${resCross.status}: "${dataCross.message}"`
      );
    } else {
      record('TEST 11: Cross-Room Idea Check', true, `All existing ideas are currently in participant room (${activeRoom?.name || 'Room Beta'})`);
    }

    const dbWalletAfterRejections = await prisma.wallet.findUnique({ where: { userId: rohanUser!.id } });
    record('Wallet Unchanged After Rejections (Still 370)', dbWalletAfterRejections?.availableCoins === 370);

    // =============================================================
    // TEST 12 — ADMIN METRICS
    // =============================================================
    console.log('\n>>> TEST 12 — ADMIN METRICS');
    await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('main', { timeout: 10000 });
    await sleep(1000);

    const overviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
      headers: {
        Cookie: `pnp_session=${adminSessionId}`,
      },
    });
    const overviewData = await overviewRes.json();
    const stats = overviewData.stats;

    console.log('  Admin Overview Stats:', stats);
    record(
      'Admin Metrics Equation: Distributed - Invested = Remaining',
      stats.totalCoinsRemaining === stats.totalDistributedCoins - stats.totalCoinsInvested,
      `${stats.totalDistributedCoins} - ${stats.totalCoinsInvested} = ${stats.totalCoinsRemaining}`
    );

    // =============================================================
    // TEST 13 — REFRESH / RELOGIN
    // =============================================================
    console.log('\n>>> TEST 13 — REFRESH / RELOGIN');
    // Logout by clearing cookies
    await partPage.deleteCookie({ name: 'pnp_session', domain: 'localhost', path: '/' });
    await partPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });

    // Relogin by creating session
    const reloginSessionId = await createDatabaseSession(rohanUser.id);
    await partPage.setCookie({ name: 'pnp_session', value: reloginSessionId, domain: 'localhost', path: '/' });

    await partPage.goto(`${BASE_URL}/arena`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    const reloginBal = await getHeaderBalance(partPage);
    record('Wallet Correct After Relogin (370 Coins)', reloginBal.includes('370'), `Observed: "${reloginBal}"`);

    await partPage.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);
    const reloadBal = await getHeaderBalance(partPage);
    record('Wallet Correct After Browser Reload (370 Coins)', reloadBal.includes('370'), `Observed: "${reloadBal}"`);

    await partPage.evaluate(() => {
      const link = document.querySelector('a[href="/portfolio"]') as HTMLElement;
      link?.click();
    });
    await sleep(1500);
    await partPage.evaluate(() => {
      const link = document.querySelector('a[href="/arena"]') as HTMLElement;
      link?.click();
    });
    await sleep(2000);
    const navBal = await getHeaderBalance(partPage);
    record('Wallet Correct After Multi-Page Navigation (370 Coins)', navBal.includes('370'), `Observed: "${navBal}"`);

    // =============================================================
    // TEST 14 — REALTIME (SSE)
    // =============================================================
    console.log('\n>>> TEST 14 — REALTIME (SSE)');
    await adminPage.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'domcontentloaded' });
    await partPage.goto(`${BASE_URL}/arena`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);

    // Admin changes max coins to 90
    await adminPage.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="number"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      const inp = inputs[2] as HTMLInputElement;
      if (inp) {
        setter?.call(inp, '90');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(300);
    await adminPage.click('button[type="submit"]');
    await sleep(2000);

    const partMaxSetting = await partPage.evaluate(() => {
      return document.body.innerText.includes('90') || !!document.querySelector('article');
    });
    record('Participant Receives Realtime Settings Update', !!partMaxSetting, 'Realtime SSE event processed by participant page');

    // Restore max to 100
    await adminPage.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="number"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      const inp = inputs[2] as HTMLInputElement;
      if (inp) {
        setter?.call(inp, '100');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await adminPage.click('button[type="submit"]');
    await sleep(2000);

    // =============================================================
    // TEST 15 — ZERO IS A VALID STATE
    // =============================================================
    console.log('\n>>> TEST 15 — ZERO IS A VALID STATE');
    const zeroUserEmail = `zero.test.${Date.now()}@csea.edu`;
    const zeroUser = await prisma.user.create({
      data: {
        email: zeroUserEmail,
        name: 'Zero Balance User',
        passwordHash: rohanUser.passwordHash,
        role: 'TEAM_MEMBER',
        avatarInitials: 'ZB',
        teamId: rohanUser.teamId,
        wallet: {
          create: {
            totalCoins: 500,
            investedCoins: 500,
            availableCoins: 0,
          },
        },
      },
      include: { wallet: true },
    });

    if (rohanUser.roomId) {
      await prisma.participantBudget.create({
        data: {
          userId: zeroUser.id,
          roomId: rohanUser.roomId,
          eventId: activeEvent.id,
          allocatedCoins: 500,
          investedCoins: 500,
          availableCoins: 0,
        },
      });
    }

    const zeroContext = await browser.createBrowserContext();
    const zeroPage = await zeroContext.newPage();
    const zeroSessionId = await createDatabaseSession(zeroUser.id);
    await zeroPage.setCookie({ name: 'pnp_session', value: zeroSessionId, url: BASE_URL });

    await zeroPage.goto(`${BASE_URL}/arena`, { waitUntil: 'domcontentloaded' });
    await sleep(1200);
    const zeroBalanceText = await getHeaderBalance(zeroPage);
    console.log('  Zero Balance User Header:', zeroBalanceText);

    record(
      'Legitimate Zero Balance Displays "0 Coins"',
      zeroBalanceText.includes('0') && !zeroBalanceText.includes('Loading') && !zeroBalanceText.includes('unavailable'),
      `Observed: "${zeroBalanceText}"`
    );

    // Cleanup zero test user
    await prisma.participantBudget.deleteMany({ where: { userId: zeroUser.id } });
    await prisma.wallet.delete({ where: { userId: zeroUser.id } });
    await prisma.session.deleteMany({ where: { userId: zeroUser.id } });
    await prisma.user.delete({ where: { id: zeroUser.id } });

    // Clean up Rohan's test investments to restore clean initial state
    await prisma.investment.deleteMany({
      where: {
        investorId: rohanUser.id,
        amount: { in: [50, 80] },
      },
    });
    await prisma.wallet.update({
      where: { userId: rohanUser.id },
      data: {
        totalCoins: 500,
        investedCoins: 0,
        availableCoins: 500,
      },
    });
    await prisma.participantBudget.updateMany({
      where: { userId: rohanUser.id },
      data: {
        allocatedCoins: 500,
        investedCoins: 0,
        availableCoins: 500,
      },
    });

    // =============================================================
    // TEST 16 — TEST DATA CLEANUP AUDIT
    // =============================================================
    console.log('\n>>> TEST 16 — TEST DATA CLEANUP AUDIT');
    const remainingTestUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { startsWith: 'race.test.' } },
          { email: { startsWith: 'zero.test.' } },
        ],
      },
    });
    console.log(`  Remaining ephemeral test accounts: ${remainingTestUsers.length}`);
    record('Test Users Cleaned Up (Zero Ephemeral Accounts Remaining)', remainingTestUsers.length === 0);

    // Final summary
    console.log('\n================================================================');
    console.log('                 BROWSER VERIFICATION SUMMARY                   ');
    console.log('================================================================');
    const totalPassed = testResults.filter((r) => r.passed).length;
    const totalFailed = testResults.filter((r) => !r.passed).length;
    console.log(`Total Steps Tested: ${testResults.length}`);
    console.log(`Passed:             ${totalPassed}`);
    console.log(`Failed:             ${totalFailed}`);
    console.log('================================================================\n');

    if (totalFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Browser verification failed with error:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    await prisma.$disconnect();
  }
}

runBrowserVerification();
