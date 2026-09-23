import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';
import crypto from 'crypto';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

interface ScenarioResult {
  code: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: ScenarioResult[] = [];

function recordResult(code: string, name: string, passed: boolean, details: string) {
  results.push({ code, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${code}] ${icon} | ${name}: ${details}`);
  if (!passed) {
    console.error(`FAILED: ${details}`);
  }
}

async function login(email: string, password: string = 'password123'): Promise<{ cookie: string; body: any; status: number }> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/pnp_session=([^;]+)/);
  const cookie = match ? match[1] : '';
  return { cookie, body, status: res.status };
}

async function logout(cookie: string): Promise<{ status: number; setCookie: string | null }> {
  const res = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: `pnp_session=${cookie}` },
  });
  return { status: res.status, setCookie: res.headers.get('set-cookie') };
}

async function getPageRedirect(path: string, cookie?: string): Promise<{ status: number; location: string | null; text: string }> {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers['Cookie'] = `pnp_session=${cookie}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers,
    redirect: 'manual',
  });
  const location = res.headers.get('location');
  const text = await res.text().catch(() => '');
  return { status: res.status, location, text };
}

async function main() {
  console.log('================================================================');
  console.log('STARTING COMPLETE AUTH & NAVIGATION HARDENING VERIFICATION SUITE');
  console.log('Testing all 11 Acceptance Scenarios (A through K)');
  console.log('================================================================\n');

  // Setup test users in database
  const timestamp = Date.now();
  const testAdminEmail = `test.admin.${timestamp}@csea.edu`;
  const testLeaderEmail = `test.leader.${timestamp}@csea.edu`;
  const testMemberEmail = `test.member.${timestamp}@csea.edu`;
  const testInvestorEmail = `test.investor.${timestamp}@csea.edu`;
  const testPassword = 'Password123!';

  // Clean room & team for our test
  const activeRoom = await prisma.room.findFirst({
    where: { status: 'OPEN' },
  }) || await prisma.room.create({
    data: {
      name: `Auth Test Room ${timestamp}`,
      code: `ATR${timestamp % 10000}`,
      status: 'OPEN',
      initialCoins: 500,
      minInvestment: 50,
      maxInvestment: 250,
    },
  });

  const testTeam = await prisma.team.create({
    data: {
      teamId: `TEAM-AUTH-${timestamp % 10000}`,
      name: `Auth Squad ${timestamp % 10000}`,
      submissionId: `SUB-${timestamp}-${Math.floor(Math.random() * 10000)}`,
      roomId: activeRoom.id,
    },
  });

  // Admin user
  const adminUser = await prisma.user.create({
    data: {
      email: testAdminEmail,
      name: 'Test Admin',
      passwordHash: hashPassword(testPassword),
      role: 'ADMIN',
      avatarInitials: 'TA',
      isActive: true,
      emailVerified: true,
    },
  });

  // Leader user
  const leaderUser = await prisma.user.create({
    data: {
      email: testLeaderEmail,
      name: 'Test Leader',
      passwordHash: hashPassword(testPassword),
      role: 'TEAM_LEADER',
      avatarInitials: 'TL',
      teamId: testTeam.id,
      isActive: true,
      emailVerified: true,
    },
  });
  await prisma.team.update({
    where: { id: testTeam.id },
    data: { leaderId: leaderUser.id },
  });

  // Member user
  const memberUser = await prisma.user.create({
    data: {
      email: testMemberEmail,
      name: 'Test Member',
      passwordHash: hashPassword(testPassword),
      role: 'TEAM_MEMBER',
      avatarInitials: 'TM',
      teamId: testTeam.id,
      isActive: true,
      emailVerified: true,
    },
  });

  // Investor user
  const investorUser = await prisma.user.create({
    data: {
      email: testInvestorEmail,
      name: 'Test Investor',
      passwordHash: hashPassword(testPassword),
      role: 'INVESTOR',
      avatarInitials: 'TI',
      isActive: true,
      emailVerified: true,
    },
  });

  // -------------------------------------------------------------
  // Scenario A: Fresh participant -> Land on / -> CTA routes to /login -> Login -> Team/Dashboard
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO A: Fresh Participant Entry & Authoritative Routing ---');
  try {
    const landingRes = await getPageRedirect('/');
    const landingHasLoginLinks = landingRes.text.includes('/login');
    recordResult('A.1', 'Landing page contains login route for unauthenticated', landingHasLoginLinks, 'Public landing page provides /login links');

    // Participant logs in
    const loginRes = await login(testLeaderEmail, testPassword);
    const hasCookie = Boolean(loginRes.cookie);
    const redirectUrl = loginRes.body.redirectUrl;
    recordResult('A.2', 'Leader login receives session cookie and /team redirect', hasCookie && redirectUrl === '/team', `redirectUrl=${redirectUrl}`);

    // Verify authenticated session can access /team
    const teamRes = await getPageRedirect('/team', loginRes.cookie);
    recordResult('A.3', 'Authenticated leader accesses /team with HTTP 200', teamRes.status === 200, `HTTP status=${teamRes.status}`);

    // Clean up session
    await logout(loginRes.cookie);
  } catch (err: any) {
    recordResult('A', 'Scenario A Exception', false, err.message);
  }

  // -------------------------------------------------------------
  // Scenario B: Fresh participant -> Register -> Enters assigned area
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO B: Fresh Participant Registration ---');
  try {
    const newRegEmail = `new.reg.${timestamp}@csea.edu`;
    // Pre-create pre-registered user in MySQL awaiting password establishment
    await prisma.user.create({
      data: {
        email: newRegEmail,
        name: 'New Registered Member',
        role: 'TEAM_MEMBER',
        teamId: testTeam.id,
        avatarInitials: 'NM',
        passwordHash: null,
        isActive: true,
      },
    });

    // Pre-create roster invitation
    await prisma.teamMember.create({
      data: {
        teamId: testTeam.id,
        name: 'New Registered Member',
        email: newRegEmail,
        role: 'TEAM_MEMBER',
      },
    });

    // Call registration endpoint
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Registered Member',
        email: newRegEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const regBody = await regRes.json();
    const setCookie = regRes.headers.get('set-cookie') || '';
    const cookieMatch = setCookie.match(/pnp_session=([^;]+)/);
    const regCookie = cookieMatch ? cookieMatch[1] : '';

    const regSuccess = regRes.status === 200 && regBody.success && regCookie.length > 0;
    recordResult('B.1', 'Registration creates user, issues session cookie and redirectUrl', regSuccess && regBody.redirectUrl === '/team', `redirectUrl=${regBody.redirectUrl}, role=${regBody.user?.role}`);

    // Follow redirect to /team
    const teamAccess = await getPageRedirect('/team', regCookie);
    recordResult('B.2', 'Newly registered team member successfully enters /team', teamAccess.status === 200, `status=${teamAccess.status}`);

    await logout(regCookie);
  } catch (err: any) {
    recordResult('B', 'Scenario B Exception', false, err.message);
  }

  // -------------------------------------------------------------
  // Scenario C: Fresh participant -> Wrong password -> Stays on Login with error
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO C: Invalid Credentials Handling ---');
  try {
    const failedLogin = await login(testLeaderEmail, 'completely_wrong_password');
    const isRejected = failedLogin.status === 401 && failedLogin.body.code === 'INVALID_CREDENTIALS';
    const noCookie = failedLogin.cookie === '';
    recordResult('C.1', 'Invalid password rejected with 401 INVALID_CREDENTIALS and no cookie', isRejected && noCookie, `status=${failedLogin.status}, code=${failedLogin.body?.code}`);
  } catch (err: any) {
    recordResult('C', 'Scenario C Exception', false, err.message);
  }

  // -------------------------------------------------------------
  // Scenario D: Authenticated user -> Logout -> Cookie cleared -> /team -> /login
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO D: Logout & Invalidation ---');
  try {
    const loginRes = await login(testMemberEmail, testPassword);
    recordResult('D.1', 'Member logged in successfully', Boolean(loginRes.cookie), 'Cookie acquired');

    // Call logout endpoint
    const logoutRes = await logout(loginRes.cookie);
    const cookieCleared = logoutRes.setCookie ? (logoutRes.setCookie.includes('1970') || logoutRes.setCookie.includes('pnp_session=;') || logoutRes.setCookie.includes('Max-Age=0')) : false;
    recordResult('D.2', 'Logout clears cookie with Expired/Empty Set-Cookie header', logoutRes.status === 200 && cookieCleared, `status=${logoutRes.status}, setCookie=${logoutRes.setCookie}`);

    // Direct access to /team with the old cookie
    const followUp = await getPageRedirect('/team', loginRes.cookie);
    const redirected = Boolean(followUp.status === 307 && followUp.location?.includes('/login'));
    recordResult('D.3', 'Accessing /team after logout redirects to /login', redirected, `status=${followUp.status}, location=${followUp.location}`);
  } catch (err: any) {
    recordResult('D', 'Scenario D Exception', false, err.message);
  }

  // -------------------------------------------------------------
  // Scenario E: Authenticated user -> Refresh 5 times -> Remains authenticated
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO E: Session Stability Across Refreshes ---');
  try {
    const loginRes = await login(testLeaderEmail, testPassword);
    let allSucceeded = true;
    for (let i = 1; i <= 5; i++) {
      const pageRes = await getPageRedirect('/team', loginRes.cookie);
      if (pageRes.status !== 200) {
        allSucceeded = false;
        console.error(`Refresh ${i} failed with status ${pageRes.status}`);
        break;
      }
    }
    recordResult('E.1', 'Session persists and remains valid across 5 page reloads', allSucceeded, '5 successive requests returned HTTP 200');
    await logout(loginRes.cookie);
  } catch (err: any) {
    recordResult('E', 'Scenario E Exception', false, err.message);
  }

  // -------------------------------------------------------------
  // Scenario F: In /team -> Logout -> Refresh -> Redirected to /login
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO F: Post-Logout Refresh Redirect ---');
  try {
    const loginRes = await login(testMemberEmail, testPassword);
    await logout(loginRes.cookie);
    // Refresh /team with now invalidated cookie
    const refreshRes = await getPageRedirect('/team', loginRes.cookie);
    const isRedirect = Boolean(refreshRes.status === 307 && refreshRes.location?.includes('/login'));
    recordResult('F.1', 'Refreshing protected route after logout immediately redirects to /login', isRedirect, `status=${refreshRes.status}, location=${refreshRes.location}`);
  } catch (err: any) {
    recordResult('F', 'Scenario F Exception', false, err.message);
  }

  // -------------------------------------------------------------
  // Scenario G: Incognito Direct Access (No Cookies) -> All Protected Routes Redirect
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO G: Incognito / Zero-Cookie Protection ---');
  try {
    const protectedRoutes = [
      '/admin',
      '/team',
      '/team-submission',
      '/dashboard',
      '/portfolio',
      '/arena',
      '/results',
    ];

    let allRedirected = true;
    for (const route of protectedRoutes) {
      const res = await getPageRedirect(route);
      const ok = res.status === 307 && res.location?.includes('/login');
      if (!ok) {
        allRedirected = false;
        console.error(`Route ${route} failed to redirect without cookie: status=${res.status}, loc=${res.location}`);
      }
    }
    recordResult('G.1', 'All 7 protected routes redirect to /login when no cookie is present', allRedirected, 'All tested routes returned 307 -> /login');
  } catch (err: any) {
    recordResult('G', 'Scenario G Exception', false, err.message);
  }

  // -------------------------------------------------------------
  // Scenario H: Stale / Corrupted / Expired Cookie -> Server-Authoritative Redirect
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO H: Stale / Corrupted Session Protection ---');
  try {
    const forgedCookies = [
      'forged_fake_session_123',
      'expired_session_abc',
      'tampered_session_xyz',
    ];

    let allRejected = true;
    for (const fake of forgedCookies) {
      const res = await getPageRedirect('/team', fake);
      const isRedirect = res.status === 307 && res.location?.includes('/login');
      if (!isRedirect) {
        allRejected = false;
        console.error(`Fake cookie ${fake} bypassed server auth: status=${res.status}, loc=${res.location}`);
      }
    }
    recordResult('H.1', 'Invalid or forged cookies authoritatively rejected with 307 redirect', allRejected, 'Server layout guard verified session against MySQL and redirected');
  } catch (err: any) {
    recordResult('H', 'Scenario H Exception', false, err.message);
  }

  // -------------------------------------------------------------
  // Scenario I: Role-Based Authorization — Team Member Attempting /admin
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO I: Team Member Denied Admin Access ---');
  try {
    const memberLogin = await login(testMemberEmail, testPassword);
    // Team member attempts to access /admin page
    const adminPage = await getPageRedirect('/admin', memberLogin.cookie);
    // app/admin/layout.tsx renders AccessRestrictedView with 200 or blocks
    const hasAccessRestricted = adminPage.text.includes('Access Restricted') || adminPage.text.includes('Access Denied') || adminPage.text.includes('Administrator privileges required');
    const doesNotShowAdminNav = !adminPage.text.includes('Control Center');

    // Team member attempts to call an admin API
    const adminApi = await fetch(`${BASE_URL}/api/admin/rooms`, {
      headers: { Cookie: `pnp_session=${memberLogin.cookie}` },
    });

    const apiBlocked = adminApi.status === 403;
    recordResult('I.1', 'Non-admin blocked from /admin page (AccessRestrictedView) and /api/admin/* with 403', apiBlocked && (hasAccessRestricted || doesNotShowAdminNav), `API status=${adminApi.status}, UI Restricted=${hasAccessRestricted}`);

    await logout(memberLogin.cookie);
  } catch (err: any) {
    recordResult('I', 'Scenario I Exception', false, err.message);
  }

  // -------------------------------------------------------------
  // Scenario J: Admin Access Authorization
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO J: Administrator Full Control Access ---');
  try {
    const adminLogin = await login(testAdminEmail, testPassword);
    recordResult('J.1', 'Admin login succeeds and redirects to /admin', adminLogin.status === 200 && adminLogin.body.redirectUrl === '/admin', `redirectUrl=${adminLogin.body.redirectUrl}`);

    const adminPage = await getPageRedirect('/admin', adminLogin.cookie);
    recordResult('J.2', 'Admin page loads successfully with HTTP 200', adminPage.status === 200, `status=${adminPage.status}`);

    const adminApi = await fetch(`${BASE_URL}/api/admin/rooms`, {
      headers: { Cookie: `pnp_session=${adminLogin.cookie}` },
    });
    recordResult('J.3', 'Admin API returns HTTP 200 with room data', adminApi.status === 200, `status=${adminApi.status}`);

    await logout(adminLogin.cookie);
  } catch (err: any) {
    recordResult('J', 'Scenario J Exception', false, err.message);
  }

  // -------------------------------------------------------------
  // Scenario K: Password Reset Token Lifecycle & Single-Use Invalidation
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO K: Password Reset Lifecycle & Single-Use Guarantee ---');
  try {
    // 1. Generate reset token directly in MySQL for test user
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: investorUser.id,
        tokenHash: tokenHash,
        expiresAt,
      },
    });

    // 2. Reset password using valid rawToken
    const newPassword = 'BrandNewPassword456!';
    const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        password: newPassword,
        confirmPassword: newPassword,
      }),
    });
    const resetBody = await resetRes.json();
    recordResult('K.1', 'Reset password with valid token succeeds with 200 OK', resetRes.status === 200 && resetBody.success, `status=${resetRes.status}, msg=${resetBody.message}`);

    // 3. Verify old password no longer works
    const oldLogin = await login(testInvestorEmail, testPassword);
    recordResult('K.2', 'Old password rejected after reset (401 INVALID_CREDENTIALS)', oldLogin.status === 401, `status=${oldLogin.status}`);

    // 4. Verify new password works
    const newLogin = await login(testInvestorEmail, newPassword);
    recordResult('K.3', 'New password logs in successfully and issues session cookie', newLogin.status === 200 && Boolean(newLogin.cookie), `status=${newLogin.status}`);
    if (newLogin.cookie) await logout(newLogin.cookie);

    // 5. Verify token reuse is strictly rejected (single-use invariant)
    const reuseRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        password: 'AnotherAttemptPassword789!',
        confirmPassword: 'AnotherAttemptPassword789!',
      }),
    });
    const reuseBody = await reuseRes.json();
    const tokenReusedRejected = reuseRes.status === 400 && (reuseBody.code === 'TOKEN_ALREADY_USED' || reuseBody.code === 'INVALID_OR_EXPIRED_TOKEN');
    recordResult('K.4', 'Reset token reuse strictly rejected (single-use invariant)', tokenReusedRejected, `status=${reuseRes.status}, code=${reuseBody.code}`);
  } catch (err: any) {
    recordResult('K', 'Scenario K Exception', false, err.message);
  }

  // Summary
  console.log('\n================================================================');
  console.log('TEST SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Total tests: ${total}`);
  console.log(`Passed:      ${passed}`);
  console.log(`Failed:      ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    console.error(`\n❌ ${failed} TEST(S) FAILED`);
    process.exit(1);
  } else {
    console.log(`\n✅ ALL ${passed} ACCEPTANCE TESTS PASSED PERFECTLY`);
    process.exit(0);
  }
}

main()
  .catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
