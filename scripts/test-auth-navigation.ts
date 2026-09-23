import puppeteer, { Browser, Page } from 'puppeteer-core';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

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

async function setupTestContext() {
  console.log('--- Setting up test environment ---');
  let event = await prisma.event.findFirst();
  if (!event) {
    event = await prisma.event.create({
      data: {
        id: 'evt-nav-test',
        name: 'Nav Test Arena',
        status: 'OPEN',
        totalCoins: 100,
        minInvestment: 10,
        maxInvestment: 50,
      },
    });
  }

  let room = await prisma.room.findFirst({ where: { status: 'OPEN' } });
  if (!room) {
    room = await prisma.room.create({
      data: {
        name: 'Nav Test Room',
        code: 'NAV-RM',
        status: 'OPEN',
        eventId: event.id,
      },
    });
  }

  let team = await prisma.team.findFirst({ where: { roomId: room.id } });
  if (!team) {
    team = await prisma.team.create({
      data: {
        name: 'Nav Test Team',
        teamId: 'TEAM-NAV-01',
        submissionId: 'SUB-NAV-01',
        roomId: room.id,
      },
    });
  }

  // Cleanup old test users
  await prisma.user.deleteMany({
    where: { email: { in: ['nav_leader@test.local', 'nav_member@test.local'] } },
  });

  const pwdHash = hashPassword('Password123!');

  const leader = await prisma.user.create({
    data: {
      email: 'nav_leader@test.local',
      name: 'Nav Test Leader',
      role: 'TEAM_LEADER',
      avatarInitials: 'NL',
      passwordHash: pwdHash,
      isActive: true,
      teamId: team.id,
      roomId: room.id,
      wallet: {
        create: {
          totalCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
      },
    },
  });

  const member = await prisma.user.create({
    data: {
      email: 'nav_member@test.local',
      name: 'Nav Test Member',
      role: 'TEAM_MEMBER',
      avatarInitials: 'NM',
      passwordHash: pwdHash,
      isActive: true,
      teamId: team.id,
      roomId: room.id,
      wallet: {
        create: {
          totalCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
      },
    },
  });

  // Assign leader
  await prisma.team.update({
    where: { id: team.id },
    data: { leaderId: leader.id },
  });

  return { room, team, leader, member };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  TEST SUITE: AUTHENTICATION NAVIGATION & ROUTE GUARDS REGRESSION');
  console.log('================================================================\n');

  const { leader, member } = await setupTestContext();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    // ================================================================
    // PART 1: UNAUTHENTICATED ROUTE ACCESS (Zero Token / Fresh Session)
    // ================================================================
    console.log('\n>>> Part 1: Verifying Unauthenticated Access Redirection');
    const unauthPage = await browser.newPage();

    const protectedRoutes = [
      '/dashboard',
      '/arena',
      '/portfolio',
      '/team',
      '/team-submission',
      '/admin',
    ];

    for (let i = 0; i < protectedRoutes.length; i++) {
      const route = protectedRoutes[i];
      await unauthPage.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle2' });
      const currentUrl = unauthPage.url();
      const isRedirectedToLogin = currentUrl.includes('/login');
      assertCheck(
        `UNAUTH-0${i + 1}`,
        'Unauthenticated Guard',
        `Access to ${route} must redirect unauthenticated visitor to /login`,
        'Includes /login',
        currentUrl,
        isRedirectedToLogin
      );
    }
    await unauthPage.close();

    // ================================================================
    // PART 2: TEAM_LEADER AUTHENTICATION & NAVIGATION
    // ================================================================
    console.log('\n>>> Part 2: Verifying TEAM_LEADER Auth, Navigation & Zero Login Loops');
    const leaderContext = await browser.createBrowserContext();
    const leaderPage = await leaderContext.newPage();
    await leaderPage.setViewport({ width: 1280, height: 900 });

    // 2.1 Login
    await leaderPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    await leaderPage.type('input[type="email"]', 'nav_leader@test.local');
    await leaderPage.type('input[type="password"]', 'Password123!');
    await Promise.all([
      leaderPage.click('button[type="submit"]'),
      leaderPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    ]);
    await sleep(1500);

    const postLoginUrl = leaderPage.url();
    assertCheck(
      'LEADER-01',
      'Leader Auth',
      'Team Leader login successfully redirects to authenticated page',
      'Not /login',
      postLoginUrl,
      !postLoginUrl.endsWith('/login')
    );

    // 2.2 Verify Cookie Attributes
    const cookies = await leaderPage.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'pnp_session');
    assertCheck(
      'COOKIE-01',
      'Cookie Security',
      'Session cookie pnp_session exists and has HttpOnly flag',
      'httpOnly: true',
      `httpOnly: ${sessionCookie?.httpOnly}`,
      Boolean(sessionCookie && sessionCookie.httpOnly)
    );
    assertCheck(
      'COOKIE-02',
      'Cookie Security',
      'Session cookie pnp_session path is /',
      '/',
      sessionCookie?.path || 'undefined',
      sessionCookie?.path === '/'
    );

    // 2.3 Navigation across all leader tabs via in-page links
    const leaderNavSequence = [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Arena', path: '/arena' },
      { name: 'Portfolio', path: '/portfolio' },
      { name: 'Team Submission', path: '/team-submission' },
    ];

    for (let i = 0; i < leaderNavSequence.length; i++) {
      const step = leaderNavSequence[i];
      // Click nav link
      const linkSelector = `header nav a[href="${step.path}"]`;
      await leaderPage.waitForSelector(linkSelector, { visible: true, timeout: 5000 });
      await leaderPage.click(linkSelector);
      await leaderPage.waitForFunction(
        (target) => window.location.pathname.startsWith(target) || window.location.pathname === target,
        { timeout: 8000 },
        step.path
      );
      await sleep(500);

      const navUrl = leaderPage.url();
      assertCheck(
        `LEADER-NAV-0${i + 1}`,
        'Leader Link Navigation',
        `Navigating to ${step.name} (${step.path}) must not redirect to /login`,
        `Contains ${step.path} without /login`,
        navUrl,
        navUrl.includes(step.path) && !navUrl.includes('/login')
      );
    }

    // 2.4 Direct URL Address Bar Navigations
    console.log('\n>>> Part 2.4: Direct URL Address Bar Navigation for Authenticated Leader');
    for (let i = 0; i < leaderNavSequence.length; i++) {
      const step = leaderNavSequence[i];
      await leaderPage.goto(`${BASE_URL}${step.path}`, { waitUntil: 'networkidle2' });
      await sleep(1000);
      const directUrl = leaderPage.url();
      assertCheck(
        `LEADER-DIRECT-0${i + 1}`,
        'Leader Direct URL',
        `Direct address bar entry of ${step.path} retains session and never loops to /login`,
        step.path,
        directUrl,
        directUrl.includes(step.path) && !directUrl.includes('/login')
      );
    }

    // 2.5 History Back & Forward Navigation
    console.log('\n>>> Part 2.5: History Back / Forward Navigation');
    await leaderPage.goBack({ waitUntil: 'networkidle2' });
    await sleep(500);
    const backUrl = leaderPage.url();
    assertCheck(
      'LEADER-HIST-01',
      'Leader History',
      'Browser Back returns to previous authenticated page without auth loop',
      'Not /login',
      backUrl,
      !backUrl.includes('/login')
    );

    await leaderPage.goForward({ waitUntil: 'networkidle2' });
    await sleep(500);
    const forwardUrl = leaderPage.url();
    assertCheck(
      'LEADER-HIST-02',
      'Leader History',
      'Browser Forward returns to /team-submission without auth loop',
      '/team-submission',
      forwardUrl,
      forwardUrl.includes('/team-submission') && !forwardUrl.includes('/login')
    );

    // 2.6 Page Refresh Integrity
    console.log('\n>>> Part 2.6: Page Reload on Authenticated Route');
    await leaderPage.reload({ waitUntil: 'networkidle2' });
    await sleep(1000);
    const reloadUrl = leaderPage.url();
    assertCheck(
      'LEADER-RELOAD-01',
      'Leader Page Reload',
      'Hard reload of current page preserves authentication without redirecting to /login',
      'Preserves auth',
      reloadUrl,
      !reloadUrl.includes('/login')
    );

    await leaderContext.close();

    // ================================================================
    // PART 3: TEAM_MEMBER AUTHENTICATION & NAVIGATION
    // ================================================================
    console.log('\n>>> Part 3: Verifying TEAM_MEMBER Auth & Navigation');
    const memberContext = await browser.createBrowserContext();
    const memberPage = await memberContext.newPage();
    await memberPage.setViewport({ width: 1280, height: 900 });

    // 3.1 Login
    await memberPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    await memberPage.type('input[type="email"]', 'nav_member@test.local');
    await memberPage.type('input[type="password"]', 'Password123!');
    await Promise.all([
      memberPage.click('button[type="submit"]'),
      memberPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    ]);
    await sleep(1500);

    const memberPostLogin = memberPage.url();
    assertCheck(
      'MEMBER-01',
      'Member Auth',
      'Team Member login successfully redirects without login loop',
      'Not /login',
      memberPostLogin,
      !memberPostLogin.endsWith('/login')
    );

    // 3.2 Member Navigation Sequence
    const memberNavSequence = [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Arena', path: '/arena' },
      { name: 'Portfolio', path: '/portfolio' },
      { name: 'My Team', path: '/team' },
    ];

    for (let i = 0; i < memberNavSequence.length; i++) {
      const step = memberNavSequence[i];
      const linkSelector = `header nav a[href="${step.path}"]`;
      await memberPage.waitForSelector(linkSelector, { visible: true, timeout: 5000 });
      await memberPage.click(linkSelector);
      await memberPage.waitForFunction(
        (target) => window.location.pathname.startsWith(target) || window.location.pathname === target,
        { timeout: 8000 },
        step.path
      );
      await sleep(500);

      const navUrl = memberPage.url();
      assertCheck(
        `MEMBER-NAV-0${i + 1}`,
        'Member Link Navigation',
        `Navigating to ${step.name} (${step.path}) must not redirect to /login`,
        `Contains ${step.path} without /login`,
        navUrl,
        navUrl.includes(step.path) && !navUrl.includes('/login')
      );
    }

    // 3.3 Direct URL navigation for Member
    for (let i = 0; i < memberNavSequence.length; i++) {
      const step = memberNavSequence[i];
      await memberPage.goto(`${BASE_URL}${step.path}`, { waitUntil: 'networkidle2' });
      await sleep(1000);
      const directUrl = memberPage.url();
      assertCheck(
        `MEMBER-DIRECT-0${i + 1}`,
        'Member Direct URL',
        `Direct address bar entry of ${step.path} preserves Member auth session`,
        step.path,
        directUrl,
        directUrl.includes(step.path) && !directUrl.includes('/login')
      );
    }

    await memberContext.close();
  } finally {
    await browser.close();
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { in: ['nav_leader@test.local', 'nav_member@test.local'] } },
    });
    await prisma.$disconnect();
  }

  // Summary Report
  console.log('\n================================================================');
  console.log('                 AUTH NAVIGATION TEST SUMMARY                    ');
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
    console.log(`\n🎉 ALL ${total} AUTH NAVIGATION & GUARD CHECKS PASSED PERFECTLY!`);
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error running auth navigation suite:', err);
  process.exit(1);
});
