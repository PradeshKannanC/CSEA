import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

interface TestRecord {
  id: string;
  name: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  evidence?: any;
}

const testRecords: TestRecord[] = [];

function record(
  id: string,
  name: string,
  expected: string,
  actual: string,
  passed: boolean,
  evidence?: any
) {
  const status: 'PASS' | 'FAIL' = passed ? 'PASS' : 'FAIL';
  testRecords.push({ id, name, expected, actual, status, evidence });
  const tag = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${tag} ${id}: ${name} -> Expected: ${expected} | Actual: ${actual}`);
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('================================================================');
  console.log('  MASTER E2E ACCEPTANCE TEST SUITE: PITCH AND PROSPER (CSEA)   ');
  console.log('================================================================\n');

  const timestamp = Date.now();

  // ===================================================================
  // PART 1: DATABASE / ENVIRONMENT HEALTH
  // ===================================================================
  console.log('>>> EXECUTING PART 1: DATABASE & ENVIRONMENT HEALTH');
  try {
    const userCount = await prisma.user.count();
    const teamCount = await prisma.team.count();
    const roomCount = await prisma.room.count();
    const eventCount = await prisma.event.count();
    record(
      'PART-01A',
      'Database Connectivity & Entity Health',
      'Database reachable with core entities populated',
      `Users: ${userCount}, Teams: ${teamCount}, Rooms: ${roomCount}, Events: ${eventCount}`,
      userCount > 0 && teamCount > 0
    );

    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    record(
      'PART-01B',
      'Server Health & Realtime Status',
      'HTTP 200 with application operational and database connected',
      `Status: ${healthData.status}, App: ${healthData.application}, DB: ${healthData.database}`,
      healthRes.status === 200 && healthData.status === 'ok' && healthData.database === 'connected'
    );
  } catch (err: any) {
    record('PART-01', 'Database Health', 'Operational', `Error: ${err.message}`, false);
    throw err;
  }

  // Find authoritative Admin
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) throw new Error('No admin user found in database');
  const adminSessionId = await createAdminSession(adminUser.id);
  const adminHeaders = {
    Cookie: `pnp_session=${adminSessionId}`,
    'Content-Type': 'application/json',
  };

  // Tracking entities created for cleanup
  const cleanupUserEmails: string[] = [];
  const cleanupTeamIds: string[] = [];
  const cleanupRoomIds: string[] = [];

  // Ensure active event is in DRAFT so tournament starts fresh
  const activeEvent = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (activeEvent) {
    await prisma.event.update({
      where: { id: activeEvent.id },
      data: { status: 'DRAFT', investmentStartsAt: null },
    });
  }

  try {
    // ===================================================================
    // PART 2: ADMIN AUTHENTICATION
    // ===================================================================
    console.log('\n>>> EXECUTING PART 2: ADMIN AUTHENTICATION');
    // Correct credentials
    const resAdminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminUser.email, password: 'pradesh@2006K' }),
    });
    const dataAdminLogin = await resAdminLogin.json();
    record(
      'PART-02A',
      'Admin Login with Correct Credentials',
      'HTTP 200 and redirectUrl === /admin',
      `HTTP ${resAdminLogin.status}, redirectUrl: ${dataAdminLogin.redirectUrl}`,
      resAdminLogin.status === 200 && dataAdminLogin.redirectUrl === '/admin'
    );

    // Invalid password rejected
    const resBadPass = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminUser.email, password: 'WrongPassword999!' }),
    });
    record(
      'PART-02B',
      'Admin Login Rejected on Bad Password',
      'HTTP 401 Unauthorized',
      `HTTP ${resBadPass.status}`,
      resBadPass.status === 401
    );

    // Unauthenticated access to /admin APIs rejected
    const resUnauth = await fetch(`${BASE_URL}/api/admin/overview`);
    record(
      'PART-02C',
      'Unauthenticated Access to Protected Admin API',
      'HTTP 401 / 403',
      `HTTP ${resUnauth.status}`,
      resUnauth.status === 401 || resUnauth.status === 403
    );

    // ===================================================================
    // PART 3: ADMIN USER PRE-REGISTRATION (NO PASSWORDS)
    // ===================================================================
    console.log('\n>>> EXECUTING PART 3: ADMIN USER PRE-REGISTRATION');

    // Create 4 isolated teams for the test
    const teamABC = await prisma.team.create({
      data: {
        teamId: `MABC-${timestamp}`.slice(0, 10),
        name: `Master ABC ${timestamp}`,
        submissionId: `M-SUB-A-${timestamp}`,
      },
    });
    cleanupTeamIds.push(teamABC.id);

    const teamEco = await prisma.team.create({
      data: {
        teamId: `MECO-${timestamp}`.slice(0, 10),
        name: `Master EcoPulse ${timestamp}`,
        submissionId: `M-SUB-E-${timestamp}`,
      },
    });
    cleanupTeamIds.push(teamEco.id);

    const teamMed = await prisma.team.create({
      data: {
        teamId: `MMED-${timestamp}`.slice(0, 10),
        name: `Master MediBridge ${timestamp}`,
        submissionId: `M-SUB-M-${timestamp}`,
      },
    });
    cleanupTeamIds.push(teamMed.id);

    const teamTra = await prisma.team.create({
      data: {
        teamId: `MTRA-${timestamp}`.slice(0, 10),
        name: `Master TransitIQ ${timestamp}`,
        submissionId: `M-SUB-T-${timestamp}`,
      },
    });
    cleanupTeamIds.push(teamTra.id);

    // Define test user accounts
    const testUsersToPreReg = [
      // Team ABC
      { name: 'ABC Leader', email: `m.abc.leader.${timestamp}@tce.edu`, role: 'TEAM_LEADER', teamId: teamABC.id },
      { name: 'ABC Member 1', email: `m.abc.mem1.${timestamp}@tce.edu`, role: 'TEAM_MEMBER', teamId: teamABC.id },
      { name: 'ABC Member 2', email: `m.abc.mem2.${timestamp}@tce.edu`, role: 'TEAM_MEMBER', teamId: teamABC.id },
      // Team EcoPulse
      { name: 'EcoPulse Leader', email: `m.eco.leader.${timestamp}@tce.edu`, role: 'TEAM_LEADER', teamId: teamEco.id },
      { name: 'EcoPulse Member 1', email: `m.eco.mem1.${timestamp}@tce.edu`, role: 'TEAM_MEMBER', teamId: teamEco.id },
      { name: 'EcoPulse Member 2', email: `m.eco.mem2.${timestamp}@tce.edu`, role: 'TEAM_MEMBER', teamId: teamEco.id },
      // Team MediBridge
      { name: 'MediBridge Leader', email: `m.med.leader.${timestamp}@tce.edu`, role: 'TEAM_LEADER', teamId: teamMed.id },
      { name: 'MediBridge Member 1', email: `m.med.mem1.${timestamp}@tce.edu`, role: 'TEAM_MEMBER', teamId: teamMed.id },
      { name: 'MediBridge Member 2', email: `m.med.mem2.${timestamp}@tce.edu`, role: 'TEAM_MEMBER', teamId: teamMed.id },
      // Team TransitIQ
      { name: 'TransitIQ Leader', email: `m.tra.leader.${timestamp}@tce.edu`, role: 'TEAM_LEADER', teamId: teamTra.id },
      { name: 'TransitIQ Member 1', email: `m.tra.mem1.${timestamp}@tce.edu`, role: 'TEAM_MEMBER', teamId: teamTra.id },
      { name: 'TransitIQ Member 2', email: `m.tra.mem2.${timestamp}@tce.edu`, role: 'TEAM_MEMBER', teamId: teamTra.id },
      // Investor
      { name: 'Master Investor', email: `m.investor.${timestamp}@tce.edu`, role: 'INVESTOR', teamId: undefined },
    ];

    let allPreRegPassed = true;
    for (const u of testUsersToPreReg) {
      cleanupUserEmails.push(u.email);
      const res = await fetch(`${BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: u.name,
          email: u.email,
          role: u.role,
          teamId: u.teamId,
          isActive: true,
        }),
      });
      if (res.status !== 201) allPreRegPassed = false;
    }

    record(
      'PART-03A',
      'Admin Pre-Registers 13 Test Users with NO Passwords',
      'All 13 users pre-registered with HTTP 201',
      `Pre-registration status: ${allPreRegPassed ? 'ALL CREATED' : 'SOME FAILED'}`,
      allPreRegPassed
    );

    // Database verification: passwordHash is NULL for all 13 users
    const dbPreRegUsers = await prisma.user.findMany({
      where: { email: { in: cleanupUserEmails } },
    });
    const allNullPasswords = dbPreRegUsers.every((u) => u.passwordHash === null && u.emailVerified === false);
    record(
      'PART-03B',
      'Database Audit: Zero Plaintext or Preset Passwords',
      'passwordHash === null and emailVerified === false for all pre-registered users',
      `Null passwords count: ${dbPreRegUsers.filter((u) => u.passwordHash === null).length}/${dbPreRegUsers.length}`,
      allNullPasswords && dbPreRegUsers.length === 13
    );

    // Pre-registered users cannot login before setting password
    const resPreRegLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUsersToPreReg[0].email,
        password: 'RandomPassword123!',
      }),
    });
    const dataPreRegLogin = await resPreRegLogin.json();
    record(
      'PART-03C',
      'Login Blocked Prior to User Self-Registration',
      'HTTP 403 with code REGISTRATION_REQUIRED',
      `HTTP ${resPreRegLogin.status}, code: ${dataPreRegLogin.code}`,
      resPreRegLogin.status === 403 && dataPreRegLogin.code === 'REGISTRATION_REQUIRED'
    );

    // ===================================================================
    // PART 4 & 5: USER REGISTRATION & ROLE REDIRECTION
    // ===================================================================
    console.log('\n>>> EXECUTING PART 4 & 5: USER REGISTRATION & ROLE REDIRECTION');
    const registeredSessions: Record<string, string> = {};

    // 1. ABC Leader self-registers
    const abcLeader = testUsersToPreReg[0];
    const resRegLeader = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: abcLeader.name,
        email: abcLeader.email,
        password: 'Password123!Safe',
        confirmPassword: 'Password123!Safe',
      }),
    });
    const dataRegLeader = await resRegLeader.json();
    const leaderCookie = resRegLeader.headers.get('set-cookie') || '';
    const leaderSessionMatch = leaderCookie.match(/pnp_session=([^;]+)/);
    if (leaderSessionMatch) registeredSessions[abcLeader.email] = leaderSessionMatch[1];

    record(
      'PART-04A',
      'ABC Leader Self-Registers',
      'HTTP 200, role: TEAM_LEADER, redirectUrl: /team',
      `Role: ${dataRegLeader.user?.role}, Redirect: ${dataRegLeader.redirectUrl}`,
      resRegLeader.status === 200 && dataRegLeader.user?.role === 'TEAM_LEADER' && dataRegLeader.redirectUrl === '/team'
    );

    // 2. ABC Member 1 self-registers
    const abcMem1 = testUsersToPreReg[1];
    const resRegMem = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: abcMem1.name,
        email: abcMem1.email,
        password: 'Password123!Safe',
        confirmPassword: 'Password123!Safe',
      }),
    });
    const dataRegMem = await resRegMem.json();
    const memCookie = resRegMem.headers.get('set-cookie') || '';
    const memSessionMatch = memCookie.match(/pnp_session=([^;]+)/);
    if (memSessionMatch) registeredSessions[abcMem1.email] = memSessionMatch[1];

    record(
      'PART-04B',
      'ABC Member Self-Registers',
      'HTTP 200, role: TEAM_MEMBER, redirectUrl: /team',
      `Role: ${dataRegMem.user?.role}, Redirect: ${dataRegMem.redirectUrl}`,
      resRegMem.status === 200 && dataRegMem.user?.role === 'TEAM_MEMBER' && dataRegMem.redirectUrl === '/team'
    );

    // 3. Investor self-registers
    const investorUser = testUsersToPreReg[12];
    const resRegInv = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: investorUser.name,
        email: investorUser.email,
        password: 'Password123!Safe',
        confirmPassword: 'Password123!Safe',
      }),
    });
    const dataRegInv = await resRegInv.json();
    const invCookie = resRegInv.headers.get('set-cookie') || '';
    const invSessionMatch = invCookie.match(/pnp_session=([^;]+)/);
    if (invSessionMatch) registeredSessions[investorUser.email] = invSessionMatch[1];

    record(
      'PART-04C',
      'Investor Self-Registers',
      'HTTP 200, role: INVESTOR, redirectUrl: /dashboard',
      `Role: ${dataRegInv.user?.role}, Redirect: ${dataRegInv.redirectUrl}`,
      resRegInv.status === 200 && dataRegInv.user?.role === 'INVESTOR' && dataRegInv.redirectUrl === '/dashboard'
    );

    // 4. Malicious registration: attempt role escalation to ADMIN and team tampering
    const attackEmail = testUsersToPreReg[2].email; // ABC Member 2
    const resAttack = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'ABC Member 2',
        email: attackEmail,
        password: 'Password123!Safe',
        confirmPassword: 'Password123!Safe',
        role: 'ADMIN',
        teamId: teamEco.id,
      }),
    });
    const dataAttack = await resAttack.json();
    const attackCookie = resAttack.headers.get('set-cookie') || '';
    const attackSessionMatch = attackCookie.match(/pnp_session=([^;]+)/);
    if (attackSessionMatch) registeredSessions[attackEmail] = attackSessionMatch[1];
    const dbAttackUser = await prisma.user.findUnique({ where: { email: attackEmail } });
    record(
      'PART-04D',
      'Privilege Escalation & Team Tampering Attack Blocked',
      'Server ignores client-sent role & teamId; DB role=TEAM_MEMBER, teamId=teamABC.id',
      `DB Role: ${dbAttackUser?.role}, DB Team: ${dbAttackUser?.teamId} (expected ${teamABC.id})`,
      dbAttackUser?.role === 'TEAM_MEMBER' && dbAttackUser?.teamId === teamABC.id
    );

    // 5. Unknown email registration rejected
    const resUnknown = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unknown Person',
        email: `hacker.${timestamp}@unknown.com`,
        password: 'Password123!Safe',
        confirmPassword: 'Password123!Safe',
      }),
    });
    record(
      'PART-04E',
      'Unknown Email Registration Rejected',
      'HTTP 400 with code NOT_PRE_REGISTERED',
      `HTTP ${resUnknown.status}`,
      resUnknown.status === 400
    );

    // 6. Duplicate registration rejected
    const resDup = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: abcLeader.name,
        email: abcLeader.email,
        password: 'AnotherPassword123!',
        confirmPassword: 'AnotherPassword123!',
      }),
    });
    record(
      'PART-04F',
      'Duplicate Registration Attempt Rejected',
      'HTTP 409 with code ALREADY_REGISTERED',
      `HTTP ${resDup.status}`,
      resDup.status === 409
    );

    // Register the remaining users for other teams so ideas and teams are fully active
    for (let i = 3; i < 12; i++) {
      const u = testUsersToPreReg[i];
      await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: u.name,
          email: u.email,
          password: 'Password123!Safe',
          confirmPassword: 'Password123!Safe',
        }),
      });
    }

    // ===================================================================
    // PART 6: TEAM STRUCTURE (EXACTLY 3 MEMBERS, 1 LEADER, 2 MEMBERS)
    // ===================================================================
    console.log('\n>>> EXECUTING PART 6: TEAM STRUCTURE ENFORCEMENT');

    // Verify team members count on ABC
    const abcMembersCount = await prisma.user.count({ where: { teamId: teamABC.id } });
    const abcLeadersCount = await prisma.user.count({ where: { teamId: teamABC.id, role: 'TEAM_LEADER' } });
    const abcSubMembersCount = await prisma.user.count({ where: { teamId: teamABC.id, role: 'TEAM_MEMBER' } });

    record(
      'PART-06A',
      'Team ABC Structure: Exactly 1 Leader + 2 Members = 3 Total',
      'Total: 3, Leaders: 1, Members: 2',
      `Total: ${abcMembersCount}, Leaders: ${abcLeadersCount}, Members: ${abcSubMembersCount}`,
      abcMembersCount === 3 && abcLeadersCount === 1 && abcSubMembersCount === 2
    );

    // Attempt to assign a second Team Leader to Team ABC -> must be rejected
    const resSecondLeader = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Second Leader Attempt',
        email: `second.leader.${timestamp}@tce.edu`,
        role: 'TEAM_LEADER',
        teamId: teamABC.id,
      }),
    });
    record(
      'PART-06B',
      'Assigning Second Team Leader to Team is Blocked',
      'HTTP 400 Rejection (Team already has a leader)',
      `HTTP ${resSecondLeader.status}`,
      resSecondLeader.status === 400
    );

    // ===================================================================
    // PART 7 & 8: DYNAMIC ROOMS & ROOM ASSIGNMENT LIFECYCLE
    // ===================================================================
    console.log('\n>>> EXECUTING PART 7 & 8: DYNAMIC ROOMS & ASSIGNMENT LIFECYCLE');

    // Create Room Alpha
    const resRoomAlpha = await fetch(`${BASE_URL}/api/admin/rooms`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Room Alpha ${timestamp}`,
        code: `ALPHA-${timestamp}`.slice(0, 10).toUpperCase(),
        description: 'Dynamic Room Alpha for acceptance test',
      }),
    });
    const dataRoomAlpha = await resRoomAlpha.json();
    const roomAlpha = dataRoomAlpha.room;
    cleanupRoomIds.push(roomAlpha.id);

    // Create Room Beta
    const resRoomBeta = await fetch(`${BASE_URL}/api/admin/rooms`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Room Beta ${timestamp}`,
        code: `BETA-${timestamp}`.slice(0, 10).toUpperCase(),
        description: 'Dynamic Room Beta for acceptance test',
      }),
    });
    const dataRoomBeta = await resRoomBeta.json();
    const roomBeta = dataRoomBeta.room;
    cleanupRoomIds.push(roomBeta.id);

    record(
      'PART-07A',
      'Dynamic Creation of Room Alpha and Room Beta',
      'Both rooms created with unique IDs and status DRAFT',
      `Alpha: ${roomAlpha?.id} (${roomAlpha?.status}), Beta: ${roomBeta?.id} (${roomBeta?.status})`,
      roomAlpha?.id && roomBeta?.id && roomAlpha.status === 'DRAFT' && roomBeta.status === 'DRAFT'
    );

    // Assign Room Alpha: ABC, EcoPulse (In DRAFT status: allowed)
    const resAssignAlpha = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        roomId: roomAlpha.id,
        teamIds: [teamABC.id, teamEco.id],
      }),
    });
    record(
      'PART-07B',
      'Assign Teams ABC & EcoPulse to Room Alpha in DRAFT',
      'HTTP 200 Success',
      `HTTP ${resAssignAlpha.status}`,
      resAssignAlpha.status === 200
    );

    // Assign Room Beta: MediBridge, TransitIQ
    const resAssignBeta = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        roomId: roomBeta.id,
        teamIds: [teamMed.id, teamTra.id],
      }),
    });
    record(
      'PART-07C',
      'Assign Teams MediBridge & TransitIQ to Room Beta in DRAFT',
      'HTTP 200 Success',
      `HTTP ${resAssignBeta.status}`,
      resAssignBeta.status === 200
    );

    // Verify participants inherit room from their team
    const abcLeaderUser = await prisma.user.findUnique({ where: { email: abcLeader.email } });
    const ecoLeaderUser = await prisma.user.findUnique({ where: { email: testUsersToPreReg[3].email } });
    const medLeaderUser = await prisma.user.findUnique({ where: { email: testUsersToPreReg[6].email } });
    const traLeaderUser = await prisma.user.findUnique({ where: { email: testUsersToPreReg[9].email } });

    record(
      'PART-07D',
      'Participants Authoritatively Inherit Room from Team Assignment',
      'ABC & Eco in Alpha, MediBridge & TransitIQ in Beta',
      `ABC: ${abcLeaderUser?.roomId === roomAlpha.id}, Eco: ${ecoLeaderUser?.roomId === roomAlpha.id}, Med: ${medLeaderUser?.roomId === roomBeta.id}, Tra: ${traLeaderUser?.roomId === roomBeta.id}`,
      abcLeaderUser?.roomId === roomAlpha.id &&
        ecoLeaderUser?.roomId === roomAlpha.id &&
        medLeaderUser?.roomId === roomBeta.id &&
        traLeaderUser?.roomId === roomBeta.id
    );

    // ===================================================================
    // PART 9 & 10: IDEA SUBMISSION & TEAM MEMBER PERMISSIONS
    // ===================================================================
    console.log('\n>>> EXECUTING PART 9 & 10: IDEA SUBMISSION & MEMBER EXPERIENCE');

    // Session headers for ABC Leader and ABC Member
    const abcLeaderHeaders = {
      Cookie: `pnp_session=${registeredSessions[abcLeader.email]}`,
      'Content-Type': 'application/json',
    };
    const abcMemHeaders = {
      Cookie: `pnp_session=${registeredSessions[abcMem1.email]}`,
      'Content-Type': 'application/json',
    };

    // First create draft idea records for the teams
    const ideaABC = await prisma.idea.create({
      data: {
        anonymousId: `IDEA A-A${timestamp}`.slice(0, 10),
        teamId: teamABC.id,
        roomId: roomAlpha.id,
        title: 'ABC AI Autonomous Grid',
        track: 'CleanTech',
        categoryTag: 'Energy',
        problemStatement: '',
        solution: '',
        innovation: '',
        impact: '',
        whyInvest: '',
        technology: '',
        status: 'DRAFT',
      },
    });

    const ideaEco = await prisma.idea.create({
      data: {
        anonymousId: `IDEA A-E${timestamp}`.slice(0, 10),
        teamId: teamEco.id,
        roomId: roomAlpha.id,
        title: 'EcoPulse Microgrid Optimization',
        track: 'CleanTech',
        categoryTag: 'Energy',
        problemStatement: 'Grid instability causes blackouts.',
        solution: 'Decentralized smart contracts balance microgrid loads.',
        innovation: 'Zero-latency dynamic load shifting algorithm.',
        impact: 'Reduces energy waste by 40%.',
        whyInvest: 'Rapidly deployable with immediate ROI.',
        technology: 'Solidity, Rust, WebSockets',
        status: 'APPROVED',
      },
    });

    const ideaMed = await prisma.idea.create({
      data: {
        anonymousId: `IDEA A-M${timestamp}`.slice(0, 10),
        teamId: teamMed.id,
        roomId: roomBeta.id,
        title: 'MediBridge Telemetry',
        track: 'HealthTech',
        categoryTag: 'Health',
        problemStatement: 'Rural clinics lack specialist diagnostic equipment.',
        solution: 'Low-power remote telemetry wearable array.',
        innovation: 'Edge computing AI diagnostics over LoRaWAN.',
        impact: 'Serves remote populations.',
        whyInvest: 'Huge untapped rural healthcare market.',
        technology: 'LoRaWAN, PyTorch, ESP32',
        status: 'APPROVED',
      },
    });

    // ABC Team Member attempts to modify idea -> must be rejected
    const resMemEdit = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({
        problem: 'Member hacked problem',
        solution: 'Member hacked solution',
      }),
    });
    record(
      'PART-09A',
      'Team Member Cannot Edit or Submit Idea (View-Only)',
      'HTTP 403 Forbidden with code PERMISSION_DENIED',
      `HTTP ${resMemEdit.status}`,
      resMemEdit.status === 403
    );

    // ABC Team Leader submits complete idea
    const resLeaderSubmit = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: abcLeaderHeaders,
      body: JSON.stringify({
        problem: 'Industrial facilities waste millions due to inefficient load balancing.',
        solution: 'AI-driven dynamic power distributor optimizing subsecond power draw.',
        innovation: 'Proprietary predictive reinforcement learning neural engine.',
        impact: 'Saves 35% peak grid power draw for industrial facilities.',
        whyInvest: 'High enterprise demand with verified pilot partners.',
        techStack: 'Python, PyTorch, C++, TimescaleDB',
        submitForReview: true,
      }),
    });
    const dataLeaderSubmit = await resLeaderSubmit.json();
    record(
      'PART-09B',
      'Team Leader Submits Complete Idea',
      'HTTP 200 Success with status APPROVED',
      `HTTP ${resLeaderSubmit.status}, success: ${dataLeaderSubmit.success}`,
      resLeaderSubmit.status === 200 && dataLeaderSubmit.success === true
    );

    // Team Member reports issue on proposal via /api/team/issues
    const resReportIssue = await fetch(`${BASE_URL}/api/team/issues`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({
        issueType: 'Typographical Error',
        message: 'There is a minor typo in the technology description: PyTorch should be capitalized.',
        ideaId: ideaABC.id,
      }),
    });
    const dataReportIssue = await resReportIssue.json();
    record(
      'PART-10A',
      'Team Member Reports Proposal Issue',
      'HTTP 200 or 201 with issue report created in database',
      `HTTP ${resReportIssue.status}, success: ${dataReportIssue.success}`,
      (resReportIssue.status === 200 || resReportIssue.status === 201) && dataReportIssue.success === true
    );

    // Verify reporting did NOT alter the idea
    const ideaAfterReport = await prisma.idea.findUnique({ where: { id: ideaABC.id } });
    record(
      'PART-10B',
      'Reporting Issue Does Not Modify Proposal Content',
      'Proposal problemStatement and solution remain intact',
      `Problem Statement length: ${ideaAfterReport?.problemStatement.length}`,
      Boolean(ideaAfterReport?.problemStatement.includes('Industrial facilities'))
    );

    // ===================================================================
    // PART 11 & 12: ADMIN APPROVAL & STRICT ANONYMITY AUDIT
    // ===================================================================
    console.log('\n>>> EXECUTING PART 11 & 12: ADMIN APPROVAL & ANONYMITY AUDIT');

    // Admin approves ABC idea
    await prisma.idea.update({
      where: { id: ideaABC.id },
      data: { status: 'APPROVED', isLocked: false },
    });

    // Participant queries ideas: GET /api/ideas
    const resParticipantIdeas = await fetch(`${BASE_URL}/api/ideas`, {
      headers: abcMemHeaders,
    });
    const dataParticipantIdeas = await resParticipantIdeas.json();
    const returnedIdeas = dataParticipantIdeas.ideas || [];

    // Anonymity Audit: verify NO team name, team ID, or member info in participant payload
    let leakedFields = false;
    for (const idea of returnedIdeas) {
      if (idea.teamName || idea.teamId === teamEco.teamId || idea.team || idea.members || idea.leader) {
        leakedFields = true;
      }
    }

    record(
      'PART-12A',
      'Strict Anonymity in Participant Idea Arena',
      'ZERO team names, team IDs, or participant identities leaked in API response',
      `Returned ideas count: ${returnedIdeas.length}, Leaked fields found: ${leakedFields}`,
      returnedIdeas.length > 0 && leakedFields === false
    );

    // ===================================================================
    // PART 13: ROOM SCOPING AUDIT
    // ===================================================================
    console.log('\n>>> EXECUTING PART 13: ROOM SCOPING AUDIT');

    // ABC participant is in Room Alpha (with ABC and EcoPulse).
    // The participant should see ONLY EcoPulse's idea.
    // ABC's own idea must be excluded!
    // MediBridge's idea (Room Beta) must be excluded!
    const ideaIdsInAlpha = returnedIdeas.map((i: any) => i.id);
    const containsOwnIdea = ideaIdsInAlpha.includes(ideaABC.id);
    const containsEcoIdea = ideaIdsInAlpha.includes(ideaEco.id);
    const containsBetaIdea = ideaIdsInAlpha.includes(ideaMed.id);

    record(
      'PART-13A',
      'Room Scoping: Only Eligible Same-Room Peer Ideas Returned',
      'EcoPulse idea present, Own ABC idea excluded, Room Beta idea excluded',
      `Own ABC present: ${containsOwnIdea}, EcoPulse present: ${containsEcoIdea}, Beta Med present: ${containsBetaIdea}`,
      containsOwnIdea === false && containsEcoIdea === true && containsBetaIdea === false
    );

    // ===================================================================
    // PART 14 & 15: EVENT COIN SETTINGS & WALLET INITIALIZATION
    // ===================================================================
    console.log('\n>>> EXECUTING PART 14 & 15: EVENT COIN SETTINGS & WALLET INTEGRITY');

    // Admin updates event settings to 500 / 20 / 100
    const resSettings = await fetch(`${BASE_URL}/api/admin/event/settings`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        totalCoins: 500,
        minInvestment: 20,
        maxInvestment: 100,
      }),
    });
    const dataSettings = await resSettings.json();
    record(
      'PART-14A',
      'Admin Configures Tournament Coin Parameters (500 / 20 / 100)',
      'HTTP 200, DB Event row updated to 500 / 20 / 100',
      `HTTP ${resSettings.status}, Total: ${dataSettings.settings?.totalCoins}, Min: ${dataSettings.settings?.minInvestment}, Max: ${dataSettings.settings?.maxInvestment}`,
      resSettings.status === 200 &&
        dataSettings.settings?.totalCoins === 500 &&
        dataSettings.settings?.minInvestment === 20 &&
        dataSettings.settings?.maxInvestment === 100
    );

    // Verify wallet invariant for participant
    const mem1User = await prisma.user.findUnique({
      where: { email: abcMem1.email },
      include: { wallet: true },
    });
    const walletTotal = mem1User?.wallet?.totalCoins;
    const walletAvailable = mem1User?.wallet?.availableCoins;
    const walletInvested = mem1User?.wallet?.investedCoins;
    const invariantHolds = walletTotal !== undefined && walletTotal === (walletAvailable ?? 0) + (walletInvested ?? 0);

    record(
      'PART-15A',
      'Wallet Invariant: allocated = invested + available',
      '500 = 0 + 500 holds true',
      `Allocated: ${walletTotal}, Invested: ${walletInvested}, Available: ${walletAvailable}`,
      invariantHolds && walletTotal === 500 && walletAvailable === 500 && walletInvested === 0
    );

    // ===================================================================
    // PART 24: ROOM LIFECYCLE (START ROOM: DRAFT -> OPEN)
    // ===================================================================
    console.log('\n>>> EXECUTING PART 24: ROOM LIFECYCLE (START ROOM)');

    // Start Room Alpha (DRAFT -> OPEN)
    const resStartAlpha = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}/start`, {
      method: 'POST',
      headers: adminHeaders,
    });
    const dataStartAlpha = await resStartAlpha.json();
    record(
      'PART-24A',
      'Start Room Alpha (DRAFT -> OPEN)',
      'HTTP 200, room status transitions to OPEN',
      `HTTP ${resStartAlpha.status}, status: ${dataStartAlpha.room?.status}`,
      resStartAlpha.status === 200 && dataStartAlpha.room?.status === 'OPEN'
    );

    // Verify assignment is now LOCKED during OPEN
    const resMoveWhileOpen = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        roomId: roomBeta.id,
        teamIds: [teamABC.id],
      }),
    });
    record(
      'PART-08A',
      'Room Assignment Locked During OPEN Status',
      'HTTP 400 or 403 Rejection',
      `HTTP ${resMoveWhileOpen.status}`,
      resMoveWhileOpen.status === 400 || resMoveWhileOpen.status === 403
    );

    // ===================================================================
    // PART 17, 18, 19, 20: INVESTMENT VALIDATION & SECURITY
    // ===================================================================
    console.log('\n>>> EXECUTING PART 17-20: INVESTMENT VALIDATION & SECURITY');

    // 1. Invalid: amount below minimum (<20)
    const resBelowMin = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({ ideaId: ideaEco.id, amount: 10 }),
    });
    record(
      'PART-18A',
      'Reject Investment Below Minimum (< 20 Coins)',
      'HTTP 400 Rejection',
      `HTTP ${resBelowMin.status}`,
      resBelowMin.status === 400
    );

    // 2. Invalid: amount above maximum (>100)
    const resAboveMax = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({ ideaId: ideaEco.id, amount: 105 }),
    });
    record(
      'PART-18B',
      'Reject Investment Above Maximum (> 100 Coins)',
      'HTTP 400 Rejection',
      `HTTP ${resAboveMax.status}`,
      resAboveMax.status === 400
    );

    // 3. Invalid: negative amount
    const resNegative = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({ ideaId: ideaEco.id, amount: -20 }),
    });
    record(
      'PART-18C',
      'Reject Negative Investment Amount',
      'HTTP 400 Rejection',
      `HTTP ${resNegative.status}`,
      resNegative.status === 400
    );

    // 4. Invalid: decimal amount
    const resDecimal = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({ ideaId: ideaEco.id, amount: 25.5 }),
    });
    record(
      'PART-18D',
      'Reject Decimal Investment Amount',
      'HTTP 400 Rejection',
      `HTTP ${resDecimal.status}`,
      resDecimal.status === 400
    );

    // 5. Self-Investment: ABC participant attempts to invest in ABC's own idea
    const resSelfInvest = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({ ideaId: ideaABC.id, amount: 50 }),
    });
    record(
      'PART-19A',
      'Reject Self-Team Investment',
      'HTTP 403 Forbidden with code OWN_TEAM_INVESTMENT_FORBIDDEN',
      `HTTP ${resSelfInvest.status}`,
      resSelfInvest.status === 403
    );

    // 6. Cross-Room: ABC participant attempts to invest in MediBridge (Room Beta)
    const resCrossRoom = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({ ideaId: ideaMed.id, amount: 50 }),
    });
    record(
      'PART-20A',
      'Reject Cross-Room Investment',
      'HTTP 403 Forbidden with code CROSS_ROOM_INVESTMENT_FORBIDDEN',
      `HTTP ${resCrossRoom.status}`,
      resCrossRoom.status === 403
    );

    // 7. Valid Investment: ABC Member invests 50 coins into EcoPulse
    const resValidInvest = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({ ideaId: ideaEco.id, amount: 50 }),
    });
    const dataValidInvest = await resValidInvest.json();

    // Verify DB wallet decremented
    const mem1AfterInvest = await prisma.user.findUnique({
      where: { email: abcMem1.email },
      include: { wallet: true },
    });
    record(
      'PART-17A',
      'Valid Investment Execution & Atomic Wallet Decrement',
      'HTTP 200, Available: 450, Invested: 50, Total: 500',
      `HTTP ${resValidInvest.status}, Available: ${mem1AfterInvest?.wallet?.availableCoins}, Invested: ${mem1AfterInvest?.wallet?.investedCoins}`,
      resValidInvest.status === 200 &&
        dataValidInvest.success === true &&
        mem1AfterInvest?.wallet?.availableCoins === 450 &&
        mem1AfterInvest?.wallet?.investedCoins === 50
    );

    // ===================================================================
    // PART 21: CONCURRENT INVESTMENT & ROW-LEVEL ATOMICITY
    // ===================================================================
    console.log('\n>>> EXECUTING PART 21: CONCURRENT INVESTMENT ATOMICITY');

    // Set ABC Member 2 wallet to exactly 60 coins available
    const mem2User = await prisma.user.findUnique({ where: { email: testUsersToPreReg[2].email } });
    await prisma.wallet.update({
      where: { userId: mem2User!.id },
      data: { totalCoins: 60, availableCoins: 60, investedCoins: 0 },
    });
    await prisma.participantBudget.updateMany({
      where: { userId: mem2User!.id },
      data: { allocatedCoins: 60, availableCoins: 60, investedCoins: 0 },
    });

    const mem2Headers = {
      Cookie: `pnp_session=${registeredSessions[testUsersToPreReg[2].email]}`,
      'Content-Type': 'application/json',
    };

    // Fire 2 concurrent 50-coin investments simultaneously
    const [resConc1, resConc2] = await Promise.all([
      fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: mem2Headers,
        body: JSON.stringify({ ideaId: ideaEco.id, amount: 50 }),
      }),
      fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: mem2Headers,
        body: JSON.stringify({ ideaId: ideaEco.id, amount: 50 }),
      }),
    ]);

    const concStatuses = [resConc1.status, resConc2.status];
    const successCount = concStatuses.filter((s) => s === 200).length;
    const failCount = concStatuses.filter((s) => s >= 400).length;

    const mem2FinalWallet = await prisma.wallet.findUnique({ where: { userId: mem2User!.id } });
    record(
      'PART-21A',
      'Concurrent Investment Atomicity (60 coins balance vs 2x 50 coins)',
      'Exactly ONE succeeds (HTTP 200), one rejected (HTTP 400), final balance = 10 (never negative)',
      `Successes: ${successCount}, Failures: ${failCount}, Final Balance: ${mem2FinalWallet?.availableCoins}`,
      successCount === 1 && failCount === 1 && mem2FinalWallet?.availableCoins === 10
    );

    // ===================================================================
    // PART 25, 26, 27: PAUSE, RESUME, CLOSE, AND POST-CLOSE LOCK
    // ===================================================================
    console.log('\n>>> EXECUTING PART 25, 26, 27: PAUSE, RESUME, CLOSE, AND LOCK');

    // 1. Pause Room Alpha (OPEN -> PAUSED)
    const resPause = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}/pause`, {
      method: 'POST',
      headers: adminHeaders,
    });
    record(
      'PART-25A',
      'Pause Room Alpha (OPEN -> PAUSED)',
      'HTTP 200, status becomes PAUSED',
      `HTTP ${resPause.status}`,
      resPause.status === 200
    );

    // Attempt investment while PAUSED -> must be rejected
    const resInvestPaused = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({ ideaId: ideaEco.id, amount: 20 }),
    });
    record(
      'PART-25B',
      'Investment Blocked While Room is PAUSED',
      'HTTP 403 Rejection with code ROOM_PAUSED',
      `HTTP ${resInvestPaused.status}`,
      resInvestPaused.status === 403
    );

    // Resume Room Alpha (PAUSED -> OPEN)
    const resResume = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}/resume`, {
      method: 'POST',
      headers: adminHeaders,
    });
    record(
      'PART-25C',
      'Resume Room Alpha (PAUSED -> OPEN)',
      'HTTP 200, status transitions back to OPEN',
      `HTTP ${resResume.status}`,
      resResume.status === 200
    );

    // Invest after resume -> should succeed
    const resInvestResumed = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({ ideaId: ideaEco.id, amount: 25 }),
    });
    record(
      'PART-25D',
      'Investment Succeeded After Room Resumption',
      'HTTP 200 Success',
      `HTTP ${resInvestResumed.status}`,
      resInvestResumed.status === 200
    );

    // Close Room Alpha (OPEN -> CLOSED)
    const resClose = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}/close`, {
      method: 'POST',
      headers: adminHeaders,
    });
    record(
      'PART-26A',
      'Close Room Alpha (OPEN -> CLOSED)',
      'HTTP 200, status becomes CLOSED',
      `HTTP ${resClose.status}`,
      resClose.status === 200
    );

    // Investment attempt after CLOSE -> must be rejected
    const resInvestClosed = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: abcMemHeaders,
      body: JSON.stringify({ ideaId: ideaEco.id, amount: 20 }),
    });
    record(
      'PART-27A',
      'Investment Strictly Blocked After Room is CLOSED',
      'HTTP 403 Rejection with code ROOM_CLOSED',
      `HTTP ${resInvestClosed.status}`,
      resInvestClosed.status === 403
    );

    // ===================================================================
    // PART 28, 29, 30: REVEAL WINNERS & RESULT CALCULATION
    // ===================================================================
    console.log('\n>>> EXECUTING PART 28, 29, 30: REVEAL WINNERS & RESULT CALCULATION');

    // Reveal winners for Room Alpha
    const resReveal = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}/reveal`, {
      method: 'POST',
      headers: adminHeaders,
    });
    const dataReveal = await resReveal.json();
    record(
      'PART-29A',
      'Admin Reveals Winners for Room Alpha (CLOSED -> REVEALED)',
      'HTTP 200, Result records created, room status REVEALED',
      `HTTP ${resReveal.status}, Results count: ${dataReveal.results?.length}`,
      resReveal.status === 200 && dataReveal.results?.length > 0
    );

    // Participant fetches results: GET /api/results
    const resParticipantResults = await fetch(`${BASE_URL}/api/results`, {
      headers: abcMemHeaders,
    });
    const dataParticipantResults = await resParticipantResults.json();
    const resultList = dataParticipantResults.results || [];
    const ecoResult = resultList.find((r: any) => r.teamName?.includes('EcoPulse'));

    record(
      'PART-30A',
      'Participant Results View Reveals Team Identities Post-Reveal',
      'Team names and rankings visible now that round is revealed',
      `Results count: ${resultList.length}, Top team: ${ecoResult?.teamName}, Total Coins: ${ecoResult?.totalCoins}`,
      resultList.length > 0 && Boolean(ecoResult?.teamName)
    );

    // ===================================================================
    // PART 31 & 32: HISTORICAL IMMUTABILITY & POST-ROUND TEAM MOVE
    // ===================================================================
    console.log('\n>>> EXECUTING PART 31 & 32: HISTORICAL IMMUTABILITY AUDIT');

    // Capture Room Alpha historical results and investment records before move
    const alphaResultsBefore = await prisma.result.findMany({ where: { roomId: roomAlpha.id } });
    const alphaInvestmentsBefore = await prisma.investment.findMany({ where: { roomId: roomAlpha.id } });

    // Now move Team ABC from Room Alpha to Room Beta (Allowed because Alpha is REVEALED)
    const resMovePostReveal = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        teamId: teamABC.id,
        roomId: roomBeta.id,
      }),
    });
    record(
      'PART-32A',
      'Move Team ABC to Room Beta After Completed Round',
      'HTTP 200 Success',
      `HTTP ${resMovePostReveal.status}`,
      resMovePostReveal.status === 200
    );

    // Verify ABC current assignment is now Room Beta
    const abcUpdatedTeam = await prisma.team.findUnique({ where: { id: teamABC.id } });
    const abcUpdatedUser = await prisma.user.findUnique({ where: { email: abcLeader.email } });
    record(
      'PART-32B',
      'Team ABC Current Assignment Successfully Inherited as Room Beta',
      'team.roomId === roomBeta.id and user.roomId === roomBeta.id',
      `Team roomId: ${abcUpdatedTeam?.roomId}, User roomId: ${abcUpdatedUser?.roomId}`,
      abcUpdatedTeam?.roomId === roomBeta.id && abcUpdatedUser?.roomId === roomBeta.id
    );

    // CRITICAL TEST: Verify Room Alpha historical results & investments remain 100% intact!
    const alphaResultsAfter = await prisma.result.findMany({ where: { roomId: roomAlpha.id } });
    const alphaInvestmentsAfter = await prisma.investment.findMany({ where: { roomId: roomAlpha.id } });

    const resultsPreserved = alphaResultsBefore.length === alphaResultsAfter.length &&
      alphaResultsBefore.every((r) => alphaResultsAfter.some((a) => a.id === r.id && a.totalCoins === r.totalCoins));

    const investmentsPreserved = alphaInvestmentsBefore.length === alphaInvestmentsAfter.length &&
      alphaInvestmentsBefore.every((inv) => alphaInvestmentsAfter.some((a) => a.id === inv.id && a.amount === inv.amount));

    record(
      'PART-31A',
      'HISTORICAL IMMUTABILITY: Moving Team Does Not Alter Prior Room Results or Investments',
      'Historical Room Alpha Result records and Investments remain identical',
      `Results count: ${alphaResultsAfter.length} (was ${alphaResultsBefore.length}), Investments count: ${alphaInvestmentsAfter.length} (was ${alphaInvestmentsBefore.length})`,
      resultsPreserved && investmentsPreserved
    );

    // ===================================================================
    // PART 37: AUTH + ROOM CONTEXT CONSISTENCY REGRESSION CHECK
    // ===================================================================
    console.log('\n>>> EXECUTING PART 37: AUTH + ROOM CONSISTENCY REGRESSION CHECK');

    const [resMe, resContext, resMine] = await Promise.all([
      fetch(`${BASE_URL}/api/auth/me`, { headers: abcLeaderHeaders }),
      fetch(`${BASE_URL}/api/me/context`, { headers: abcLeaderHeaders }),
      fetch(`${BASE_URL}/api/teams/mine`, { headers: abcLeaderHeaders }),
    ]);

    const dataMe = await resMe.json();
    const dataContext = await resContext.json();
    const dataMine = await resMine.json();

    const consistentRoomId =
      dataMe.user?.roomId === roomBeta.id &&
      dataContext.context?.roomId === roomBeta.id &&
      dataMine.room?.id === roomBeta.id;

    record(
      'PART-37A',
      'Authoritative Room Context Consistency Across Endpoints',
      '/api/auth/me, /api/me/context, and /api/teams/mine all resolve identical Room Beta context',
      `Me: ${dataMe.user?.roomId}, Context: ${dataContext.context?.roomId}, Mine: ${dataMine.room?.id}`,
      consistentRoomId
    );

    // ===================================================================
    // PART 23 & 39: LIVE METRICS & WALLET DATA INTEGRITY AUDIT
    // ===================================================================
    console.log('\n>>> EXECUTING PART 23 & 39: LIVE METRICS & WALLET INTEGRITY');

    const resOverview = await fetch(`${BASE_URL}/api/admin/overview`, { headers: adminHeaders });
    const dataOverview = await resOverview.json();

    const distributedCoins = dataOverview.stats?.totalDistributedCoins ?? 0;
    const investedCoins = dataOverview.stats?.totalCoinsInvested ?? 0;
    const remainingCoins = dataOverview.stats?.totalCoinsRemaining ?? 0;

    const metricsEquationHolds = distributedCoins === investedCoins + remainingCoins;

    record(
      'PART-23A',
      'Admin Live Metrics Equation: Distributed = Invested + Remaining',
      'Distributed === Invested + Remaining holds in MySQL calculation',
      `Distributed (${distributedCoins}) = Invested (${investedCoins}) + Remaining (${remainingCoins})`,
      metricsEquationHolds && distributedCoins > 0
    );

    // Check all wallets in database: allocated >= invested, available >= 0
    const allWallets = await prisma.wallet.findMany();
    const allWalletsValid = allWallets.every(
      (w) => w.totalCoins === w.availableCoins + w.investedCoins && w.availableCoins >= 0 && w.investedCoins >= 0
    );

    record(
      'PART-39A',
      'Global Database Audit: All Wallets Obey Non-Negative and Invariant Rule',
      '100% of wallets have totalCoins === availableCoins + investedCoins and availableCoins >= 0',
      `Total Wallets Checked: ${allWallets.length}, Valid: ${allWalletsValid}`,
      allWalletsValid
    );

  } finally {
    // Clean up created entities to prevent test pollution
    console.log('\n>>> CLEANING UP TEST DATA...');
    for (const email of cleanupUserEmails) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u) {
        await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: u.id } } }).catch(() => {});
        await prisma.wallet.deleteMany({ where: { userId: u.id } }).catch(() => {});
        await prisma.investment.deleteMany({ where: { investorId: u.id } }).catch(() => {});
        await prisma.session.deleteMany({ where: { userId: u.id } }).catch(() => {});
        await prisma.auditLog.deleteMany({ where: { userId: u.id } }).catch(() => {});
        await prisma.ideaIssueReport.deleteMany({ where: { reportedByUserId: u.id } }).catch(() => {});
        await prisma.notification.deleteMany({ where: { recipientUserId: u.id } }).catch(() => {});
        await prisma.teamMember.deleteMany({ where: { userId: u.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
      }
    }

    for (const teamId of cleanupTeamIds) {
      await prisma.ideaIssueReport.deleteMany({ where: { teamId } }).catch(() => {});
      await prisma.result.deleteMany({ where: { teamId } }).catch(() => {});
      await prisma.investment.deleteMany({ where: { idea: { teamId } } }).catch(() => {});
      await prisma.idea.deleteMany({ where: { teamId } }).catch(() => {});
      await prisma.teamMember.deleteMany({ where: { teamId } }).catch(() => {});
      await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
    }

    for (const roomId of cleanupRoomIds) {
      await prisma.result.deleteMany({ where: { roomId } }).catch(() => {});
      await prisma.investment.deleteMany({ where: { roomId } }).catch(() => {});
      await prisma.idea.deleteMany({ where: { roomId } }).catch(() => {});
      await prisma.room.delete({ where: { id: roomId } }).catch(() => {});
    }

    await prisma.session.delete({ where: { id: adminSessionId } }).catch(() => {});
    await prisma.$disconnect();
    console.log('Cleanup completed successfully.');
  }

  // Summary Report
  console.log('\n================================================================');
  console.log('                 MASTER E2E ACCEPTANCE SUMMARY                  ');
  console.log('================================================================');
  const total = testRecords.length;
  const passed = testRecords.filter((r) => r.status === 'PASS').length;
  const failed = testRecords.filter((r) => r.status === 'FAIL').length;
  console.log(`Total Invariants Tested: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error('❌ MASTER ACCEPTANCE TEST FAILED');
    process.exit(1);
  } else {
    console.log('✅ MASTER ACCEPTANCE TEST: 100% INVARIANTS PASSED PERFECTLY!');
  }
}

main().catch((err) => {
  console.error('Fatal master test error:', err);
  process.exit(1);
});
