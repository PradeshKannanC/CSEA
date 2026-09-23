import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth/password';
import { createDatabaseSession } from '../lib/auth/session';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  testId: string;
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const results: TestResult[] = [];

function record(testId: string, name: string, expected: string, actual: string, passed: boolean) {
  results.push({ testId, name, expected, actual, passed });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${testId}] ${name}`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Actual:   ${actual}\n`);
}

async function loginUser(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error(`No cookie returned for ${email}`);
  const match = setCookie.match(/pnp_session=([^;]+)/);
  if (!match) throw new Error(`Could not parse pnp_session from ${setCookie}`);
  return match[1];
}

async function runOneInvestmentRuleSuite() {
  console.log('================================================================');
  console.log(' TEST SUITE: ONE INVESTMENT PER IDEA & OWN IDEA ABSENCE');
  console.log('================================================================\n');

  const ts = Date.now();
  const passwordHash = hashPassword('Password123!');

  // 1. Setup Dedicated Test Admin
  const admin = await prisma.user.create({
    data: {
      name: 'Dedicated Admin',
      email: `admin_${ts}@csea.edu`,
      passwordHash,
      role: 'ADMIN',
      avatarInitials: 'DA',
    },
  });
  const adminCookie = await loginUser(admin.email);

  let event = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        name: 'PITCH AND PROSPER TEST',
        status: 'OPEN',
        totalCoins: 1000,
        minInvestment: 50,
        maxInvestment: 400,
      },
    });
  }

  // Create Room A and Room B
  const roomA = await prisma.room.create({
    data: {
      name: `Room Alpha ${ts}`,
      code: `RA${ts.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
      initialCoins: 600,
      minInvestment: 50,
      maxInvestment: 350,
    },
  });

  const roomB = await prisma.room.create({
    data: {
      name: `Room Beta ${ts}`,
      code: `RB${ts.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
      initialCoins: 600,
      minInvestment: 50,
      maxInvestment: 350,
    },
  });

  // Create P1 (Leader of Team P1 with Idea P01) in Room A
  const p1 = await prisma.user.create({
    data: {
      name: `Participant One ${ts}`,
      email: `p1_${ts}@csea.edu`,
      passwordHash,
      role: 'TEAM_LEADER',
      avatarInitials: 'P1',
    },
  });
  const teamP1 = await prisma.team.create({
    data: {
      name: `Team P1 ${ts}`,
      teamId: `TP1_${ts}`,
      submissionId: `SUB_P1_${ts}`,
      leaderId: p1.id,
      roomId: roomA.id,
      cohort: '2026',
    },
  });
  await prisma.user.update({ where: { id: p1.id }, data: { teamId: teamP1.id, roomId: roomA.id } });
  const ideaP01 = await prisma.idea.create({
    data: {
      anonymousId: `IDEA P01 ${ts.toString().slice(-4)}`,
      teamId: teamP1.id,
      roomId: roomA.id,
      title: 'P1 Own Proposal',
      track: 'CLEANTECH',
      categoryTag: 'ENERGY',
      problemStatement: 'Own team problem',
      solution: 'Own team solution',
      innovation: 'Own team innovation',
      impact: 'Own team impact',
      whyInvest: 'Why invest in own team',
      technology: 'Next.js',
      status: 'APPROVED',
    },
  });

  // Create Team A01 with Idea A01 in Room A
  const pA01 = await prisma.user.create({
    data: {
      name: `Leader A01 ${ts}`,
      email: `pa01_${ts}@csea.edu`,
      passwordHash,
      role: 'TEAM_LEADER',
      avatarInitials: 'A1',
    },
  });
  const teamA01 = await prisma.team.create({
    data: {
      name: `Team A01 ${ts}`,
      teamId: `TA01_${ts}`,
      submissionId: `SUB_A01_${ts}`,
      leaderId: pA01.id,
      roomId: roomA.id,
      cohort: '2026',
    },
  });
  await prisma.user.update({ where: { id: pA01.id }, data: { teamId: teamA01.id, roomId: roomA.id } });
  const ideaA01 = await prisma.idea.create({
    data: {
      anonymousId: `IDEA A01 ${ts.toString().slice(-4)}`,
      teamId: teamA01.id,
      roomId: roomA.id,
      title: 'Peer Proposal A01',
      track: 'AI_DATA',
      categoryTag: 'FINTECH',
      problemStatement: 'Problem A01',
      solution: 'Solution A01',
      innovation: 'Innovation A01',
      impact: 'Impact A01',
      whyInvest: 'Why invest A01',
      technology: 'PyTorch',
      status: 'APPROVED',
    },
  });

  // Create Team A02 with Idea A02 in Room A
  const pA02 = await prisma.user.create({
    data: {
      name: `Leader A02 ${ts}`,
      email: `pa02_${ts}@csea.edu`,
      passwordHash,
      role: 'TEAM_LEADER',
      avatarInitials: 'A2',
    },
  });
  const teamA02 = await prisma.team.create({
    data: {
      name: `Team A02 ${ts}`,
      teamId: `TA02_${ts}`,
      submissionId: `SUB_A02_${ts}`,
      leaderId: pA02.id,
      roomId: roomA.id,
      cohort: '2026',
    },
  });
  await prisma.user.update({ where: { id: pA02.id }, data: { teamId: teamA02.id, roomId: roomA.id } });
  const ideaA02 = await prisma.idea.create({
    data: {
      anonymousId: `IDEA A02 ${ts.toString().slice(-4)}`,
      teamId: teamA02.id,
      roomId: roomA.id,
      title: 'Peer Proposal A02',
      track: 'SECURITY',
      categoryTag: 'CRYPTO',
      problemStatement: 'Problem A02',
      solution: 'Solution A02',
      innovation: 'Innovation A02',
      impact: 'Impact A02',
      whyInvest: 'Why invest A02',
      technology: 'Rust',
      status: 'APPROVED',
    },
  });

  // Create Team B01 with Idea B01 in Room B
  const pB01 = await prisma.user.create({
    data: {
      name: `Leader B01 ${ts}`,
      email: `pb01_${ts}@csea.edu`,
      passwordHash,
      role: 'TEAM_LEADER',
      avatarInitials: 'B1',
    },
  });
  const teamB01 = await prisma.team.create({
    data: {
      name: `Team B01 ${ts}`,
      teamId: `TB01_${ts}`,
      submissionId: `SUB_B01_${ts}`,
      leaderId: pB01.id,
      roomId: roomB.id,
      cohort: '2026',
    },
  });
  await prisma.user.update({ where: { id: pB01.id }, data: { teamId: teamB01.id, roomId: roomB.id } });
  const ideaB01 = await prisma.idea.create({
    data: {
      anonymousId: `IDEA B01 ${ts.toString().slice(-4)}`,
      teamId: teamB01.id,
      roomId: roomB.id,
      title: 'Room B Proposal B01',
      track: 'BIOTECH',
      categoryTag: 'HEALTH',
      problemStatement: 'Problem B01',
      solution: 'Solution B01',
      innovation: 'Innovation B01',
      impact: 'Impact B01',
      whyInvest: 'Why invest B01',
      technology: 'C++',
      status: 'APPROVED',
    },
  });

  // Create P2 (Leader of Team P2) in Room A
  const p2 = await prisma.user.create({
    data: {
      name: `Participant Two ${ts}`,
      email: `p2_${ts}@csea.edu`,
      passwordHash,
      role: 'TEAM_LEADER',
      avatarInitials: 'P2',
    },
  });
  const teamP2 = await prisma.team.create({
    data: {
      name: `Team P2 ${ts}`,
      teamId: `TP2_${ts}`,
      submissionId: `SUB_P2_${ts}`,
      leaderId: p2.id,
      roomId: roomA.id,
      cohort: '2026',
    },
  });
  await prisma.user.update({ where: { id: p2.id }, data: { teamId: teamP2.id, roomId: roomA.id } });

  // Start Room A and Room B
  const startRoomARes = await fetch(`${BASE_URL}/api/admin/rooms/${roomA.id}/start`, {
    method: 'POST',
    headers: { Cookie: `pnp_session=${adminCookie}` },
  });
  const startAData = await startRoomARes.json();
  if (!startRoomARes.ok || !startAData.success) {
    throw new Error(`Failed to start Room A: ${JSON.stringify(startAData)}`);
  }

  const startRoomBRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomB.id}/start`, {
    method: 'POST',
    headers: { Cookie: `pnp_session=${adminCookie}` },
  });
  const startBData = await startRoomBRes.json();
  if (!startRoomBRes.ok || !startBData.success) {
    throw new Error(`Failed to start Room B: ${JSON.stringify(startBData)}`);
  }

  const p1Cookie = await loginUser(p1.email);
  const p2Cookie = await loginUser(p2.email);

  // -------------------------------------------------------------
  // TEST 9: P1 Arena API — Own Team Idea MUST NOT exist in returned list
  // -------------------------------------------------------------
  const arenaBeforeRes = await fetch(`${BASE_URL}/api/ideas`, {
    headers: { Cookie: `pnp_session=${p1Cookie}` },
  });
  const arenaBeforeData = await arenaBeforeRes.json();
  const returnedIdeaIdsBefore = arenaBeforeData.ideas.map((i: any) => i.id);
  const ownIdeaAbsent = !returnedIdeaIdsBefore.includes(ideaP01.id);
  const peerIdeaPresent = returnedIdeaIdsBefore.includes(ideaA01.id) && returnedIdeaIdsBefore.includes(ideaA02.id);
  const crossRoomAbsent = !returnedIdeaIdsBefore.includes(ideaB01.id);
  record(
    'TEST 9',
    'P1 Arena API: Own Team Idea & Cross-Room Idea Do NOT Exist',
    'Own idea absent = true, Peer ideas present = true, Cross-room absent = true',
    `Own Absent: ${ownIdeaAbsent}, Peer Present: ${peerIdeaPresent}, Cross-Room Absent: ${crossRoomAbsent}`,
    ownIdeaAbsent && peerIdeaPresent && crossRoomAbsent
  );

  // -------------------------------------------------------------
  // TEST 8: P1 attempts to invest in own team idea -> Rejected
  // -------------------------------------------------------------
  const ownInvestRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
    body: JSON.stringify({ ideaId: ideaP01.id, amount: 150 }),
  });
  const ownInvestData = await ownInvestRes.json();
  const ownInvestBlocked =
    (ownInvestRes.status === 403 || ownInvestRes.status === 409) &&
    (ownInvestData.code === 'OWN_TEAM_IDEA' || ownInvestData.code === 'OWN_TEAM_INVESTMENT_FORBIDDEN');
  record(
    'TEST 8',
    'P1 Attempts Investment in Own Team Idea',
    'HTTP 403/409 with code OWN_TEAM_IDEA / OWN_TEAM_INVESTMENT_FORBIDDEN',
    `HTTP ${ownInvestRes.status}, code: ${ownInvestData.code}, message: ${ownInvestData.message}`,
    ownInvestBlocked
  );

  // -------------------------------------------------------------
  // TEST 10: P1 in Room A attempts to invest in Room B idea -> Rejected
  // -------------------------------------------------------------
  const crossInvestRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
    body: JSON.stringify({ ideaId: ideaB01.id, amount: 150 }),
  });
  const crossInvestData = await crossInvestRes.json();
  const crossBlocked =
    crossInvestRes.status === 403 &&
    crossInvestData.code === 'CROSS_ROOM_INVESTMENT_FORBIDDEN';
  record(
    'TEST 10',
    'P1 in Room A Attempts Cross-Room Investment in Room B Idea',
    'HTTP 403 with CROSS_ROOM_INVESTMENT_FORBIDDEN',
    `HTTP ${crossInvestRes.status}, code: ${crossInvestData.code}`,
    crossBlocked
  );

  // -------------------------------------------------------------
  // TEST 1: P1 -> Idea A01 -> Invest 150 -> SUCCESS
  // -------------------------------------------------------------
  const invest1Res = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
    body: JSON.stringify({ ideaId: ideaA01.id, amount: 150 }),
  });
  const invest1Data = await invest1Res.json();
  const invest1Success =
    invest1Res.ok &&
    invest1Data.success &&
    invest1Data.budget.availableCoins === 450 &&
    invest1Data.budget.investedCoins === 150;
  record(
    'TEST 1',
    'P1 Invests 150 Coins in Idea A01',
    'HTTP 200 Success, Available: 450, Invested: 150',
    `HTTP ${invest1Res.status}, Available: ${invest1Data.budget?.availableCoins}, Invested: ${invest1Data.budget?.investedCoins}`,
    invest1Success
  );

  // -------------------------------------------------------------
  // TEST 2: P1 -> Idea A01 -> Invest 150 AGAIN -> 409 ALREADY_INVESTED
  // -------------------------------------------------------------
  const invest2Res = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
    body: JSON.stringify({ ideaId: ideaA01.id, amount: 150 }),
  });
  const invest2Data = await invest2Res.json();
  const invest2Blocked =
    invest2Res.status === 409 &&
    invest2Data.code === 'ALREADY_INVESTED';
  record(
    'TEST 2',
    'P1 Attempts Second Investment in Idea A01 (Same Amount)',
    'HTTP 409 with code ALREADY_INVESTED',
    `HTTP ${invest2Res.status}, code: ${invest2Data.code}, message: "${invest2Data.message}"`,
    invest2Blocked
  );

  // -------------------------------------------------------------
  // TEST 3: P1 -> Idea A01 -> Invest 200 after already investing 150 -> 409 ALREADY_INVESTED
  // -------------------------------------------------------------
  const invest3Res = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
    body: JSON.stringify({ ideaId: ideaA01.id, amount: 200 }),
  });
  const invest3Data = await invest3Res.json();
  const invest3Blocked =
    invest3Res.status === 409 &&
    invest3Data.code === 'ALREADY_INVESTED';
  record(
    'TEST 3',
    'P1 Attempts Third Investment in Idea A01 with Different Amount (200 coins)',
    'HTTP 409 with code ALREADY_INVESTED',
    `HTTP ${invest3Res.status}, code: ${invest3Data.code}`,
    invest3Blocked
  );

  // -------------------------------------------------------------
  // TEST 4: P1 refreshes /api/ideas -> Idea A01 is NOT in active Arena
  // -------------------------------------------------------------
  const arenaAfterRes = await fetch(`${BASE_URL}/api/ideas`, {
    headers: { Cookie: `pnp_session=${p1Cookie}` },
  });
  const arenaAfterData = await arenaAfterRes.json();
  const returnedIdeaIdsAfter = arenaAfterData.ideas.map((i: any) => i.id);
  const ideaA01AbsentAfter = !returnedIdeaIdsAfter.includes(ideaA01.id);
  const ideaA02StillAvailable = returnedIdeaIdsAfter.includes(ideaA02.id);
  record(
    'TEST 4',
    'P1 Active Arena View: Idea A01 Disappears from Arena Post-Investment',
    'Idea A01 absent = true, Idea A02 remaining = true',
    `A01 Absent: ${ideaA01AbsentAfter}, A02 Still Available: ${ideaA02StillAvailable}`,
    ideaA01AbsentAfter && ideaA02StillAvailable
  );

  // -------------------------------------------------------------
  // TEST 5: P1 logout -> login -> Idea A01 STILL NOT in active Arena
  // -------------------------------------------------------------
  const p1NewCookie = await loginUser(p1.email);
  const arenaReloginRes = await fetch(`${BASE_URL}/api/ideas`, {
    headers: { Cookie: `pnp_session=${p1NewCookie}` },
  });
  const arenaReloginData = await arenaReloginRes.json();
  const reloginIds = arenaReloginData.ideas.map((i: any) => i.id);
  const reloginAbsent = !reloginIds.includes(ideaA01.id);
  record(
    'TEST 5',
    'P1 Re-login Session: Idea A01 Remains Excluded from Active Arena',
    'Idea A01 absent after relogin = true',
    `A01 Absent: ${reloginAbsent}`,
    reloginAbsent
  );

  // -------------------------------------------------------------
  // TEST 6: P1 Second Client Session / Tab -> Idea A01 NOT in active Arena
  // -------------------------------------------------------------
  const p1Tab2Cookie = await loginUser(p1.email);
  const arenaTab2Res = await fetch(`${BASE_URL}/api/ideas`, {
    headers: { Cookie: `pnp_session=${p1Tab2Cookie}` },
  });
  const arenaTab2Data = await arenaTab2Res.json();
  const tab2Ids = arenaTab2Data.ideas.map((i: any) => i.id);
  const tab2Absent = !tab2Ids.includes(ideaA01.id);
  record(
    'TEST 6',
    'P1 Second Browser/Tab View: Idea A01 Not Investable',
    'Idea A01 absent in second session = true',
    `A01 Absent: ${tab2Absent}`,
    tab2Absent
  );

  // -------------------------------------------------------------
  // TEST 7: Manually POST directly to investment API for already-invested Idea A01 -> 409 ALREADY_INVESTED
  // -------------------------------------------------------------
  const manualPostRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Tab2Cookie}` },
    body: JSON.stringify({ ideaId: ideaA01.id, amount: 100 }),
  });
  const manualPostData = await manualPostRes.json();
  const manualPostBlocked =
    manualPostRes.status === 409 &&
    manualPostData.code === 'ALREADY_INVESTED';
  record(
    'TEST 7',
    'Direct Manual API Invocation for Already-Invested Idea A01',
    'HTTP 409 with code ALREADY_INVESTED',
    `HTTP ${manualPostRes.status}, code: ${manualPostData.code}`,
    manualPostBlocked
  );

  // -------------------------------------------------------------
  // TEST 11: P2 in Room A invests in Idea A01 -> SUCCESS, then second attempt -> REJECTED
  // -------------------------------------------------------------
  // A. P2 Arena view has Idea A01 (because P2 has NOT invested yet)
  const p2ArenaRes = await fetch(`${BASE_URL}/api/ideas`, {
    headers: { Cookie: `pnp_session=${p2Cookie}` },
  });
  const p2ArenaData = await p2ArenaRes.json();
  const p2HasA01 = p2ArenaData.ideas.some((i: any) => i.id === ideaA01.id);

  // B. P2 invests 150 in Idea A01
  const p2InvestRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p2Cookie}` },
    body: JSON.stringify({ ideaId: ideaA01.id, amount: 150 }),
  });
  const p2InvestData = await p2InvestRes.json();
  const p2Success = p2InvestRes.ok && p2InvestData.success;

  // C. P2 second attempt -> REJECTED
  const p2SecondRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p2Cookie}` },
    body: JSON.stringify({ ideaId: ideaA01.id, amount: 150 }),
  });
  const p2SecondData = await p2SecondRes.json();
  const p2SecondBlocked = p2SecondRes.status === 409 && p2SecondData.code === 'ALREADY_INVESTED';

  record(
    'TEST 11',
    'Per-Participant Independent Enforcement (P2 Invests Once in A01, Second Attempt Rejected)',
    'P2 can see A01: true, P2 1st invest: 200, P2 2nd invest: 409 ALREADY_INVESTED',
    `Visible to P2: ${p2HasA01}, P2 First: ${p2Success}, P2 Second Blocked: ${p2SecondBlocked}`,
    p2HasA01 && p2Success && p2SecondBlocked
  );

  // -------------------------------------------------------------
  // TEST 12: Concurrent duplicate requests from the same participant for the same idea
  // -------------------------------------------------------------
  // P1 attempts concurrent duplicate requests for Idea A02 (which P1 has NOT invested in yet)
  const concurrentResults = await Promise.all([
    fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
      body: JSON.stringify({ ideaId: ideaA02.id, amount: 100 }),
    }),
    fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
      body: JSON.stringify({ ideaId: ideaA02.id, amount: 100 }),
    }),
    fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
      body: JSON.stringify({ ideaId: ideaA02.id, amount: 100 }),
    }),
  ]);

  const statuses = concurrentResults.map((r) => r.status);
  const successCount = statuses.filter((s) => s === 200).length;
  const conflictCount = statuses.filter((s) => s === 409).length;

  // Verify database record count
  const dbInvestments = await prisma.investment.findMany({
    where: {
      investorId: p1.id,
      roomId: roomA.id,
      ideaId: ideaA02.id,
    },
  });

  const exactOneInDb = dbInvestments.length === 1;
  const concurrentOk = successCount === 1 && conflictCount === 2 && exactOneInDb;

  record(
    'TEST 12',
    'Concurrent Duplicate Requests Atomicity & DB Uniqueness Constraint',
    'Exactly 1 success (200), 2 rejections (409 ALREADY_INVESTED), DB count = 1',
    `Successes: ${successCount}, 409 Conflicts: ${conflictCount}, DB Count: ${dbInvestments.length}`,
    concurrentOk
  );

  // -------------------------------------------------------------
  // CRITICAL GOLDEN PATH: End-to-End Browser Automation with Playwright
  // -------------------------------------------------------------
  console.log('>>> EXECUTING CRITICAL GOLDEN PATH BROWSER TEST (PLAYWRIGHT)...');

  // Create fresh participant P_Browser
  const pBrowser = await prisma.user.create({
    data: {
      name: `Browser User ${ts}`,
      email: `pbrowser_${ts}@csea.edu`,
      passwordHash,
      role: 'TEAM_LEADER',
      avatarInitials: 'PB',
    },
  });
  const teamBrowser = await prisma.team.create({
    data: {
      name: `Team Browser ${ts}`,
      teamId: `TBROWSER_${ts}`,
      submissionId: `SUB_BROWSER_${ts}`,
      leaderId: pBrowser.id,
      roomId: roomA.id,
      cohort: '2026',
    },
  });
  await prisma.user.update({ where: { id: pBrowser.id }, data: { teamId: teamBrowser.id, roomId: roomA.id } });

  // Create P_Browser's own idea
  const ownBrowserIdea = await prisma.idea.create({
    data: {
      anonymousId: `IDEA BROWSER OWN ${ts.toString().slice(-4)}`,
      teamId: teamBrowser.id,
      roomId: roomA.id,
      title: 'Browser User Own Idea',
      track: 'AI_DATA',
      categoryTag: 'AI',
      problemStatement: 'Browser own problem',
      solution: 'Browser own solution',
      innovation: 'Browser own innovation',
      impact: 'Browser own impact',
      whyInvest: 'Browser own why invest',
      technology: 'React',
      status: 'APPROVED',
    },
  });

  // Create fresh budget for P_Browser in Room A
  await prisma.participantBudget.create({
    data: {
      userId: pBrowser.id,
      roomId: roomA.id,
      eventId: event.id,
      allocatedCoins: 600,
      investedCoins: 0,
      availableCoins: 600,
    },
  });
  await prisma.wallet.create({
    data: {
      userId: pBrowser.id,
      totalCoins: 600,
      investedCoins: 0,
      availableCoins: 600,
    },
  });

  const browserInstance = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browserInstance.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', (msg) => console.log('  [BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', (err: any) => console.log('  [BROWSER ERROR]', err?.message || String(err)));
  page.on('request', (req) => {
    if (req.url().includes('/api/invest')) {
      console.log('  [BROWSER REQUEST]', req.method(), req.url(), req.postData());
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/invest')) {
      let bodyText = '';
      try { bodyText = await res.text(); } catch {}
      console.log('  [BROWSER RESPONSE]', res.status(), bodyText);
    }
  });

  // Authenticate session directly
  const pBrowserSessionId = await createDatabaseSession(pBrowser.id);
  await page.setCookie({ name: 'pnp_session', value: pBrowserSessionId, url: BASE_URL });

  // Navigate to Arena
  await page.goto(`${BASE_URL}/arena`, { waitUntil: 'networkidle0' }).catch(() => {});
  await page.waitForSelector('main', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 2000));

  // Assertion 1: Own team idea is NOT present
  const pageContent = await page.content();
  const ownIdeaNotPresentInDom = !pageContent.includes(ownBrowserIdea.anonymousId);
  const a01PresentInDom = pageContent.includes(ideaA01.anonymousId);

  console.log('  [BROWSER DEBUG] ownIdeaNotPresentInDom:', ownIdeaNotPresentInDom, 'a01PresentInDom:', a01PresentInDom);

  // Find all buttons on page
  const allButtonTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim() || '')
  );
  console.log('  [BROWSER DEBUG] Available buttons:', allButtonTexts);

  // Click the Invest button for Idea A01
  const clickedInvest = await page.evaluate((targetAnonId) => {
    const articles = Array.from(document.querySelectorAll('article'));
    const targetArticle = articles.find((a) => a.textContent?.includes(targetAnonId));
    if (!targetArticle) return { success: false, reason: 'article_not_found' };

    const btn = Array.from(targetArticle.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Invest')
    );
    if (!btn) return { success: false, reason: 'button_not_found' };

    (btn as HTMLButtonElement).click();
    return { success: true, text: btn.textContent?.trim() };
  }, ideaA01.anonymousId);

  console.log('  [BROWSER DEBUG] clickedInvest result:', clickedInvest);

  // Wait for confirmation modal
  await new Promise((r) => setTimeout(r, 1000));
  const modalButtonTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim() || '')
  );
  console.log('  [BROWSER DEBUG] Buttons after opening modal:', modalButtonTexts);

  // Click "Confirm Investment" button inside modal
  const clickedConfirm = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const confirmBtn = buttons.find((b) =>
      b.textContent?.includes('Confirm') || b.textContent?.includes('Deploy')
    );
    if (!confirmBtn) return { success: false, reason: 'confirm_btn_not_found' };
    (confirmBtn as HTMLButtonElement).click();
    return { success: true, text: confirmBtn.textContent?.trim() };
  });
  console.log('  [BROWSER DEBUG] clickedConfirm result:', clickedConfirm);

  // Wait for investment processing, animation, and state sync
  await new Promise((r) => setTimeout(r, 4000));

  // Dismiss success modal if open
  await page.evaluate(() => {
    const returnBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Return to Arena')
    );
    if (returnBtn) (returnBtn as HTMLButtonElement).click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Assertion 3: Idea A01 card disappears from Active Arena
  const activeCards = await page.evaluate(() =>
    Array.from(document.querySelectorAll('article')).map((a) => a.textContent || '')
  );
  const a01DisappearedFromArena = !activeCards.some((text) => text.includes(ideaA01.anonymousId));
  console.log('  [BROWSER DEBUG] a01DisappearedFromArena:', a01DisappearedFromArena);

  // Assertion 4: Portfolio shows the investment
  await page.goto(`${BASE_URL}/portfolio`, { waitUntil: 'networkidle0' }).catch(() => {});
  await page.waitForSelector('main', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 2000));
  const portfolioContent = await page.content();
  const portfolioHasA01 = portfolioContent.includes(ideaA01.anonymousId);
  console.log('  [BROWSER DEBUG] portfolioHasA01:', portfolioHasA01);

  // Assertion 5: Refresh page -> A01 still absent from Arena
  await page.goto(`${BASE_URL}/arena`, { waitUntil: 'networkidle0' }).catch(() => {});
  await page.waitForSelector('main', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 2000));
  const reloadContent = await page.content();
  const reloadAbsent = !reloadContent.includes(ideaA01.anonymousId);
  console.log('  [BROWSER DEBUG] reloadAbsent:', reloadAbsent);

  // Assertion 6: New authenticated session (simulating relogin) -> A01 still absent
  const pBrowserSessionId2 = await createDatabaseSession(pBrowser.id);
  await page.setCookie({ name: 'pnp_session', value: pBrowserSessionId2, url: BASE_URL });
  await page.goto(`${BASE_URL}/arena`, { waitUntil: 'networkidle0' }).catch(() => {});
  await page.waitForSelector('main', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 2000));
  const reloginContent = await page.content();
  const reloginAbsentBrowser = !reloginContent.includes(ideaA01.anonymousId);
  console.log('  [BROWSER DEBUG] reloginAbsentBrowser:', reloginAbsentBrowser);

  await browserInstance.close();

  const goldenPathPassed =
    ownIdeaNotPresentInDom &&
    a01PresentInDom &&
    a01DisappearedFromArena &&
    portfolioHasA01 &&
    reloadAbsent &&
    reloginAbsentBrowser;

  record(
    'GOLDEN PATH',
    'Critical End-to-End Browser Journey: Own Idea Absent, Active Disappearance, Portfolio Verification, Post-Reload Immutability',
    'Own idea absent, A01 disappears post-invest, portfolio records 150 coins, persists across reload & relogin',
    `Own Absent: ${ownIdeaNotPresentInDom}, Disappeared: ${a01DisappearedFromArena}, Portfolio: ${portfolioHasA01}, Reload: ${reloadAbsent}, Relogin: ${reloginAbsentBrowser}`,
    goldenPathPassed
  );

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('================================================================');
  const allPassed = results.every((r) => r.passed);
  const passCount = results.filter((r) => r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passCount} | FAILED: ${results.length - passCount}`);
  console.log(`FINAL VERDICT: ${allPassed ? 'ALL TESTS PASSED PERFECTLY' : 'SOME TESTS FAILED'}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runOneInvestmentRuleSuite()
  .catch((e) => {
    console.error('Test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
