import puppeteer from 'puppeteer-core';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function setupTestUsers() {
  console.log('[Setup] Preparing test team, room, and users...');
  
  // Find or create a room
  let room = await prisma.room.findFirst({ where: { status: 'OPEN' } });
  if (!room) {
    room = await prisma.room.findFirst();
  }
  if (!room) {
    const event = await prisma.event.findFirst();
    room = await prisma.room.create({
      data: {
        name: 'Test Room',
        code: 'TEST-RM',
        status: 'OPEN',
        eventId: event ? event.id : undefined,
      },
    });
  }

  // Find or create a team
  let team = await prisma.team.findFirst({ where: { roomId: room.id } });
  if (!team) {
    team = await prisma.team.create({
      data: {
        name: 'Test Nav Team',
        teamId: 'TEST-NAV-01',
        submissionId: 'SUB-TEST-NAV-01',
        roomId: room.id,
      },
    });
  }

  // Cleanup old test users
  await prisma.user.deleteMany({
    where: { email: { in: ['leader@test.local', 'member@test.local'] } },
  });

  const pwdHash = hashPassword('Password123!');

  // Create Leader
  const leader = await prisma.user.create({
    data: {
      email: 'leader@test.local',
      name: 'Test Leader',
      role: 'TEAM_LEADER',
      avatarInitials: 'TL',
      passwordHash: pwdHash,
      isActive: true,
      teamId: team.id,
      roomId: room.id,
      wallet: {
        create: {
          totalCoins: 500,
          availableCoins: 500,
          investedCoins: 0,
        },
      },
    },
  });

  // Create Member
  const member = await prisma.user.create({
    data: {
      email: 'member@test.local',
      name: 'Test Member',
      role: 'TEAM_MEMBER',
      avatarInitials: 'TM',
      passwordHash: pwdHash,
      isActive: true,
      teamId: team.id,
      roomId: room.id,
      wallet: {
        create: {
          totalCoins: 500,
          availableCoins: 500,
          investedCoins: 0,
        },
      },
    },
  });

  console.log(`[Setup] Created leader (${leader.id}) and member (${member.id}) in team ${team.name} (Room: ${room.name})`);
  return { room, team, leader, member };
}

async function testUserNavigation(email: string, roleName: string) {
  console.log(`\n==================================================`);
  console.log(`  TESTING NAVIGATION FOR ${roleName}: ${email}`);
  console.log(`==================================================\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();

  // Track redirects and network
  page.on('request', (req) => {
    if (req.url().includes('/login') || req.url().includes('/api/auth/')) {
      // console.log(`  [REQ] ${req.method()} ${req.url()}`);
    }
  });

  page.on('console', (msg) => console.log('  [BROWSER CONSOLE]', msg.text()));
  page.on('pageerror', (err) => console.error('  [PAGE ERROR]', err));

  page.on('response', async (res) => {
    const status = res.status();
    const url = res.url();
    if (url.includes('/api/auth/login')) {
      try {
        const text = await res.text();
        console.log(`  [LOGIN API RESPONSE ${status}]:`, text);
      } catch {}
    }
    if (status >= 300 && status < 400) {
      console.log(`  [REDIRECT ${status}] ${url} -> ${res.headers()['location']}`);
    }
  });

  async function checkState(actionName: string) {
    const currentUrl = page.url();
    const cookies = await page.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'pnp_session');
    
    // Check me response
    const meResult = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/auth/me');
        return { status: r.status, data: await r.json() };
      } catch (e: any) {
        return { error: e.message };
      }
    });

    console.log(`\n--- Action: ${actionName} ---`);
    console.log(`  Current Path: ${new URL(currentUrl).pathname}`);
    console.log(`  Session Cookie: ${sessionCookie ? `Present (value: ${sessionCookie.value.substring(0, 8)}..., secure: ${sessionCookie.secure}, path: ${sessionCookie.path})` : 'MISSING'}`);
    console.log(`  /api/auth/me: status=${meResult.status}, auth=${meResult.data?.authenticated}, role=${meResult.data?.user?.role}`);

    if (new URL(currentUrl).pathname === '/login') {
      console.error(`  >>> REPRODUCED BUG: Redirected to /login unexpectedly! <<<`);
      return false;
    }
    return true;
  }

  // 1. Go to /login
  console.log('Step 1: Navigating to /login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]');
  await sleep(1200);

  // 2. Perform Login
  console.log(`Step 2: Submitting credentials for ${email}...`);
  await page.type('input[type="email"]', email, { delay: 20 });
  await page.type('input[type="password"]', 'Password123!', { delay: 20 });
  await sleep(600);
  await page.click('button[type="submit"]');

  await page.waitForFunction(() => window.location.pathname !== '/login', { timeout: 8000 }).catch(() => {});
  await sleep(2000);
  await checkState('Initial Login Redirect');

  // Helper to click nav links
  async function clickNavLink(linkText: string, expectedPath: string) {
    console.log(`\nNavigating: Clicking "${linkText}" -> expecting ${expectedPath}`);
    const clicked = await page.evaluate((text) => {
      const links = Array.from(document.querySelectorAll('a'));
      const found = links.find((l) => l.textContent?.trim().includes(text));
      if (found) {
        found.click();
        return true;
      }
      return false;
    }, linkText);

    if (!clicked) {
      console.warn(`  Could not find link with text "${linkText}"!`);
      // Try direct navigation if link not found
      await page.goto(`${BASE_URL}${expectedPath}`, { waitUntil: 'networkidle2' });
    } else {
      await sleep(2000);
    }
    return checkState(`Clicked "${linkText}"`);
  }

  // 3. Click Dashboard
  await clickNavLink('Dashboard', '/dashboard');

  // 4. Click Arena
  await clickNavLink('Arena', '/arena');

  // 5. Click Portfolio
  await clickNavLink('Portfolio', '/portfolio');

  // 6. Click Team Submission (or My Team)
  if (roleName === 'TEAM_LEADER') {
    await clickNavLink('Team Submission', '/team/submission');
  } else {
    await clickNavLink('My Team', '/team');
  }

  // 7. Navigate back and forth
  console.log('\n--- Navigating back and forth ---');
  await clickNavLink('Dashboard', '/dashboard');
  await clickNavLink('Arena', '/arena');
  await clickNavLink('Portfolio', '/portfolio');

  // 8. Hard refresh each page
  console.log('\n--- Testing hard refresh ---');
  await page.reload({ waitUntil: 'networkidle2' });
  await checkState('Hard refresh on Portfolio');

  // 9. Direct URL navigation
  console.log('\n--- Testing Direct URL Navigation ---');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
  await checkState('Direct URL /dashboard');

  await page.goto(`${BASE_URL}/arena`, { waitUntil: 'networkidle2' });
  await checkState('Direct URL /arena');

  await page.goto(`${BASE_URL}/portfolio`, { waitUntil: 'networkidle2' });
  await checkState('Direct URL /portfolio');

  // 10. Browser back/forward
  console.log('\n--- Testing Browser Back / Forward ---');
  await page.goBack({ waitUntil: 'networkidle2' });
  await checkState('Browser Back (should be /arena)');

  await page.goForward({ waitUntil: 'networkidle2' });
  await checkState('Browser Forward (should be /portfolio)');

  await browser.close();
}

async function main() {
  try {
    await setupTestUsers();
    await testUserNavigation('leader@test.local', 'TEAM_LEADER');
    await testUserNavigation('member@test.local', 'TEAM_MEMBER');
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    // Keep test users for now or cleanup
    await prisma.$disconnect();
  }
}

main();
