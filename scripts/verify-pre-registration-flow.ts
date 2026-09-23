import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

interface StepResult {
  step: string;
  passed: boolean;
  details?: any;
}

const results: StepResult[] = [];

function record(step: string, passed: boolean, details?: any) {
  results.push({ step, passed, details });
  const tag = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${tag} ${step}${details !== undefined ? ` -> ${typeof details === 'object' ? JSON.stringify(details) : details}` : ''}`);
}

async function createAdminSession(adminUserId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const sessionToken = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      id: sessionToken,
      userId: adminUserId,
      expiresAt,
    },
  });
  return sessionToken;
}

async function main() {
  console.log('================================================================');
  console.log('  VERIFICATION SUITE: PRE-REGISTRATION & AUTH ARCHITECTURE      ');
  console.log('================================================================\n');

  // Find admin user
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) throw new Error('No admin user found in database');

  const adminSessionId = await createAdminSession(adminUser.id);
  const adminHeaders = {
    Cookie: `pnp_session=${adminSessionId}`,
    'Content-Type': 'application/json',
  };

  // Find Team ABC
  const teamABC = await prisma.team.findFirst({ where: { name: 'ABC' } });
  if (!teamABC) throw new Error('Team ABC not found');

  // Find another team for cross-team attack test
  const otherTeam = await prisma.team.findFirst({ where: { id: { not: teamABC.id } } });
  if (!otherTeam) throw new Error('Other team not found');

  const timestamp = Date.now();
  const testMemberEmail = `prereg.member.${timestamp}@student.tce.edu`;
  const testLeaderEmail = `prereg.leader.${timestamp}@student.tce.edu`;
  const testInvestorEmail = `prereg.investor.${timestamp}@student.tce.edu`;
  const unknownEmail = `unknown.user.${timestamp}@student.tce.edu`;

  // Create temporary teams so tests are 100% isolated and don't hit production team member limits
  const memberTeam = await prisma.team.create({
    data: {
      teamId: `MEM-${timestamp}`.slice(0, 10),
      name: `Member Test Team ${timestamp}`,
      submissionId: `PNP-M-${timestamp}`,
      roomId: teamABC.roomId,
    },
  });

  // Create a temporary team for Leader test so we don't violate single leader rule on existing teams
  const tempTeam = await prisma.team.create({
    data: {
      teamId: `LEAD-${timestamp}`.slice(0, 10),
      name: `Leader Test Team ${timestamp}`,
      submissionId: `PNP-L-${timestamp}`,
      roomId: teamABC.roomId,
    },
  });

  try {
    // -----------------------------------------------------------------
    // TEST 1: Admin pre-registers TEAM_MEMBER with Team (NO password)
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 1: ADMIN PRE-REGISTERS TEAM_MEMBER');
    const resPreRegMember = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Member PreReg User',
        email: testMemberEmail,
        role: 'TEAM_MEMBER',
        teamId: memberTeam.id,
        isActive: true,
      }),
    });
    const dataPreRegMember = await resPreRegMember.json();
    record(
      '1. Admin creates TEAM_MEMBER + Team (no password in request)',
      resPreRegMember.status === 201 && dataPreRegMember.success === true,
      dataPreRegMember.message
    );

    // Verify in database: passwordHash is NULL
    const dbPreRegUser = await prisma.user.findUnique({ where: { email: testMemberEmail } });
    record(
      'DB Check: User created with passwordHash === null and emailVerified === false',
      dbPreRegUser?.passwordHash === null && dbPreRegUser?.emailVerified === false,
      `passwordHash=${dbPreRegUser?.passwordHash}, emailVerified=${dbPreRegUser?.emailVerified}`
    );

    // -----------------------------------------------------------------
    // TEST 2: Pre-registered user cannot log in before setting password
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 2: LOGIN BLOCKED FOR PRE-REGISTERED ACCOUNT');
    const resEarlyLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testMemberEmail,
        password: 'AttemptPassword123!',
      }),
    });
    const dataEarlyLogin = await resEarlyLogin.json();
    record(
      '2. Login rejected before password establishment (REGISTRATION_REQUIRED)',
      resEarlyLogin.status === 403 && dataEarlyLogin.code === 'REGISTRATION_REQUIRED',
      { status: resEarlyLogin.status, code: dataEarlyLogin.code, message: dataEarlyLogin.message }
    );

    // -----------------------------------------------------------------
    // TEST 3: User registers with matching email and establishes password
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 3: USER SELF-REGISTERS');
    const resRegister = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Member PreReg User',
        email: testMemberEmail,
        password: 'StrongPassword123!',
        confirmPassword: 'StrongPassword123!',
      }),
    });
    const dataRegister = await resRegister.json();
    record(
      '3. User registers with matching email and establishes password',
      resRegister.status === 200 && dataRegister.success === true,
      { status: resRegister.status, user: dataRegister.user, redirectUrl: dataRegister.redirectUrl }
    );

    // -----------------------------------------------------------------
    // TEST 4 & 5: Server-authoritative role & team derived from database
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 4 & 5: ROLE & TEAM AUTHORITATIVELY TAKEN FROM DB');
    const dbRegisteredUser = await prisma.user.findUnique({
      where: { email: testMemberEmail },
      include: { team: true, wallet: true },
    });

    record(
      '4. User receives TEAM_MEMBER role from database',
      dbRegisteredUser?.role === 'TEAM_MEMBER' && dataRegister.user?.role === 'TEAM_MEMBER',
      `DB Role: ${dbRegisteredUser?.role}`
    );

    record(
      '5. User receives Member Test Team from database',
      dbRegisteredUser?.teamId === memberTeam.id && dbRegisteredUser?.team?.name === memberTeam.name,
      `DB Team: ${dbRegisteredUser?.team?.name} (${dbRegisteredUser?.teamId})`
    );

    record(
      'DB Check: User has passwordHash set and emailVerified === true',
      typeof dbRegisteredUser?.passwordHash === 'string' && dbRegisteredUser.passwordHash.length > 20 && dbRegisteredUser.emailVerified === true,
      `emailVerified=${dbRegisteredUser?.emailVerified}`
    );

    record(
      'DB Check: User wallet initialized with tournament coin allocation',
      dbRegisteredUser?.wallet !== null && dbRegisteredUser?.wallet?.totalCoins === 500,
      `Wallet totalCoins=${dbRegisteredUser?.wallet?.totalCoins}`
    );

    // -----------------------------------------------------------------
    // TEST 6: User newly established password can log in normally
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 6: LOGIN AFTER REGISTRATION');
    const resMemberLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testMemberEmail,
        password: 'StrongPassword123!',
      }),
    });
    const dataMemberLogin = await resMemberLogin.json();
    record(
      '6. Registered user can log in normally with established password',
      resMemberLogin.status === 200 && dataMemberLogin.success === true,
      { status: resMemberLogin.status, redirectUrl: dataMemberLogin.redirectUrl }
    );

    record(
      'Redirect check: TEAM_MEMBER redirects to /team',
      dataRegister.redirectUrl === '/team' && dataMemberLogin.redirectUrl === '/team',
      `Redirect: ${dataMemberLogin.redirectUrl}`
    );

    // -----------------------------------------------------------------
    // TEST 7: Duplicate registration attempt rejected
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 7: DUPLICATE REGISTRATION REJECTION');
    const resDuplicateRegister = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Member PreReg User',
        email: testMemberEmail,
        password: 'AnotherPassword123!',
        confirmPassword: 'AnotherPassword123!',
      }),
    });
    const dataDuplicateRegister = await resDuplicateRegister.json();
    record(
      '7. Duplicate registration rejected with HTTP 409 (ALREADY_REGISTERED)',
      resDuplicateRegister.status === 409 && dataDuplicateRegister.code === 'ALREADY_REGISTERED',
      { status: resDuplicateRegister.status, message: dataDuplicateRegister.message }
    );

    // -----------------------------------------------------------------
    // TEST 8: Unknown email cannot register
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 8: UNKNOWN EMAIL REGISTRATION REJECTION');
    const resUnknown = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hacker User',
        email: unknownEmail,
        password: 'SomePassword123!',
        confirmPassword: 'SomePassword123!',
      }),
    });
    const dataUnknown = await resUnknown.json();
    record(
      '8. Unknown email cannot register (NOT_PRE_REGISTERED)',
      resUnknown.status === 400 && dataUnknown.code === 'NOT_PRE_REGISTERED',
      { status: resUnknown.status, message: dataUnknown.message }
    );

    // -----------------------------------------------------------------
    // TEST 9: Privilege escalation attacks (Role & Team manipulation)
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 9: PRIVILEGE ESCALATION ATTACKS BLOCKED');
    // Pre-register another member
    const attackEmail = `attack.test.${timestamp}@student.tce.edu`;
    await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Attacker User',
        email: attackEmail,
        role: 'TEAM_MEMBER',
        teamId: memberTeam.id,
        isActive: true,
      }),
    });

    // Attacker sends role: 'ADMIN' and teamId: otherTeam.id in registration body
    const resAttack = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker User',
        email: attackEmail,
        password: 'AttackPassword123!',
        confirmPassword: 'AttackPassword123!',
        role: 'ADMIN',
        teamId: otherTeam.id,
      }),
    });
    const dataAttack = await resAttack.json();
    const dbAttacker = await prisma.user.findUnique({ where: { email: attackEmail } });

    record(
      '9a. Attacker cannot elevate role to ADMIN via register payload',
      dbAttacker?.role === 'TEAM_MEMBER' && dataAttack.user?.role === 'TEAM_MEMBER',
      `DB Role: ${dbAttacker?.role}`
    );

    record(
      '9b. Attacker cannot choose another team via register payload',
      dbAttacker?.teamId === memberTeam.id &&
        (dataAttack.user?.teamId === memberTeam.teamId || dataAttack.user?.teamId === memberTeam.id),
      `DB TeamId: ${dbAttacker?.teamId} (expected ${memberTeam.id})`
    );

    // -----------------------------------------------------------------
    // TEST 10: Pre-registered TEAM_LEADER receives TEAM_LEADER role & redirect
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 10: TEAM_LEADER PRE-REGISTRATION & REGISTRATION');
    await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Leader PreReg User',
        email: testLeaderEmail,
        role: 'TEAM_LEADER',
        teamId: tempTeam.id,
        isActive: true,
      }),
    });

    const resLeaderRegister = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Leader PreReg User',
        email: testLeaderEmail,
        password: 'LeaderPassword123!',
        confirmPassword: 'LeaderPassword123!',
      }),
    });
    const dataLeaderRegister = await resLeaderRegister.json();
    const dbLeader = await prisma.user.findUnique({ where: { email: testLeaderEmail } });

    record(
      '10. Team Leader receives TEAM_LEADER role from database',
      dbLeader?.role === 'TEAM_LEADER' && dataLeaderRegister.user?.role === 'TEAM_LEADER',
      `DB Role: ${dbLeader?.role}`
    );

    record(
      'Redirect check: TEAM_LEADER redirects to /team',
      dataLeaderRegister.redirectUrl === '/team',
      `Redirect: ${dataLeaderRegister.redirectUrl}`
    );

    // -----------------------------------------------------------------
    // TEST 11: Pre-registered INVESTOR receives INVESTOR role & redirect
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 11: INVESTOR PRE-REGISTRATION & REGISTRATION');
    await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Investor PreReg User',
        email: testInvestorEmail,
        role: 'INVESTOR',
        isActive: true,
      }),
    });

    const resInvestorRegister = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Investor PreReg User',
        email: testInvestorEmail,
        password: 'InvestorPassword123!',
        confirmPassword: 'InvestorPassword123!',
      }),
    });
    const dataInvestorRegister = await resInvestorRegister.json();
    const dbInvestor = await prisma.user.findUnique({ where: { email: testInvestorEmail } });

    record(
      '11. Investor receives INVESTOR role from database (no team assigned)',
      dbInvestor?.role === 'INVESTOR' && dbInvestor?.teamId === null && dataInvestorRegister.user?.role === 'INVESTOR',
      `DB Role: ${dbInvestor?.role}, teamId: ${dbInvestor?.teamId}`
    );

    record(
      'Redirect check: INVESTOR redirects to /dashboard',
      dataInvestorRegister.redirectUrl === '/dashboard',
      `Redirect: ${dataInvestorRegister.redirectUrl}`
    );

    // -----------------------------------------------------------------
    // TEST 12: Existing user login still works with existing password
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 12: EXISTING USERS LOGIN STILL WORKS');
    // Test Pradesh login
    const resPradeshLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'pradesh@student.tce.edu',
        password: 'pradesh@2006K',
      }),
    });
    const dataPradeshLogin = await resPradeshLogin.json();
    record(
      '12. Existing user (Pradesh) logs in normally with existing password',
      resPradeshLogin.status === 200 && dataPradeshLogin.success === true,
      { status: resPradeshLogin.status, user: dataPradeshLogin.user?.email, redirectUrl: dataPradeshLogin.redirectUrl }
    );

    // -----------------------------------------------------------------
    // TEST 13: Admin user login redirects to /admin
    // -----------------------------------------------------------------
    console.log('\n>>> TEST 13: ADMIN REDIRECT VERIFICATION');
    const resAdminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminUser.email,
        password: 'pradesh@2006K',
      }),
    });
    const dataAdminLogin = await resAdminLogin.json();
    record(
      '13. Admin logs in normally and redirects to /admin',
      resAdminLogin.status === 200 && dataAdminLogin.redirectUrl === '/admin',
      `Redirect: ${dataAdminLogin.redirectUrl}`
    );

  } finally {
    // Cleanup test users and temp teams
    console.log('\n>>> CLEANUP TEST USERS');
    const cleanupEmails = [testMemberEmail, testLeaderEmail, testInvestorEmail, `attack.test.${timestamp}@student.tce.edu`];
    for (const email of cleanupEmails) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u) {
        await prisma.wallet.deleteMany({ where: { userId: u.id } });
        await prisma.session.deleteMany({ where: { userId: u.id } });
        await prisma.auditLog.deleteMany({ where: { userId: u.id } });
        await prisma.teamMember.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
      }
    }
    await prisma.teamMember.deleteMany({ where: { teamId: { in: [tempTeam.id, memberTeam.id] } } }).catch(() => {});
    await prisma.team.delete({ where: { id: tempTeam.id } }).catch(() => {});
    await prisma.team.delete({ where: { id: memberTeam.id } }).catch(() => {});
    await prisma.session.delete({ where: { id: adminSessionId } }).catch(() => {});
    console.log('Cleanup completed successfully.');
  }

  // Summary
  console.log('\n================================================================');
  console.log('                      VERIFICATION SUMMARY                      ');
  console.log('================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Results: ${passedCount}/${totalCount} checks passed.`);

  if (passedCount !== totalCount) {
    console.error('❌ Some checks failed!');
    process.exit(1);
  } else {
    console.log('✅ ALL PRE-REGISTRATION & AUTH CHECKS PASSED PERFECTLY!');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
