import crypto from 'node:crypto';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth/password';

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

console.log('============================================================');
console.log('FINAL PRODUCTION E2E & CONCURRENCY VALIDATION TEST SUITE');
console.log(`Target Base URL: ${BASE_URL}`);
console.log('============================================================\n');

let passedTests = 0;
let failedTests = 0;

function logResult(title: string, passed: boolean, details: string[]) {
  if (passed) {
    console.log(`  [✅ PASS] ${title}`);
    details.forEach(d => console.log(`            ${d}`));
    passedTests++;
  } else {
    console.log(`  [❌ FAIL] ${title}`);
    details.forEach(d => console.log(`            ${d}`));
    failedTests++;
  }
}

async function loginUser(email: string, passwordPlain: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwordPlain }),
  });
  const data = await res.json();
  const cookieHeader = res.headers.get('set-cookie') || '';
  const match = cookieHeader.match(/pnp_session=([^;]+)/);
  const cookie = match ? `pnp_session=${match[1]}` : '';
  return { status: res.status, data, cookie };
}

async function runE2ESuite() {
  const adminEmail = 'pradeshkannan64@gmail.com';
  const adminPass = 'pradesh@2006K';
  const leaderEmail = 'kavya.ecopulse@student.tce.edu';
  const memberEmail = 'siddharth.ecopulse@student.tce.edu';
  const demoPass = 'Demo@2024';
  const investorEmail = 'investor.test@csea.edu';
  const investorPass = 'Investor@2024';

  // 0. Ensure test users & credentials in MySQL
  console.log('--- Ensuring User Accounts and Test Configuration in MySQL ---');
  await prisma.user.updateMany({
    where: { email: adminEmail },
    data: { passwordHash: hashPassword(adminPass), isActive: true, role: 'ADMIN' },
  });

  await prisma.user.updateMany({
    where: { email: { in: [leaderEmail, memberEmail] } },
    data: { passwordHash: hashPassword(demoPass), isActive: true },
  });

  let investorUser = await prisma.user.findUnique({
    where: { email: investorEmail },
    include: { wallet: true },
  });

  if (!investorUser) {
    investorUser = await prisma.user.create({
      data: {
        email: investorEmail,
        name: 'Dr. Ramesh Sundaram',
        role: 'INVESTOR',
        passwordHash: hashPassword(investorPass),
        isActive: true,
        emailVerified: true,
        avatarInitials: 'RS',
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
  } else {
    await prisma.user.update({
      where: { id: investorUser.id },
      data: {
        passwordHash: hashPassword(investorPass),
        isActive: true,
        role: 'INVESTOR',
      },
    });
    if (!investorUser.wallet) {
      await prisma.wallet.create({
        data: {
          userId: investorUser.id,
          totalCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
      });
    }
  }

  // Ensure investor has an active room assignment that contains approved ideas
  const roomWithIdeas = await prisma.room.findFirst({
    where: { status: 'OPEN', teams: { some: { idea: { isNot: null } } } },
    include: { teams: { include: { idea: true } } },
  });
  if (roomWithIdeas) {
    await prisma.user.update({
      where: { email: investorEmail },
      data: { roomId: roomWithIdeas.id },
    });
  }

  // Ensure latest event is OPEN with future expiry
  const now = new Date();
  const fourHoursLater = new Date(now.getTime() + 4 * 3600 * 1000);
  const latestEvent = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (latestEvent) {
    await prisma.event.update({
      where: { id: latestEvent.id },
      data: {
        status: 'OPEN',
        minInvestment: 20,
        maxInvestment: 100,
        totalCoins: 100,
        investmentStartsAt: now,
        investmentEndsAt: fourHoursLater,
      },
    });
  }

  // 1. Role-Based Login & Post-Login Redirection Test
  console.log('\n--- Test 1: Role Authentication & Authoritative Redirects ---');
  const adminLogin = await loginUser(adminEmail, adminPass);
  const leaderLogin = await loginUser(leaderEmail, demoPass);
  const memberLogin = await loginUser(memberEmail, demoPass);
  const investorLogin = await loginUser(investorEmail, investorPass);

  logResult(
    'Role Post-Login Routing Check',
    adminLogin.data.redirectUrl === '/admin' &&
    leaderLogin.data.redirectUrl === '/team' &&
    memberLogin.data.redirectUrl === '/team' &&
    investorLogin.data.redirectUrl === '/dashboard',
    [
      `ADMIN redirectUrl: ${adminLogin.data.redirectUrl} (expected /admin)`,
      `TEAM_LEADER redirectUrl: ${leaderLogin.data.redirectUrl} (expected /team)`,
      `TEAM_MEMBER redirectUrl: ${memberLogin.data.redirectUrl} (expected /team)`,
      `INVESTOR redirectUrl: ${investorLogin.data.redirectUrl} (expected /dashboard)`
    ]
  );

  // 2. Cross-Role Authorization Guards
  console.log('\n--- Test 2: Role Authorization & Endpoint Access Guards ---');
  const invToAdminRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Cookie: investorLogin.cookie }
  });
  const memberToSubRes = await fetch(`${BASE_URL}/api/team/submission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: memberLogin.cookie },
    body: JSON.stringify({ problem: 'Hacked Statement' })
  });
  const leaderToStatusRes = await fetch(`${BASE_URL}/api/admin/event/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: leaderLogin.cookie },
    body: JSON.stringify({ status: 'CLOSED' })
  });
  const anonToUsersRes = await fetch(`${BASE_URL}/api/admin/users`);

  logResult(
    'Strict Role Boundary Enforcement',
    invToAdminRes.status === 403 &&
    memberToSubRes.status === 403 &&
    leaderToStatusRes.status === 403 &&
    anonToUsersRes.status === 401,
    [
      `INVESTOR -> /api/admin/overview: HTTP ${invToAdminRes.status} (expected 403 FORBIDDEN)`,
      `TEAM_MEMBER -> /api/team/submission [POST]: HTTP ${memberToSubRes.status} (expected 403 FORBIDDEN)`,
      `TEAM_LEADER -> /api/admin/event/status [POST]: HTTP ${leaderToStatusRes.status} (expected 403 FORBIDDEN)`,
      `ANONYMOUS -> /api/admin/users: HTTP ${anonToUsersRes.status} (expected 401 UNAUTHENTICATED)`
    ]
  );

  // 3. Anonymous Investment Arena Sanitization & Own Team Exclusion
  console.log('\n--- Test 3: Arena Privacy & Own Team Server-Side Exclusion ---');
  const leaderIdeasRes = await fetch(`${BASE_URL}/api/ideas`, {
    headers: { Cookie: leaderLogin.cookie }
  });
  const leaderIdeas = await leaderIdeasRes.json();
  const leaderDbUser = await prisma.user.findUnique({ where: { email: leaderEmail } });
  const leaderTeam = await prisma.team.findFirst({
    where: { leaderId: leaderDbUser!.id },
    include: { idea: true }
  });
  const leaderHasOwnIdea = leaderIdeas.ideas?.some((i: any) => i.id === leaderTeam?.idea?.id);

  const invIdeasRes = await fetch(`${BASE_URL}/api/ideas`, {
    headers: { Cookie: investorLogin.cookie }
  });
  const invIdeas = await invIdeasRes.json();
  const hasLeakedData = invIdeas.ideas?.some((i: any) => i.teamName || i.teamId || i.totalInvested > 0 || i.rank !== null);

  logResult(
    'Server-Side Own Team Exclusion & Anti-Leak Filtering',
    !leaderHasOwnIdea && !hasLeakedData,
    [
      `Team Leader visible ideas: ${leaderIdeas.ideas?.length} (Own proposal included: ${leaderHasOwnIdea})`,
      `Investor pre-reveal confidential figures stripped: ${!hasLeakedData} (teamName/rank/totalInvested sanitized)`
    ]
  );

  // 4. Investment Transaction & Admin Metrics Conservation
  console.log('\n--- Test 4: Atomic Investment & Live Coin Conservation ---');
  const targetIdea = invIdeas.ideas[0];
  const refreshedInvestor = await prisma.user.findUnique({
    where: { email: investorEmail },
    include: { wallet: true }
  });
  // Reset investor wallet to 100 available coins
  await prisma.wallet.update({
    where: { userId: refreshedInvestor!.id },
    data: { availableCoins: 100, investedCoins: 0, totalCoins: 100 }
  });

  const investRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: investorLogin.cookie },
    body: JSON.stringify({ ideaId: targetIdea.id, amount: 30 })
  });
  const investData = await investRes.json();

  const updatedWallet = await prisma.wallet.findUnique({ where: { userId: investorUser!.id } });
  const adminOverviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Cookie: adminLogin.cookie }
  });
  const adminOverview = await adminOverviewRes.json();
  const stats = adminOverview.stats;
  const conservationVerified = stats.totalCoinsInvested + stats.totalCoinsRemaining === stats.totalDistributedCoins;

  logResult(
    'Investment Ledger Transaction & Exact Conservation',
    investRes.status === 200 && updatedWallet?.availableCoins === 70 && conservationVerified,
    [
      `Investment transaction HTTP: ${investRes.status}`,
      `Investor available coins: ${updatedWallet?.availableCoins} (decreased from 100 to 70)`,
      `Admin Total Distributed: ${stats.totalDistributedCoins}`,
      `Admin Coins Invested: ${stats.totalCoinsInvested}`,
      `Admin Coins Remaining: ${stats.totalCoinsRemaining}`,
      `Conservation Equation (Distributed = Invested + Remaining): ${conservationVerified}`
    ]
  );

  // 5. Concurrency & Pessimistic Row-Level Locking
  console.log('\n--- Test 5: High-Concurrency Double-Spend Race Condition ---');
  // Set investor wallet to exactly 20 available coins
  await prisma.wallet.update({
    where: { userId: investorUser!.id },
    data: { availableCoins: 20, investedCoins: 80, totalCoins: 100 }
  });

  // Launch 5 parallel requests each demanding 20 coins (100 coins requested against 20 available)
  const concurrentCalls = [1, 2, 3, 4, 5].map(() =>
    fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: investorLogin.cookie },
      body: JSON.stringify({ ideaId: targetIdea.id, amount: 20 })
    })
  );
  const concurrentResponses = await Promise.all(concurrentCalls);
  const successes = concurrentResponses.filter(r => r.status === 200).length;
  const rejections = concurrentResponses.filter(r => r.status === 400).length;
  const finalWallet = await prisma.wallet.findUnique({ where: { userId: investorUser!.id } });

  logResult(
    'Pessimistic Locking & Zero Double-Spend Guarantee',
    successes === 1 && rejections === 4 && finalWallet?.availableCoins === 0,
    [
      `Concurrent requests attempted: 5 x 20 coins = 100 coins (available: 20 coins)`,
      `Requests succeeded: ${successes} (exactly 1 expected)`,
      `Requests rejected: ${rejections} (exactly 4 expected)`,
      `Final wallet balance: ${finalWallet?.availableCoins} (never negative)`
    ]
  );

  // 6. Realtime Lifecycle Transitions & Enforcement
  console.log('\n--- Test 6: Database Lifecycle State Machine ---');
  // Pause Arena
  const pauseRes = await fetch(`${BASE_URL}/api/admin/event/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminLogin.cookie },
    body: JSON.stringify({ status: 'PAUSED' })
  });
  // Attempt investment while PAUSED -> must be rejected with 403
  const investWhilePaused = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: investorLogin.cookie },
    body: JSON.stringify({ ideaId: targetIdea.id, amount: 20 })
  });

  // Resume Arena
  const resumeRes = await fetch(`${BASE_URL}/api/admin/event/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminLogin.cookie },
    body: JSON.stringify({ status: 'OPEN' })
  });

  logResult(
    'Lifecycle State Machine & Investment Window Enforcement',
    pauseRes.status === 200 && investWhilePaused.status === 403 && resumeRes.status === 200,
    [
      `Admin Pause HTTP: ${pauseRes.status}`,
      `Investment while PAUSED: HTTP ${investWhilePaused.status} (expected 403 FORBIDDEN)`,
      `Admin Resume HTTP: ${resumeRes.status}`
    ]
  );

  // 7. Password Reset Token Security Lifecycle
  console.log('\n--- Test 7: Reset Token Lifecycle & Security Invalidation ---');
  // Attempt with invalid token
  const invalidTokenRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 'completely_fake_invalid_token_12345',
      password: 'NewPassword@2026',
      confirmPassword: 'NewPassword@2026'
    })
  });
  const invalidData = await invalidTokenRes.json();

  // Create an expired token record in MySQL
  const rawExpiredToken = 'test_expired_token_raw_abc123';
  const expiredTokenHash = crypto.createHash('sha256').update(rawExpiredToken).digest('hex');
  await prisma.passwordResetToken.deleteMany({ where: { tokenHash: expiredTokenHash } });
  await prisma.passwordResetToken.create({
    data: {
      userId: investorUser!.id,
      tokenHash: expiredTokenHash,
      expiresAt: new Date(Date.now() - 60000), // 1 minute ago
    }
  });

  const expiredTokenRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: rawExpiredToken,
      password: 'NewPassword@2026',
      confirmPassword: 'NewPassword@2026'
    })
  });
  const expiredData = await expiredTokenRes.json();

  // Clean up test token
  await prisma.passwordResetToken.deleteMany({ where: { tokenHash: expiredTokenHash } });

  logResult(
    'Password Reset Token Security Enforcement',
    invalidTokenRes.status === 400 && expiredTokenRes.status === 400 && expiredData.code === 'TOKEN_EXPIRED',
    [
      `Invalid token response: HTTP ${invalidTokenRes.status} (code: ${invalidData.code})`,
      `Expired token response: HTTP ${expiredTokenRes.status} (code: ${expiredData.code})`
    ]
  );

  // 8. Multi-User Realtime Issue Notification
  console.log('\n--- Test 8: Realtime Scoped Issue Notification ---');
  const issueRes = await fetch(`${BASE_URL}/api/team/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: memberLogin.cookie },
    body: JSON.stringify({
      issueType: 'TYPO_CORRECTION',
      message: 'Found minor typo in the target customer profile statement.'
    })
  });
  const issueData = await issueRes.json();

  const leaderNotifications = await prisma.notification.findMany({
    where: { recipientUserId: leaderTeam!.leaderId! },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  const hasReceivedNotification = leaderNotifications.length > 0 &&
    leaderNotifications[0].title.includes('Issue Reported: TYPO_CORRECTION');

  logResult(
    'Realtime Scoped Issue Notification to Team Leader',
    issueRes.status === 200 && hasReceivedNotification,
    [
      `Issue submission HTTP: ${issueRes.status}`,
      `Team Leader received targeted notification: ${hasReceivedNotification}`,
      `Notification title: "${leaderNotifications[0]?.title}"`
    ]
  );

  console.log('\n============================================================');
  console.log(`E2E SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('============================================================\n');

  if (failedTests > 0) process.exit(1);
}

runE2ESuite().catch((err) => {
  console.error('Test suite crashed with error:', err);
  process.exit(1);
});
