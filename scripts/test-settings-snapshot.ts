import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

interface TestResult {
  step: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(step: string, passed: boolean, details: string) {
  results.push({ step, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark} | ${step}: ${details}`);
}

async function loginUser(email: string, password: string = 'password123'): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.statusText}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error(`No cookie received for ${email}`);
  const match = setCookie.match(/pnp_session=([^;]+)/);
  if (!match) throw new Error(`No pnp_session in set-cookie`);
  return match[1];
}

async function main() {
  console.log('====================================================================');
  console.log('STARTING CRITICAL RULE 1: ARENA SETTINGS SNAPSHOT & IMMUTABILITY SUITE');
  console.log('====================================================================');

  const ts = Date.now();
  const passwordHash = hashPassword('password123');

  // 1. Setup Admin
  const adminEmail = `admin_snap_${ts}@csea.edu`;
  const adminUser = await prisma.user.create({
    data: {
      name: 'Snapshot Admin',
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      avatarInitials: 'SA',
      isActive: true,
      emailVerified: true,
    },
  });
  const adminCookie = await loginUser(adminEmail);
  record('SETUP_ADMIN', Boolean(adminCookie), `Admin authenticated: ${adminEmail}`);

  // 2. Setup baseline Event
  let event = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        name: `Snapshot Test Event ${ts}`,
        totalCoins: 100,
        minInvestment: 10,
        maxInvestment: 50,
        status: 'OPEN',
        version: 1,
      },
    });
  } else {
    event = await prisma.event.update({
      where: { id: event.id },
      data: {
        totalCoins: 100,
        minInvestment: 10,
        maxInvestment: 50,
        status: 'OPEN',
      },
    });
  }
  record('SETUP_BASELINE_EVENT', event.totalCoins === 100, `Event baseline: 100/10/50, Version: ${event.version}`);

  // 3. Create Room Alpha with custom settings: 200 / 20 / 100
  const createRoomRes = await fetch(`${BASE_URL}/api/admin/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${adminCookie}`,
    },
    body: JSON.stringify({
      name: `Room Alpha ${ts}`,
      code: `RA-${ts.toString().slice(-4)}`,
      description: 'Room Alpha custom configuration test',
      initialCoins: 200,
      minInvestment: 20,
      maxInvestment: 100,
    }),
  });
  const createRoomData = await createRoomRes.json();
  const roomAlpha = createRoomData.room;
  record(
    'CREATE_ROOM_ALPHA',
    createRoomRes.ok && roomAlpha.initialCoins === 200 && roomAlpha.maxInvestment === 100,
    `Room Alpha created with initialCoins=${roomAlpha?.initialCoins}, min=${roomAlpha?.minInvestment}, max=${roomAlpha?.maxInvestment}`
  );

  // 4. Setup 2 Teams and Ideas for Room Alpha
  const team1 = await prisma.team.create({
    data: {
      teamId: `TEAM-A1-${ts}`,
      name: `Alpha Innovators ${ts}`,
      submissionId: `PNP-A1-${ts}`,
      roomId: roomAlpha.id,
    },
  });
  const defaultIdeaFields = {
    categoryTag: 'CLEANTECH',
    problemStatement: 'Problem statement',
    solution: 'Solution',
    innovation: 'Innovation',
    impact: 'Impact',
    whyInvest: 'Why invest',
    technology: 'Technology',
  };

  const idea1 = await prisma.idea.create({
    data: {
      anonymousId: `IDEA-A1-${ts}`,
      teamId: team1.id,
      roomId: roomAlpha.id,
      title: `Alpha CleanTech ${ts}`,
      status: 'APPROVED',
      track: 'INNOVATION',
      ...defaultIdeaFields,
    },
  });

  const team2 = await prisma.team.create({
    data: {
      teamId: `TEAM-A2-${ts}`,
      name: `Alpha Robotics ${ts}`,
      submissionId: `PNP-A2-${ts}`,
      roomId: roomAlpha.id,
    },
  });
  const idea2 = await prisma.idea.create({
    data: {
      anonymousId: `IDEA-A2-${ts}`,
      teamId: team2.id,
      roomId: roomAlpha.id,
      title: `Alpha Autonomous AI ${ts}`,
      status: 'APPROVED',
      track: 'INNOVATION',
      ...defaultIdeaFields,
    },
  });

  // Create Participant P1 on Team 1
  const p1Email = `p1_alpha_${ts}@csea.edu`;
  const p1User = await prisma.user.create({
    data: {
      name: 'Participant P1',
      email: p1Email,
      passwordHash,
      role: UserRole.INVESTOR,
      avatarInitials: 'P1',
      isActive: true,
      emailVerified: true,
      teamId: team1.id,
      roomId: roomAlpha.id,
    },
  });
  await prisma.teamMember.create({
    data: {
      teamId: team1.id,
      userId: p1User.id,
      name: p1User.name,
      email: p1User.email,
      role: UserRole.TEAM_MEMBER,
    },
  });
  const p1Cookie = await loginUser(p1Email);
  record('SETUP_TEAMS_AND_PARTICIPANTS', Boolean(p1Cookie), `Teams and P1 setup in Room Alpha`);

  // 5. Start Arena for Room Alpha (DRAFT -> OPEN)
  const startRoomRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${adminCookie}`,
    },
  });
  const startRoomData = await startRoomRes.json();
  record(
    'START_ROOM_ALPHA_TRANSACTION',
    startRoomRes.ok && startRoomData.room.status === 'OPEN',
    `Room Alpha transitioned to OPEN atomically. Version incremented to ${startRoomData.room?.version}`
  );

  // Verify participant budget created in Room Alpha
  const p1BudgetAlpha = await prisma.participantBudget.findUnique({
    where: { userId_roomId: { userId: p1User.id, roomId: roomAlpha.id } },
  });
  record(
    'P1_BUDGET_INITIALIZED',
    p1BudgetAlpha !== null && p1BudgetAlpha.allocatedCoins === 200 && p1BudgetAlpha.availableCoins === 200,
    `P1 budget created with allocatedCoins=${p1BudgetAlpha?.allocatedCoins}, availableCoins=${p1BudgetAlpha?.availableCoins}`
  );

  // 6. Update Global Event Defaults to 300 / 30 / 150
  const updateSettingsRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${adminCookie}`,
    },
    body: JSON.stringify({
      totalCoins: 300,
      minInvestment: 30,
      maxInvestment: 150,
      settingsVersion: event.version,
    }),
  });
  const updateSettingsData = await updateSettingsRes.json();
  record(
    'UPDATE_GLOBAL_EVENT_DEFAULTS',
    updateSettingsRes.ok && updateSettingsData.settings.totalCoins === 300,
    `Global defaults updated to 300/30/150. New settingsVersion=${updateSettingsData.settings?.settingsVersion}`
  );

  // 7. Verify Room Alpha settings REMAIN IMMUTABLE in DB & API
  const roomAlphaReloaded = await prisma.room.findUnique({
    where: { id: roomAlpha.id },
  });
  const isAlphaImmutable =
    roomAlphaReloaded?.initialCoins === 200 &&
    roomAlphaReloaded?.minInvestment === 20 &&
    roomAlphaReloaded?.maxInvestment === 100;

  record(
    'ROOM_ALPHA_SNAPSHOT_IMMUTABLE',
    isAlphaImmutable,
    `Room Alpha snapshot preserved: initialCoins=${roomAlphaReloaded?.initialCoins}, min=${roomAlphaReloaded?.minInvestment}, max=${roomAlphaReloaded?.maxInvestment} (NOT 300/30/150)`
  );

  // Verify P1 budget in Room Alpha was NOT changed by global update
  const p1BudgetAlphaAfterGlobal = await prisma.participantBudget.findUnique({
    where: { userId_roomId: { userId: p1User.id, roomId: roomAlpha.id } },
  });
  record(
    'P1_ROOM_BUDGET_NOT_OVERWRITTEN',
    p1BudgetAlphaAfterGlobal?.allocatedCoins === 200,
    `P1 budget in Room Alpha remains 200 coins (untouched by global default change)`
  );

  // 8. Test Immutability Lock: Attempt to modify Room Alpha settings via PATCH
  const editLockedRoomRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${adminCookie}`,
    },
    body: JSON.stringify({
      initialCoins: 250,
      maxInvestment: 120,
    }),
  });
  const editLockedData = await editLockedRoomRes.json();
  const isLockRejected =
    editLockedRoomRes.status === 409 && editLockedData.code === 'ROOM_SETTINGS_LOCKED';
  record(
    'REJECT_EDIT_ON_ACTIVE_ROOM',
    isLockRejected,
    `Status ${editLockedRoomRes.status} code="${editLockedData.code}" message="${editLockedData.message}"`
  );

  // 9. Enforce Room Alpha Caps during Investment
  // P1 attempts to invest 120 (would be valid under global 150, but exceeds Room Alpha's max 100)
  const invest120Res = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${p1Cookie}`,
    },
    body: JSON.stringify({
      ideaId: idea2.id,
      amount: 120,
    }),
  });
  const invest120Data = await invest120Res.json();
  record(
    'REJECT_EXCEEDING_ROOM_MAX_INVESTMENT',
    !invest120Res.ok && (invest120Data.code === 'INVALID_AMOUNT' || invest120Data.code === 'AMOUNT_EXCEEDS_MAX' || invest120Data.code === 'EXCEEDS_MAXIMUM'),
    `Investment of 120 coins rejected in Room Alpha (max is 100): code="${invest120Data.code}" message="${invest120Data.message}"`
  );

  // P1 invests 80 coins (valid in Room Alpha: 20 <= 80 <= 100)
  const invest80Res = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${p1Cookie}`,
    },
    body: JSON.stringify({
      ideaId: idea2.id,
      amount: 80,
    }),
  });
  const invest80Data = await invest80Res.json();
  record(
    'VALID_INVESTMENT_UNDER_ROOM_CAPS',
    invest80Res.ok && invest80Data.success,
    `Investment of 80 coins succeeded in Room Alpha. Available coins=${invest80Data.wallet?.remaining ?? invest80Data.wallet?.availableCoins}`
  );

  // 10. Future Room Isolation: Create Room Beta (should inherit new global defaults 300 / 30 / 150)
  const createRoomBetaRes = await fetch(`${BASE_URL}/api/admin/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${adminCookie}`,
    },
    body: JSON.stringify({
      name: `Room Beta ${ts}`,
      code: `RB-${ts.toString().slice(-4)}`,
      description: 'Room Beta inheriting new defaults',
    }),
  });
  const createRoomBetaData = await createRoomBetaRes.json();
  const roomBeta = createRoomBetaData.room;

  // Add 2 teams with approved ideas to Room Beta
  const teamB1 = await prisma.team.create({
    data: {
      teamId: `TEAM-B1-${ts}`,
      name: `Beta BioTech ${ts}`,
      submissionId: `PNP-B1-${ts}`,
      roomId: roomBeta.id,
    },
  });
  const ideaB1 = await prisma.idea.create({
    data: {
      anonymousId: `IDEA-B1-${ts}`,
      teamId: teamB1.id,
      roomId: roomBeta.id,
      title: `Beta Genomics ${ts}`,
      status: 'APPROVED',
      track: 'INNOVATION',
      ...defaultIdeaFields,
    },
  });

  const teamB2 = await prisma.team.create({
    data: {
      teamId: `TEAM-B2-${ts}`,
      name: `Beta Quantum ${ts}`,
      submissionId: `PNP-B2-${ts}`,
      roomId: roomBeta.id,
    },
  });
  const ideaB2 = await prisma.idea.create({
    data: {
      anonymousId: `IDEA-B2-${ts}`,
      teamId: teamB2.id,
      roomId: roomBeta.id,
      title: `Beta Quantum Computing ${ts}`,
      status: 'APPROVED',
      track: 'INNOVATION',
      ...defaultIdeaFields,
    },
  });

  const p2Email = `p2_beta_${ts}@csea.edu`;
  const p2User = await prisma.user.create({
    data: {
      name: 'Participant P2 Beta',
      email: p2Email,
      passwordHash,
      role: UserRole.INVESTOR,
      avatarInitials: 'P2',
      isActive: true,
      emailVerified: true,
      teamId: teamB1.id,
      roomId: roomBeta.id,
    },
  });
  await prisma.teamMember.create({
    data: {
      teamId: teamB1.id,
      userId: p2User.id,
      name: p2User.name,
      email: p2User.email,
      role: UserRole.TEAM_MEMBER,
    },
  });
  const p2Cookie = await loginUser(p2Email);

  // Start Room Beta
  const startRoomBetaRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomBeta.id}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${adminCookie}`,
    },
  });
  const startRoomBetaData = await startRoomBetaRes.json();
  const roomBetaStarted = startRoomBetaData.room;

  record(
    'ROOM_BETA_SNAPSHOTS_NEW_DEFAULTS',
    startRoomBetaRes.ok && roomBetaStarted.initialCoins === 300 && roomBetaStarted.maxInvestment === 150,
    `Room Beta snapshotted new defaults: initialCoins=${roomBetaStarted.initialCoins}, min=${roomBetaStarted.minInvestment}, max=${roomBetaStarted.maxInvestment}`
  );

  // P2 in Room Beta can invest 150 coins (within Beta's 150 max cap)
  const p2InvestRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${p2Cookie}`,
    },
    body: JSON.stringify({
      ideaId: ideaB2.id,
      amount: 150,
    }),
  });
  const p2InvestData = await p2InvestRes.json();
  record(
    'P2_INVESTS_UP_TO_BETA_MAX_150',
    p2InvestRes.ok && p2InvestData.success,
    `P2 invested 150 coins successfully in Room Beta (allowed by Room Beta's 150 cap)`
  );

  console.log('\n===============================================================');
  console.log('SETTINGS SNAPSHOT VERIFICATION SUMMARY');
  console.log('===============================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`TOTAL TESTS: ${results.length}`);
  console.log(`PASSED: ${results.filter((r) => r.passed).length}`);
  console.log(`FAILED: ${results.filter((r) => !r.passed).length}`);
  console.log(`STATUS: ${allPassed ? 'ALL PASS ✅' : 'FAILURES DETECTED ❌'}`);

  if (!allPassed) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
