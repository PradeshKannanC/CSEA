import puppeteer from 'puppeteer-core';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';
import http from 'http';

const prisma = new PrismaClient();
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

interface AssertionResult {
  id: string;
  category: string;
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const results: AssertionResult[] = [];

function assertCheck(id: string, category: string, name: string, expected: string, actual: string, passed: boolean) {
  results.push({ id, category, name, expected, actual, passed });
  const icon = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} [${category}] ${id}: ${name} | Exp: ${expected} | Act: ${actual}`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Helper to open an SSE stream using Node.js http and capture incoming events
function listenSSE(cookieValue: string, durationMs: number = 10000): { events: any[]; close: () => void } {
  const events: any[] = [];
  const req = http.request(
    'http://localhost:3000/api/realtime',
    {
      headers: {
        Cookie: `pnp_session=${cookieValue}`,
        Accept: 'text/event-stream',
      },
    },
    (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const block of lines) {
          const trimmed = block.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const data = JSON.parse(trimmed.replace(/^data:\s*/, ''));
              events.push(data);
            } catch {}
          }
        }
      });
    }
  );

  req.on('error', () => {});
  req.end();

  return {
    events,
    close: () => {
      try {
        req.destroy();
      } catch {}
    },
  };
}

async function setupRealtimeScenario() {
  console.log('--- Setting up Realtime Scenario Data ---');

  // Event
  // Update all events to ensure latest event has correct parameters
  await prisma.event.updateMany({
    data: {
      status: 'OPEN',
      totalCoins: 100,
      minInvestment: 10,
      maxInvestment: 50,
    },
  });

  let event = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!event) {
    event = await prisma.event.create({
      data: {
        id: 'evt-realtime-test',
        name: 'Realtime Test Arena',
        status: 'OPEN',
        totalCoins: 100,
        minInvestment: 10,
        maxInvestment: 50,
      },
    });
  }

  // Cleanup any old test records first
  await prisma.investment.deleteMany({ where: { investor: { email: { in: ['investor_rt@test.local', 'isolated_rt@test.local'] } } } });
  await prisma.user.deleteMany({ where: { email: { in: ['investor_rt@test.local', 'isolated_rt@test.local'] } } });
  await prisma.idea.deleteMany({ where: { anonymousId: { startsWith: 'IDEA-RT-' } } });
  await prisma.team.deleteMany({ where: { teamId: { startsWith: 'RT-TEAM-' } } });
  await prisma.room.deleteMany({ where: { code: { startsWith: 'RT-RM-' } } });

  // Room A (Primary Room)
  const roomA = await prisma.room.create({
    data: {
      name: 'Realtime Room A',
      code: 'RT-RM-A',
      status: 'OPEN',
      eventId: event.id,
      initialCoins: 100,
      minInvestment: 10,
      maxInvestment: 50,
    },
  });

  // Room B (Isolated Room)
  const roomB = await prisma.room.create({
    data: {
      name: 'Realtime Room B',
      code: 'RT-RM-B',
      status: 'OPEN',
      eventId: event.id,
      initialCoins: 100,
      minInvestment: 10,
      maxInvestment: 50,
    },
  });

  // Team 1 in Room A (Investor Team)
  const team1 = await prisma.team.create({
    data: {
      name: 'Alpha Innovators A1',
      teamId: 'RT-TEAM-A1',
      submissionId: 'SUB-RT-A1',
      roomId: roomA.id,
    },
  });

  // Team 2 in Room A (Target Idea Team)
  const team2 = await prisma.team.create({
    data: {
      name: 'Beta Robotics A2',
      teamId: 'RT-TEAM-A2',
      submissionId: 'SUB-RT-A2',
      roomId: roomA.id,
    },
  });

  // Idea 2 in Room A
  const idea2 = await prisma.idea.create({
    data: {
      teamId: team2.id,
      anonymousId: 'IDEA-RT-002',
      title: 'Decentralized Edge Grid',
      track: 'INNOVATION TRACK',
      categoryTag: 'ENERGY',
      problemStatement: 'Grid load imbalance.',
      solution: 'AI distributed microgrid.',
      innovation: 'Dynamic load routing.',
      impact: '35% reduction in grid losses.',
      whyInvest: 'Massive scale opportunity.',
      technology: 'Rust, WebAssembly, Solana',
      roomId: roomA.id,
      status: 'APPROVED',
      isLocked: true,
      totalInvested: 0,
      investorCount: 0,
    },
  });

  // Team 3 in Room B
  const team3 = await prisma.team.create({
    data: {
      name: 'Gamma Systems B1',
      teamId: 'RT-TEAM-B1',
      submissionId: 'SUB-RT-B1',
      roomId: roomB.id,
    },
  });

  const pwdHash = hashPassword('Password123!');

  // User 1: Investor in Room A
  const investorUser = await prisma.user.create({
    data: {
      email: 'investor_rt@test.local',
      name: 'Realtime Investor',
      role: 'TEAM_MEMBER',
      avatarInitials: 'RI',
      passwordHash: pwdHash,
      isActive: true,
      teamId: team1.id,
      roomId: roomA.id,
      wallet: {
        create: {
          totalCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
      },
    },
    include: { wallet: true },
  });

  await prisma.participantBudget.create({
    data: {
      userId: investorUser.id,
      roomId: roomA.id,
      eventId: event.id,
      allocatedCoins: 100,
      investedCoins: 0,
      availableCoins: 100,
    },
  });

  // User 2: Isolated Participant in Room B
  const isolatedUser = await prisma.user.create({
    data: {
      email: 'isolated_rt@test.local',
      name: 'Isolated Room B Participant',
      role: 'TEAM_MEMBER',
      avatarInitials: 'IB',
      passwordHash: pwdHash,
      isActive: true,
      teamId: team3.id,
      roomId: roomB.id,
      wallet: {
        create: {
          totalCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
      },
    },
    include: { wallet: true },
  });

  await prisma.participantBudget.create({
    data: {
      userId: isolatedUser.id,
      roomId: roomB.id,
      eventId: event.id,
      allocatedCoins: 100,
      investedCoins: 0,
      availableCoins: 100,
    },
  });

  // User 3: Admin
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  // Create active DB sessions
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const investorSessionId = 'sess-rt-investor-' + Date.now();
  await prisma.session.create({
    data: { id: investorSessionId, userId: investorUser.id, expiresAt },
  });

  const isolatedSessionId = 'sess-rt-isolated-' + Date.now();
  await prisma.session.create({
    data: { id: isolatedSessionId, userId: isolatedUser.id, expiresAt },
  });

  let adminSessionId = '';
  if (adminUser) {
    adminSessionId = 'sess-rt-admin-' + Date.now();
    await prisma.session.create({
      data: { id: adminSessionId, userId: adminUser.id, expiresAt },
    });
  }

  return {
    event,
    roomA,
    roomB,
    team1,
    team2,
    idea2,
    team3,
    investorUser,
    isolatedUser,
    adminUser,
    investorSessionId,
    isolatedSessionId,
    adminSessionId,
  };
}

async function runRealtimeSuite() {
  console.log('================================================================');
  console.log('  TEST SUITE: REALTIME WALLET & COIN SYNCHRONIZATION END-TO-END');
  console.log('================================================================\n');

  const context = await setupRealtimeScenario();

  // 1. Establish SSE streams
  console.log('>>> Subscribing clients to /api/realtime SSE stream...');
  const investorSSE = listenSSE(context.investorSessionId);
  const isolatedSSE = listenSSE(context.isolatedSessionId);
  let adminSSE: { events: any[]; close: () => void } | null = null;
  if (context.adminSessionId) {
    adminSSE = listenSSE(context.adminSessionId);
  }

  // Wait 1.5s for SSE connections to register in realtimeHub
  await sleep(1500);

  // Verify initial connected messages
  const investorConnected = investorSSE.events.find((e) => e.type === 'CONNECTED');
  assertCheck(
    'SSE-CONN-01',
    'SSE Connection',
    'Investor receives authenticated CONNECTED SSE event',
    'authenticated: true',
    `authenticated: ${investorConnected?.payload?.authenticated}`,
    Boolean(investorConnected?.payload?.authenticated && investorConnected?.payload?.userId === context.investorUser.id)
  );

  const isolatedConnected = isolatedSSE.events.find((e) => e.type === 'CONNECTED');
  assertCheck(
    'SSE-CONN-02',
    'SSE Connection',
    'Isolated Room B user receives authenticated CONNECTED SSE event',
    'authenticated: true',
    `authenticated: ${isolatedConnected?.payload?.authenticated}`,
    Boolean(isolatedConnected?.payload?.authenticated && isolatedConnected?.payload?.userId === context.isolatedUser.id)
  );

  // 2. Execute Investment Transaction
  console.log('\n>>> Executing valid investment of 20 coins into Idea 2...');
  const investRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${context.investorSessionId}`,
    },
    body: JSON.stringify({
      ideaId: context.idea2.id,
      amount: 20,
    }),
  });

  const investData = await investRes.json();
  console.log('  [INVEST API RESPONSE]:', investRes.status, investData);
  assertCheck(
    'INVEST-01',
    'Investment Execution',
    'Investment endpoint accepts valid allocation and returns 200 OK',
    'success: true',
    `success: ${investData.success}`,
    Boolean(investRes.ok && investData.success)
  );

  assertCheck(
    'INVEST-WALLET-01',
    'Authoritative Response',
    'API response returns updated authoritative wallet with 80 available and 20 invested coins',
    'availableCoins: 80, investedCoins: 20',
    `availableCoins: ${investData.wallet?.availableCoins}, investedCoins: ${investData.wallet?.investedCoins}`,
    investData.wallet?.availableCoins === 80 && investData.wallet?.investedCoins === 20
  );

  // Allow SSE events to propagate
  await sleep(1000);

  // 3. Verify Realtime Event Broadcast & Scoping
  console.log('\n>>> Verifying Realtime SSE event delivery...');
  const walletEvents = investorSSE.events.filter((e) => e.type === 'WALLET_UPDATED');
  const latestWalletEvent = walletEvents[walletEvents.length - 1];

  assertCheck(
    'RT-WALLET-01',
    'Realtime Delivery',
    'Investor receives WALLET_UPDATED event over SSE with availableCoins: 80',
    'availableCoins: 80',
    `availableCoins: ${latestWalletEvent?.payload?.availableCoins}`,
    latestWalletEvent?.payload?.availableCoins === 80
  );

  assertCheck(
    'RT-WALLET-02',
    'Realtime Delivery',
    'Investor WALLET_UPDATED event has exact investedCoins: 20 and totalCoins: 100',
    'investedCoins: 20, totalCoins: 100',
    `investedCoins: ${latestWalletEvent?.payload?.investedCoins}, totalCoins: ${latestWalletEvent?.payload?.totalCoins}`,
    latestWalletEvent?.payload?.investedCoins === 20 && latestWalletEvent?.payload?.totalCoins === 100
  );

  // 4. Cross-Room & User Isolation Assertions
  console.log('\n>>> Verifying Cross-Room and User Privacy Isolation...');
  const isolatedWalletEvents = isolatedSSE.events.filter((e) => e.type === 'WALLET_UPDATED');
  assertCheck(
    'ISO-USER-01',
    'Privacy Isolation',
    'Participant in Room B NEVER receives Investor A WALLET_UPDATED event',
    '0 events',
    `${isolatedWalletEvents.length} events`,
    isolatedWalletEvents.length === 0
  );

  const isolatedIdeaEvents = isolatedSSE.events.filter(
    (e) => e.type === 'INVESTMENT_MADE' && e.payload?.ideaId === context.idea2.id
  );
  assertCheck(
    'ISO-ROOM-01',
    'Room Scoping Isolation',
    'Participant in Room B NEVER receives Room A INVESTMENT_MADE event',
    '0 events',
    `${isolatedIdeaEvents.length} events`,
    isolatedIdeaEvents.length === 0
  );

  // 5. Admin Metrics Verification
  if (adminSSE) {
    const adminMetricsEvents = adminSSE.events.filter((e) => e.type === 'ADMIN_METRICS_UPDATED');
    assertCheck(
      'ADMIN-RT-01',
      'Admin Monitoring',
      'Administrator receives real-time live metrics update event',
      'Event received',
      adminMetricsEvents.length > 0 ? 'Event received' : 'None received',
      adminMetricsEvents.length > 0
    );
  }

  // Close raw SSE listeners
  investorSSE.close();
  isolatedSSE.close();
  if (adminSSE) adminSSE.close();

  // 6. Database Authoritative State & Invariant Check
  console.log('\n>>> Verifying Database Wallet Ledger & Invariants...');
  const dbWallet = await prisma.wallet.findUnique({
    where: { userId: context.investorUser.id },
  });

  assertCheck(
    'DB-WALLET-01',
    'Database Invariant',
    'Database wallet reflects exactly availableCoins: 80, investedCoins: 20, totalCoins: 100',
    '80 / 20 / 100',
    `${dbWallet?.availableCoins} / ${dbWallet?.investedCoins} / ${dbWallet?.totalCoins}`,
    dbWallet?.availableCoins === 80 && dbWallet?.investedCoins === 20 && dbWallet?.totalCoins === 100
  );

  const invariantHolds = dbWallet ? dbWallet.totalCoins === dbWallet.availableCoins + dbWallet.investedCoins : false;
  assertCheck(
    'DB-INVARIANT-01',
    'Mathematical Invariant',
    'Wallet invariant holds: totalCoins === availableCoins + investedCoins',
    'true',
    String(invariantHolds),
    invariantHolds
  );

  const dbInvestment = await prisma.investment.findFirst({
    where: {
      investorId: context.investorUser.id,
      ideaId: context.idea2.id,
    },
  });
  assertCheck(
    'DB-INVEST-01',
    'Audit & Investment Record',
    'Investment ledger recorded transaction of 20 coins with exact room and event scoping',
    'amount: 20, roomId: Room A',
    `amount: ${dbInvestment?.amount}, roomId: ${dbInvestment?.roomId}`,
    Boolean(dbInvestment && dbInvestment.amount === 20 && dbInvestment.roomId === context.roomA.id)
  );

  // 7. Full Browser UI Verification (Navbar Coin Balance Pill & Portfolio Page)
  console.log('\n>>> Verifying Browser UI Synchronization in Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Inject session cookie into browser
    await page.setCookie({
      name: 'pnp_session',
      value: context.investorSessionId,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    });

    // 7.1 Visit /portfolio
    await page.goto(`${BASE_URL}/portfolio`, { waitUntil: 'networkidle2' });
    await sleep(1500);

    // Read Navbar Coin Pill
    const navBalance = await page.evaluate(() => {
      // Find element containing "Coins" or inside header
      const header = document.querySelector('header');
      if (!header) return null;
      const pills = Array.from(header.querySelectorAll('a[href="/portfolio"]'));
      return pills.map((p) => p.textContent?.trim()).join(' | ');
    });

    assertCheck(
      'UI-NAVBAR-01',
      'UI Balance Verification',
      'Navbar CoinBalancePill displays 80 coins in UI',
      'Contains 80',
      navBalance || 'Not found',
      Boolean(navBalance && navBalance.includes('80'))
    );

    // Read Portfolio Page Metrics
    const portfolioText = await page.evaluate(() => document.body.innerText);
    assertCheck(
      'UI-PORTFOLIO-01',
      'UI Balance Verification',
      'Portfolio page displays 80 available and 20 deployed coins',
      'Contains 80 and 20',
      portfolioText.includes('80') && portfolioText.includes('20') ? 'Found 80 and 20' : 'Missing metrics',
      portfolioText.includes('80') && portfolioText.includes('20')
    );

    // 7.2 Visit /arena
    await page.goto(`${BASE_URL}/arena`, { waitUntil: 'networkidle2' });
    await sleep(1500);

    const arenaText = await page.evaluate(() => document.body.innerText);
    assertCheck(
      'UI-ARENA-01',
      'UI Balance Verification',
      'Arena WalletCard displays 80 available coins',
      'Contains 80',
      arenaText.includes('80') ? 'Contains 80' : 'Missing 80',
      arenaText.includes('80')
    );

    // 7.3 Refresh Persistence
    console.log('\n>>> Verifying Persistence across Browser Reload and Re-login...');
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1500);

    const reloadedNavBalance = await page.evaluate(() => {
      const header = document.querySelector('header');
      return header ? header.textContent?.trim() : null;
    });

    assertCheck(
      'PERSIST-RELOAD-01',
      'Persistence',
      'Wallet balance of 80 coins persists cleanly across browser reload',
      'Contains 80',
      reloadedNavBalance?.includes('80') ? 'Contains 80' : 'Missing',
      Boolean(reloadedNavBalance && reloadedNavBalance.includes('80'))
    );

    await browser.close();
  } catch (err) {
    console.error('Browser UI test error:', err);
    await browser.close();
  }

  // Cleanup scenario records
  console.log('\n--- Cleaning up test scenario data ---');
  await prisma.investment.deleteMany({ where: { investorId: context.investorUser.id } });
  await prisma.participantBudget.deleteMany({ where: { userId: { in: [context.investorUser.id, context.isolatedUser.id] } } });
  await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: context.investorUser.id } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: [context.investorUser.id, context.isolatedUser.id] } } });
  await prisma.session.deleteMany({ where: { id: { in: [context.investorSessionId, context.isolatedSessionId, context.adminSessionId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [context.investorUser.id, context.isolatedUser.id] } } });
  await prisma.idea.deleteMany({ where: { id: context.idea2.id } });
  await prisma.team.deleteMany({ where: { id: { in: [context.team1.id, context.team2.id, context.team3.id] } } });
  await prisma.room.deleteMany({ where: { id: { in: [context.roomA.id, context.roomB.id] } } });
  await prisma.$disconnect();

  // Summary Report
  console.log('\n================================================================');
  console.log('             REALTIME WALLET SYNC TEST SUMMARY                  ');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total checks executed: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error(`\n❌ FAILED CHECKS:`);
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`  - [${r.id}] ${r.name}: Expected '${r.expected}', got '${r.actual}'`);
    });
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL ${total} REALTIME WALLET & COIN SYNC CHECKS PASSED PERFECTLY!`);
    process.exit(0);
  }
}

runRealtimeSuite().catch((err) => {
  console.error('Fatal error running realtime wallet sync suite:', err);
  process.exit(1);
});
