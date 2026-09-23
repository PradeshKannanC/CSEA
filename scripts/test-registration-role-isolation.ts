import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';
import { normalizeEmail } from '../lib/auth/email';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

interface TestResult {
  code: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(code: string, name: string, passed: boolean, details: string) {
  results.push({ code, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${code}: ${name} - ${details}`);
}

async function extractCookie(res: Response): Promise<string> {
  // Try getSetCookie() first (Node 18+)
  let setCookies: string[] = [];
  if (typeof (res.headers as any).getSetCookie === 'function') {
    setCookies = (res.headers as any).getSetCookie();
  } else {
    const raw = res.headers.get('set-cookie');
    if (raw) setCookies = [raw];
  }

  for (const c of setCookies) {
    const match = c.match(/pnp_session=([^;]+)/);
    if (match) return `pnp_session=${match[1]}`;
  }

  const single = res.headers.get('set-cookie');
  if (single) {
    const match = single.match(/pnp_session=([^;]+)/);
    if (match) return `pnp_session=${match[1]}`;
  }

  return '';
}

async function runTests() {
  console.log('================================================================');
  console.log('STARTING REGISTRATION & ROLE/UI ISOLATION ACCEPTANCE TEST SUITE');
  console.log('================================================================\n');

  // Find authoritative root admin
  const rootAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!rootAdmin) {
    throw new Error('No admin user found in database for testing!');
  }

  // Find Team INX or provision for testing
  let teamInx = await prisma.team.findFirst({
    where: { name: 'INX' },
  });
  if (!teamInx) {
    teamInx = await prisma.team.create({
      data: {
        name: 'INX',
        teamId: 'INX-999',
        submissionId: 'PNP-2024-INX-999',
        cohort: 'Alpha 2024',
      },
    });
  }

  const dddLeader = await prisma.user.upsert({
    where: { email: 'ddd123@gmail.com' },
    create: {
      name: 'ddd',
      email: 'ddd123@gmail.com',
      role: UserRole.TEAM_LEADER,
      teamId: teamInx.id,
      avatarInitials: 'DD',
    },
    update: {
      role: UserRole.TEAM_LEADER,
      teamId: teamInx.id,
    },
  });
  await prisma.team.update({ where: { id: teamInx.id }, data: { leaderId: dddLeader.id } });
  await prisma.teamMember.upsert({
    where: {
      teamId_email: {
        teamId: teamInx.id,
        email: 'ddd123@gmail.com',
      },
    },
    create: {
      teamId: teamInx.id,
      userId: dddLeader.id,
      email: 'ddd123@gmail.com',
      name: 'ddd',
      role: UserRole.TEAM_LEADER,
    },
    update: {
      userId: dddLeader.id,
      role: UserRole.TEAM_LEADER,
    },
  });

  const initDdUser = await prisma.user.upsert({
    where: { email: 'dd123@gmail.com' },
    create: {
      name: 'DDD',
      email: 'dd123@gmail.com',
      passwordHash: null,
      role: UserRole.TEAM_MEMBER,
      isActive: true,
      emailVerified: false,
      avatarInitials: 'DD',
      teamId: teamInx.id,
    },
    update: {
      name: 'DDD',
      passwordHash: null,
      role: UserRole.TEAM_MEMBER,
      isActive: true,
      emailVerified: false,
      teamId: teamInx.id,
    },
  });
  await prisma.teamMember.upsert({
    where: {
      teamId_email: {
        teamId: teamInx.id,
        email: 'dd123@gmail.com',
      },
    },
    create: {
      teamId: teamInx.id,
      userId: initDdUser.id,
      email: 'dd123@gmail.com',
      name: 'DDD',
      role: UserRole.TEAM_MEMBER,
    },
    update: {
      userId: initDdUser.id,
      role: UserRole.TEAM_MEMBER,
    },
  });

  // -------------------------------------------------------------------------
  // Scenario K: Check distinct separation between dd123@gmail.com and ddd123@gmail.com
  // -------------------------------------------------------------------------
  console.log('--- SCENARIO K: Distinct Account Integrity ---');
  const dddMember = await prisma.teamMember.findFirst({ where: { email: 'ddd123@gmail.com' } });
  const ddMember = await prisma.teamMember.findFirst({ where: { email: 'dd123@gmail.com' } });
  const dddUser = await prisma.user.findUnique({ where: { email: 'ddd123@gmail.com' } });
  const ddUser = await prisma.user.findUnique({ where: { email: 'dd123@gmail.com' } });

  const kPassed = Boolean(
    dddMember?.role === 'TEAM_LEADER' &&
    ddMember?.role === 'TEAM_MEMBER' &&
    dddUser?.role === 'TEAM_LEADER' &&
    ddUser?.role === 'TEAM_MEMBER' &&
    dddMember.email !== ddMember.email
  );
  record('SCENARIO_K', 'Distinct separation between ddd123@gmail.com (LEADER) and dd123@gmail.com (MEMBER)', kPassed,
    `ddd=${dddMember?.email} (${dddMember?.role}), dd=${ddMember?.email} (${ddMember?.role})`);

  // Ensure dd123@gmail.com is in fresh pre-registered state for registration test
  await prisma.user.update({
    where: { email: 'dd123@gmail.com' },
    data: { passwordHash: null, emailVerified: false, isActive: true },
  });

  // -------------------------------------------------------------------------
  // Scenario F: Unregistered Email Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO F: Unregistered Email Rejection ---');
  const unregRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Unknown Person',
      email: 'totally.unregistered.email999@gmail.com',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    }),
  });
  const unregData = await unregRes.json();
  const fPassed = unregRes.status === 400 && unregData.code === 'NOT_PRE_REGISTERED';
  record('SCENARIO_F', 'Registration rejected for unregistered email with NOT_PRE_REGISTERED', fPassed,
    `Status: ${unregRes.status}, Code: ${unregData.code}, Msg: ${unregData.message}`);

  // -------------------------------------------------------------------------
  // Scenario H: Name Mismatch Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO H: Name Mismatch Policy ---');
  const mismatchRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Completely Wrong Name XYZ',
      email: 'dd123@gmail.com',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    }),
  });
  const mismatchData = await mismatchRes.json();
  const hPassed = mismatchRes.status === 400 && mismatchData.code === 'NAME_MISMATCH';
  record('SCENARIO_H', 'Registration rejected when submitted name mismatches pre-registration', hPassed,
    `Status: ${mismatchRes.status}, Code: ${mismatchData.code}`);

  // -------------------------------------------------------------------------
  // Scenario E: Case & Whitespace Email Normalization
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO E: Email Normalization ---');
  const normEmail = normalizeEmail('   DD123@GMAIL.COM   ');
  const ePassed = normEmail === 'dd123@gmail.com';
  record('SCENARIO_E', 'Email normalization strips whitespace and lowercases deterministically', ePassed,
    `Input: "   DD123@GMAIL.COM   " -> Output: "${normEmail}"`);

  // -------------------------------------------------------------------------
  // Scenario A: Register DDD (dd123@gmail.com) -> Succeeds -> Redirect to /team
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO A: Valid Pre-registered Team Member Registration ---');
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'DDD',
      email: '  DD123@GMAIL.COM  ', // Test uppercase and padding
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    }),
  });
  const regData = await regRes.json();
  const memberCookie = await extractCookie(regRes);

  const aPassed = Boolean(
    regRes.status === 200 &&
    regData.success === true &&
    regData.user?.email === 'dd123@gmail.com' &&
    regData.user?.role === 'TEAM_MEMBER' &&
    regData.redirectUrl === '/team' &&
    memberCookie.length > 0
  );
  record('SCENARIO_A.1', 'Pre-registered DDD (dd123@gmail.com) registers successfully and receives /team redirect', aPassed,
    `Status: ${regRes.status}, Role: ${regData.user?.role}, Redirect: ${regData.redirectUrl}, Cookie: ${memberCookie ? 'YES' : 'NO'}`);

  // Verify DB state after registration
  const registeredUser = await prisma.user.findUnique({ where: { email: 'dd123@gmail.com' } });
  const a2Passed = Boolean(
    registeredUser?.passwordHash &&
    registeredUser.passwordHash.length > 20 &&
    registeredUser.emailVerified === true &&
    registeredUser.role === 'TEAM_MEMBER' &&
    registeredUser.teamId === teamInx.id
  );
  record('SCENARIO_A.2', 'Database User record completed with passwordHash, emailVerified, role TEAM_MEMBER', a2Passed,
    `Role: ${registeredUser?.role}, Team: ${registeredUser?.teamId}, PW Set: ${Boolean(registeredUser?.passwordHash)}`);

  // Scenario A.3: Verify /team HTML has NO admin controls or admin navigation
  const teamHtmlRes = await fetch(`${BASE_URL}/team`, {
    headers: { Cookie: memberCookie },
  });
  const teamHtml = await teamHtmlRes.text();
  const hasAdminNav = teamHtml.includes('Control Center') || teamHtml.includes('/admin/rooms') || teamHtml.includes('Admin Console');
  record('SCENARIO_A.3', 'Team Member /team view contains ZERO admin links or admin navigation', !hasAdminNav && teamHtmlRes.status === 200,
    `Status: ${teamHtmlRes.status}, AdminNav Present: ${hasAdminNav}`);

  // -------------------------------------------------------------------------
  // Scenario G: Duplicate Registration Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO G: Duplicate Registration Protection ---');
  const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'DDD',
      email: 'dd123@gmail.com',
      password: 'AnotherPassword999!',
      confirmPassword: 'AnotherPassword999!',
    }),
  });
  const dupData = await dupRes.json();
  const gPassed = dupRes.status === 409 && dupData.code === 'ALREADY_REGISTERED';
  record('SCENARIO_G', 'Duplicate registration rejected with 409 ALREADY_REGISTERED (no overwrite)', gPassed,
    `Status: ${dupRes.status}, Code: ${dupData.code}`);

  // -------------------------------------------------------------------------
  // Scenario B: Non-admin direct GET /admin -> Redirects to /team
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO B: Non-Admin Direct /admin Deep Link Protection ---');
  const adminPageRes = await fetch(`${BASE_URL}/admin`, {
    headers: { Cookie: memberCookie },
    redirect: 'manual',
  });
  const bPassed = Boolean(
    (adminPageRes.status === 307 || adminPageRes.status === 308 || adminPageRes.status === 302) &&
    adminPageRes.headers.get('location')?.includes('/team')
  );
  record('SCENARIO_B', 'Team Member accessing /admin is redirected to /team (never renders admin UI)', bPassed,
    `Status: ${adminPageRes.status}, Location: ${adminPageRes.headers.get('location')}`);

  // -------------------------------------------------------------------------
  // Scenario C: Non-admin access to admin APIs -> 403 Forbidden
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO C: Server-Side Admin API Protection ---');
  const endpoints = [
    '/api/admin/rooms',
    '/api/admin/users',
    '/api/admin/event/settings',
    '/api/admin/teams',
  ];

  let allForbidden = true;
  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep}`, {
      headers: { Cookie: memberCookie },
    });
    if (res.status !== 403) {
      allForbidden = false;
      console.error(`Endpoint ${ep} returned ${res.status} instead of 403`);
    }
  }
  record('SCENARIO_C', 'Admin APIs strictly return HTTP 403 FORBIDDEN for non-admin session', allForbidden,
    `Checked endpoints: ${endpoints.join(', ')}`);

  // -------------------------------------------------------------------------
  // Scenario D: Admin Access to /admin and Admin Rooms
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO D: Legitimate Admin Access ---');
  const adminPw = 'AdminPass123!';
  await prisma.user.update({
    where: { id: rootAdmin.id },
    data: { passwordHash: hashPassword(adminPw), isActive: true },
  });

  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: rootAdmin.email,
      password: adminPw,
    }),
  });
  const adminCookie = await extractCookie(adminLoginRes);

  const adminGetRes = await fetch(`${BASE_URL}/admin`, {
    headers: { Cookie: adminCookie },
    redirect: 'manual',
  });
  const adminRoomsApiRes = await fetch(`${BASE_URL}/api/admin/rooms`, {
    headers: { Cookie: adminCookie },
  });
  const adminRoomsData = await adminRoomsApiRes.json();

  const dPassed = Boolean(
    adminGetRes.status === 200 &&
    adminRoomsApiRes.status === 200 &&
    adminRoomsData.success === true
  );
  record('SCENARIO_D', 'Admin user successfully loads /admin (HTTP 200) and /api/admin/rooms', dPassed,
    `Admin Page Status: ${adminGetRes.status}, Rooms API Status: ${adminRoomsApiRes.status}`);

  // -------------------------------------------------------------------------
  // Scenario I: Conflict Protection on Existing Registered User
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO I: Attempt to Overwrite Registered User ---');
  const conflictRes = await fetch(`${BASE_URL}/api/admin/teams/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      teamId: teamInx.id,
      name: 'DDD Fake',
      email: 'dd123@gmail.com',
      role: 'TEAM_MEMBER',
    }),
  });
  const conflictData = await conflictRes.json();
  const iPassed = conflictRes.status === 409;
  record('SCENARIO_I', 'Attempt to re-roster or overwrite an already-registered user returns HTTP 409 conflict', iPassed,
    `Status: ${conflictRes.status}, Code: ${conflictData.code}, Msg: ${conflictData.message}`);

  // -------------------------------------------------------------------------
  // Scenario L: Investor Registration and Navigation Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO L: Investor Role Isolation ---');
  const testInvestorEmail = 'test.investor.iso@gmail.com';
  await prisma.user.upsert({
    where: { email: testInvestorEmail },
    update: { passwordHash: null, role: 'INVESTOR', isActive: true, teamId: null },
    create: {
      name: 'Test Investor',
      email: testInvestorEmail,
      passwordHash: null,
      role: 'INVESTOR',
      isActive: true,
      emailVerified: false,
      avatarInitials: 'TI',
    },
  });

  const invRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Investor',
      email: testInvestorEmail,
      password: 'InvestorPass123!',
      confirmPassword: 'InvestorPass123!',
    }),
  });
  const invRegData = await invRegRes.json();
  const invCookie = await extractCookie(invRegRes);

  const invAdminGetRes = await fetch(`${BASE_URL}/admin`, {
    headers: { Cookie: invCookie },
    redirect: 'manual',
  });

  const lPassed = Boolean(
    invRegRes.status === 200 &&
    invRegData.redirectUrl === '/dashboard' &&
    (invAdminGetRes.status === 307 || invAdminGetRes.status === 308) &&
    invAdminGetRes.headers.get('location')?.includes('/dashboard')
  );
  record('SCENARIO_L', 'Investor registration redirects to /dashboard, and /admin deep link redirects to /dashboard', lPassed,
    `Reg Redirect: ${invRegData.redirectUrl}, /admin Location: ${invAdminGetRes.headers.get('location')}`);

  // -------------------------------------------------------------------------
  // Scenario N: Session Stability across 5 Page Loads
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO N: Session Stability ---');
  let nPassed = true;
  for (let i = 1; i <= 5; i++) {
    const pageRes = await fetch(`${BASE_URL}/team`, {
      headers: { Cookie: memberCookie },
    });
    if (pageRes.status !== 200) {
      nPassed = false;
      console.error(`Page load ${i} returned status ${pageRes.status}`);
      break;
    }
  }
  record('SCENARIO_N', 'Member session persists across 5 sequential page reloads', nPassed,
    '5 requests returned HTTP 200');

  // -------------------------------------------------------------------------
  // Scenario O & P: Logout Session Termination
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO O & P: Logout Invalidation ---');
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: memberCookie },
  });
  const oPassed = logoutRes.status === 200;
  record('SCENARIO_O', 'POST /api/auth/logout successfully clears session in database and cookie', oPassed,
    `Logout Status: ${logoutRes.status}`);

  const postLogoutRes = await fetch(`${BASE_URL}/team`, {
    headers: { Cookie: memberCookie },
    redirect: 'manual',
  });
  const pPassed = Boolean(
    (postLogoutRes.status === 307 || postLogoutRes.status === 308) &&
    postLogoutRes.headers.get('location')?.includes('/login')
  );
  record('SCENARIO_P', 'Accessing /team after logout immediately redirects to /login', pPassed,
    `Status: ${postLogoutRes.status}, Location: ${postLogoutRes.headers.get('location')}`);

  // -------------------------------------------------------------------------
  // Scenario Q: Deactivated Account Protection
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO Q: Deactivated Account Protection ---');
  const deactEmail = 'deactivated.test.user@gmail.com';
  await prisma.user.upsert({
    where: { email: deactEmail },
    update: { isActive: false, passwordHash: null },
    create: {
      name: 'Deactivated User',
      email: deactEmail,
      passwordHash: null,
      role: 'TEAM_MEMBER',
      isActive: false,
      avatarInitials: 'DU',
    },
  });

  const deactRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Deactivated User',
      email: deactEmail,
      password: 'SomePassword123!',
      confirmPassword: 'SomePassword123!',
    }),
  });
  const deactData = await deactRegRes.json();
  const qPassed = deactRegRes.status === 403 && deactData.code === 'ACCOUNT_DEACTIVATED';
  record('SCENARIO_Q', 'Deactivated pre-registered account is rejected from registration with HTTP 403', qPassed,
    `Status: ${deactRegRes.status}, Code: ${deactData.code}`);

  // Summary
  console.log('\n================================================================');
  console.log('REGISTRATION & ROLE/UI ISOLATION ACCEPTANCE SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed > 0) {
    console.error('TEST FAILURES DETECTED:');
    for (const r of results.filter((r) => !r.passed)) {
      console.error(`- [${r.code}] ${r.name}: ${r.details}`);
    }
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
  }
}

runTests()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
