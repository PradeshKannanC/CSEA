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

async function loginUser(email: string, passwordHash: string = 'password123'): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
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
  console.log('===============================================================');
  console.log('STARTING ROOM-SCOPED PARTICIPANT BUDGET AUTOMATED VERIFICATION');
  console.log('===============================================================');

  const timestamp = Date.now();
  const passwordHash = hashPassword('password123');

  // 1. Ensure active Event exists
  let event = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        name: `Test Event ${timestamp}`,
        totalCoins: 600,
        minInvestment: 150,
        maxInvestment: 300,
        status: 'OPEN',
      },
    });
  } else {
    event = await prisma.event.update({
      where: { id: event.id },
      data: {
        totalCoins: 600,
        minInvestment: 150,
        maxInvestment: 300,
      },
    });
  }

  // Create dedicated test Admin User
  const admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: `admin_${timestamp}@csea.edu`,
      passwordHash,
      role: 'ADMIN',
      avatarInitials: 'SA',
    },
  });
  const adminCookie = await loginUser(admin.email);

  // 2. Create Participant User (Leader of Team 1)
  const user1 = await prisma.user.create({
    data: {
      name: `Investor One ${timestamp}`,
      email: `user1_${timestamp}@csea.edu`,
      passwordHash,
      role: 'TEAM_LEADER',
      avatarInitials: 'I1',
    },
  });

  // Create Participant User 2 (Leader of Team 2 in Room A)
  const user2 = await prisma.user.create({
    data: {
      name: `Investor Two ${timestamp}`,
      email: `user2_${timestamp}@csea.edu`,
      passwordHash,
      role: 'TEAM_LEADER',
      avatarInitials: 'I2',
    },
  });

  // Create Participant User 3 (Leader of Team 3 in Room B)
  const user3 = await prisma.user.create({
    data: {
      name: `Investor Three ${timestamp}`,
      email: `user3_${timestamp}@csea.edu`,
      passwordHash,
      role: 'TEAM_LEADER',
      avatarInitials: 'I3',
    },
  });

  // Create Participant User 4 (Leader of Team 4 in Room B)
  const user4 = await prisma.user.create({
    data: {
      name: `Investor Four ${timestamp}`,
      email: `user4_${timestamp}@csea.edu`,
      passwordHash,
      role: 'TEAM_LEADER',
      avatarInitials: 'I4',
    },
  });

  // 3. Create Team 1 with Idea 1
  const team1 = await prisma.team.create({
    data: {
      name: `Team Alpha ${timestamp}`,
      teamId: `T1_${timestamp}`,
      submissionId: `SUB1_${timestamp}`,
      leaderId: user1.id,
      cohort: '2026',
    },
  });
  await prisma.user.update({ where: { id: user1.id }, data: { teamId: team1.id } });

  const idea1 = await prisma.idea.create({
    data: {
      anonymousId: `IDA1_${timestamp.toString().slice(-4)}`,
      teamId: team1.id,
      title: 'Decentralized Solar Grid',
      track: 'CLEANTECH',
      categoryTag: 'SUSTAINABLE',
      problemStatement: 'Grid instability',
      solution: 'Solar microgrids',
      innovation: 'P2P Trading',
      impact: '100% clean power',
      whyInvest: 'High ROI',
      technology: 'Blockchain + IoT',
      status: 'APPROVED',
    },
  });

  // Create Team 2 with Idea 2 (target for User 1 in Room A)
  const team2 = await prisma.team.create({
    data: {
      name: `Team Beta ${timestamp}`,
      teamId: `T2_${timestamp}`,
      submissionId: `SUB2_${timestamp}`,
      leaderId: user2.id,
      cohort: '2026',
    },
  });
  await prisma.user.update({ where: { id: user2.id }, data: { teamId: team2.id } });

  const idea2 = await prisma.idea.create({
    data: {
      anonymousId: `IDA2_${timestamp.toString().slice(-4)}`,
      teamId: team2.id,
      title: 'Autonomous Farm Drone',
      track: 'AI_DATA',
      categoryTag: 'AGRITECH',
      problemStatement: 'Crop disease',
      solution: 'Hyperspectral scans',
      innovation: 'Vision AI',
      impact: 'Zero chemical runoff',
      whyInvest: 'Massive market',
      technology: 'Python + PyTorch',
      status: 'APPROVED',
    },
  });

  // Create Team 3 with Idea 3 (in Room B)
  const team3 = await prisma.team.create({
    data: {
      name: `Team Gamma ${timestamp}`,
      teamId: `T3_${timestamp}`,
      submissionId: `SUB3_${timestamp}`,
      leaderId: user3.id,
      cohort: '2026',
    },
  });
  await prisma.user.update({ where: { id: user3.id }, data: { teamId: team3.id } });

  const idea3 = await prisma.idea.create({
    data: {
      anonymousId: `IDA3_${timestamp.toString().slice(-4)}`,
      teamId: team3.id,
      title: 'Quantum Secure Mesh',
      track: 'CYBERSECURITY',
      categoryTag: 'QUANTUM',
      problemStatement: 'Post-quantum crypto vulnerabilities',
      solution: 'Lattice-based encryption mesh',
      innovation: 'Hardware enclave integration',
      impact: 'Unbreakable comms',
      whyInvest: 'Defense contracts',
      technology: 'Rust + QPU',
      status: 'APPROVED',
    },
  });

  // Create Team 4 with Idea 4 (also in Room B)
  const team4 = await prisma.team.create({
    data: {
      name: `Team Delta ${timestamp}`,
      teamId: `T4_${timestamp}`,
      submissionId: `SUB4_${timestamp}`,
      leaderId: user4.id,
      cohort: '2026',
    },
  });
  await prisma.user.update({ where: { id: user4.id }, data: { teamId: team4.id } });

  const idea4 = await prisma.idea.create({
    data: {
      anonymousId: `IDA4_${timestamp.toString().slice(-4)}`,
      teamId: team4.id,
      title: 'Neural Prosthetic Interface',
      track: 'BIOTECH',
      categoryTag: 'NEURO',
      problemStatement: 'Loss of motor function',
      solution: 'Direct neural decoding',
      innovation: 'Non-invasive telemetry',
      impact: 'Restores independence',
      whyInvest: 'Breakthrough medical device',
      technology: 'C++ + PyTorch',
      status: 'APPROVED',
    },
  });

  // 4. Create Room A with snapshot parameters
  const roomA = await prisma.room.create({
    data: {
      name: `Room A ${timestamp}`,
      code: `RA${timestamp.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
      initialCoins: 600,
      minInvestment: 150,
      maxInvestment: 300,
    },
  });

  // Assign Team 1 and Team 2 to Room A
  await prisma.team.update({ where: { id: team1.id }, data: { roomId: roomA.id } });
  await prisma.team.update({ where: { id: team2.id }, data: { roomId: roomA.id } });
  await prisma.idea.update({ where: { id: idea1.id }, data: { roomId: roomA.id } });
  await prisma.idea.update({ where: { id: idea2.id }, data: { roomId: roomA.id } });
  await prisma.user.update({ where: { id: user1.id }, data: { roomId: roomA.id } });
  await prisma.user.update({ where: { id: user2.id }, data: { roomId: roomA.id } });

  // TEST STEP 1: Start Room A and verify budget creation and snapshot retention
  const startRoomARes = await fetch(`${BASE_URL}/api/admin/rooms/${roomA.id}/start`, {
    method: 'POST',
    headers: {
      Cookie: `pnp_session=${adminCookie}`,
    },
  });
  const startRoomAData = await startRoomARes.json();
  const roomAStarted = startRoomARes.ok && startRoomAData.success && startRoomAData.room.status === 'OPEN';
  record('1. Room A Start', roomAStarted, `Status: ${startRoomAData.room?.status || startRoomAData.message}`);

  // Verify User 1 Room A budget in DB
  const budgetUser1RoomA = await prisma.participantBudget.findUnique({
    where: { userId_roomId: { userId: user1.id, roomId: roomA.id } },
  });
  const u1RoomAInitOk =
    budgetUser1RoomA !== null &&
    budgetUser1RoomA.allocatedCoins === 600 &&
    budgetUser1RoomA.investedCoins === 0 &&
    budgetUser1RoomA.availableCoins === 600;
  record(
    '2. User 1 Room A Initial Budget Created',
    u1RoomAInitOk,
    `Allocated: ${budgetUser1RoomA?.allocatedCoins}, Invested: ${budgetUser1RoomA?.investedCoins}, Available: ${budgetUser1RoomA?.availableCoins}`
  );

  // TEST STEP 3: Verify /api/auth/me returns room-scoped budget for User 1
  const u1Cookie = await loginUser(user1.email);
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `pnp_session=${u1Cookie}` },
  });
  const meData = await meRes.json();
  const meWalletOk =
    meData.authenticated &&
    meData.user.wallet.allocatedCoins === 600 &&
    meData.user.wallet.availableCoins === 600 &&
    meData.user.wallet.investedCoins === 0;
  record(
    '3. /api/auth/me Room-Scoped Budget Verification',
    meWalletOk,
    `User wallet: ${JSON.stringify(meData.user?.wallet)}`
  );

  // TEST STEP 4: Rule Enforcement - Minimum Investment
  const minInvestRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${u1Cookie}`,
    },
    body: JSON.stringify({ ideaId: idea2.id, amount: 50 }),
  });
  const minInvestData = await minInvestRes.json();
  const minRejected = minInvestRes.status === 400 && minInvestData.code === 'BELOW_MINIMUM';
  record('4. Minimum Investment Enforced (50 < 150)', minRejected, `Code: ${minInvestData.code}`);

  // TEST STEP 5: Rule Enforcement - Maximum Investment
  const maxInvestRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${u1Cookie}`,
    },
    body: JSON.stringify({ ideaId: idea2.id, amount: 350 }),
  });
  const maxInvestData = await maxInvestRes.json();
  const maxRejected = maxInvestRes.status === 400 && maxInvestData.code === 'EXCEEDS_MAXIMUM';
  record('5. Maximum Investment Enforced (350 > 300)', maxRejected, `Code: ${maxInvestData.code}`);

  // TEST STEP 6: Rule Enforcement - Self-Investment Blocked
  const selfInvestRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${u1Cookie}`,
    },
    body: JSON.stringify({ ideaId: idea1.id, amount: 200 }),
  });
  const selfInvestData = await selfInvestRes.json();
  const selfRejected =
    selfInvestRes.status === 403 &&
    (selfInvestData.code === 'OWN_TEAM_INVESTMENT_FORBIDDEN' || selfInvestData.code === 'OWN_TEAM_IDEA');
  record('6. Own Team Investment Blocked', selfRejected, `Code: ${selfInvestData.code}`);

  // TEST STEP 7: Valid Investment in Room A (200 coins)
  const validInvestRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${u1Cookie}`,
    },
    body: JSON.stringify({ ideaId: idea2.id, amount: 200 }),
  });
  const validInvestData = await validInvestRes.json();
  const validInvestOk =
    validInvestRes.ok &&
    validInvestData.success &&
    validInvestData.budget.allocatedCoins === 600 &&
    validInvestData.budget.investedCoins === 200 &&
    validInvestData.budget.availableCoins === 400;
  record(
    '7. Valid Investment of 200 Coins in Room A',
    validInvestOk,
    `Budget: ${JSON.stringify(validInvestData.budget)}`
  );

  // Verify DB state for User 1 in Room A
  const u1RoomAAfterInvest = await prisma.participantBudget.findUnique({
    where: { userId_roomId: { userId: user1.id, roomId: roomA.id } },
  });
  const u1DbOk =
    u1RoomAAfterInvest !== null &&
    u1RoomAAfterInvest.allocatedCoins === 600 &&
    u1RoomAAfterInvest.investedCoins === 200 &&
    u1RoomAAfterInvest.availableCoins === 400;
  record(
    '8. Database Room A Budget State Post-Investment (600/200/400)',
    u1DbOk,
    `Allocated: ${u1RoomAAfterInvest?.allocatedCoins}, Invested: ${u1RoomAAfterInvest?.investedCoins}, Available: ${u1RoomAAfterInvest?.availableCoins}`
  );

  // TEST STEP 9: Create and Start Room B
  const roomB = await prisma.room.create({
    data: {
      name: `Room B ${timestamp}`,
      code: `RB${timestamp.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
      initialCoins: 600,
      minInvestment: 150,
      maxInvestment: 300,
    },
  });

  // Assign Team 3 and Team 4 to Room B
  await prisma.team.update({ where: { id: team3.id }, data: { roomId: roomB.id } });
  await prisma.idea.update({ where: { id: idea3.id }, data: { roomId: roomB.id } });
  await prisma.user.update({ where: { id: user3.id }, data: { roomId: roomB.id } });
  await prisma.team.update({ where: { id: team4.id }, data: { roomId: roomB.id } });
  await prisma.idea.update({ where: { id: idea4.id }, data: { roomId: roomB.id } });
  await prisma.user.update({ where: { id: user4.id }, data: { roomId: roomB.id } });

  // Move Team 1 (User 1) to Room B (simulate participant moving into Room B for next round)
  await prisma.team.update({ where: { id: team1.id }, data: { roomId: roomB.id } });
  await prisma.idea.update({ where: { id: idea1.id }, data: { roomId: roomB.id } });
  await prisma.user.update({ where: { id: user1.id }, data: { roomId: roomB.id } });

  // Start Room B
  const startRoomBRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomB.id}/start`, {
    method: 'POST',
    headers: { Cookie: `pnp_session=${adminCookie}` },
  });
  const startRoomBData = await startRoomBRes.json();
  const roomBStarted = startRoomBRes.ok && startRoomBData.success;
  record('9. Room B Start with Team 1 Moved to Room B', roomBStarted, `Status: ${startRoomBData.room?.status}`);

  // TEST STEP 10: Verify User 1 receives a FRESH 600 coins budget in Room B
  const budgetUser1RoomB = await prisma.participantBudget.findUnique({
    where: { userId_roomId: { userId: user1.id, roomId: roomB.id } },
  });
  const u1RoomBFreshOk =
    budgetUser1RoomB !== null &&
    budgetUser1RoomB.allocatedCoins === 600 &&
    budgetUser1RoomB.investedCoins === 0 &&
    budgetUser1RoomB.availableCoins === 600;
  record(
    '10. User 1 Fresh Allocation in Room B (600 / 0 / 600)',
    u1RoomBFreshOk,
    `Room B Budget: Allocated=${budgetUser1RoomB?.allocatedCoins}, Invested=${budgetUser1RoomB?.investedCoins}, Available=${budgetUser1RoomB?.availableCoins}`
  );

  // TEST STEP 11: CRITICAL CHECK - Room A Budget MUST Remain Immutable (600 / 200 / 400)
  const checkRoomAImmutable = await prisma.participantBudget.findUnique({
    where: { userId_roomId: { userId: user1.id, roomId: roomA.id } },
  });
  const roomAUnchanged =
    checkRoomAImmutable !== null &&
    checkRoomAImmutable.allocatedCoins === 600 &&
    checkRoomAImmutable.investedCoins === 200 &&
    checkRoomAImmutable.availableCoins === 400;
  record(
    '11. Room A Budget Immutability Check (Still 600 / 200 / 400)',
    roomAUnchanged,
    `Room A DB State: Allocated=${checkRoomAImmutable?.allocatedCoins}, Invested=${checkRoomAImmutable?.investedCoins}, Available=${checkRoomAImmutable?.availableCoins}`
  );

  // TEST STEP 12: Context Resolution for User 1 Now in Room B
  const meRoomBRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `pnp_session=${u1Cookie}` },
  });
  const meRoomBData = await meRoomBRes.json();
  const meRoomBOk =
    meRoomBData.authenticated &&
    meRoomBData.user.roomId === roomB.id &&
    meRoomBData.user.wallet.availableCoins === 600 &&
    meRoomBData.user.wallet.investedCoins === 0;
  record(
    '12. Context Active Room B Resolution',
    meRoomBOk,
    `Active Room: ${meRoomBData.user?.roomId}, Available Coins: ${meRoomBData.user?.wallet?.availableCoins}`
  );

  // TEST STEP 13: Cross-Room Investment Forbidden (User in Room B tries to invest in Room A idea)
  const crossInvestRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${u1Cookie}`,
    },
    body: JSON.stringify({ ideaId: idea2.id, amount: 200 }),
  });
  const crossInvestData = await crossInvestRes.json();
  const crossBlocked = crossInvestRes.status === 403 && crossInvestData.code === 'CROSS_ROOM_INVESTMENT_FORBIDDEN';
  record('13. Cross-Room Investment Blocked', crossBlocked, `Code: ${crossInvestData.code}`);

  // TEST STEP 14: Invest in Room B Idea 3 (150 coins)
  const investRoomBRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${u1Cookie}`,
    },
    body: JSON.stringify({ ideaId: idea3.id, amount: 150 }),
  });
  const investRoomBData = await investRoomBRes.json();
  const investRoomBOk =
    investRoomBRes.ok &&
    investRoomBData.success &&
    investRoomBData.budget.availableCoins === 450 &&
    investRoomBData.budget.investedCoins === 150;
  record(
    '14. Valid Investment of 150 Coins in Room B',
    investRoomBOk,
    `Room B Budget Post-Invest: ${JSON.stringify(investRoomBData.budget)}`
  );

  // TEST STEP 15: Overdraft Protection in Room B (Try to invest 500 when available is 450)
  const overdraftRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${u1Cookie}`,
    },
    body: JSON.stringify({ ideaId: idea3.id, amount: 500 }),
  });
  const overdraftData = await overdraftRes.json();
  const overdraftBlocked = overdraftRes.status === 400 && overdraftData.code === 'EXCEEDS_MAXIMUM';
  record('15. Investment Exceeding Limit Blocked', overdraftBlocked, `Code: ${overdraftData.code}`);

  // Rule Enforcement - Duplicate Investment in Same Idea Blocked (409 ALREADY_INVESTED)
  const duplicateInvestRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${u1Cookie}`,
    },
    body: JSON.stringify({ ideaId: idea3.id, amount: 150 }),
  });
  const duplicateInvestData = await duplicateInvestRes.json();
  const duplicateBlocked = duplicateInvestRes.status === 409 && duplicateInvestData.code === 'ALREADY_INVESTED';
  console.log(`  [DUPLICATE INVEST CHECK]: Status=${duplicateInvestRes.status}, Code=${duplicateInvestData.code}`);

  // Invest 300 into Idea 4 (within max limit 300, valid first investment into Idea 4)
  const invest2Res = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${u1Cookie}`,
    },
    body: JSON.stringify({ ideaId: idea4.id, amount: 300 }),
  });
  const invest2Data = await invest2Res.json();
  // Available is now 450 - 300 = 150.
  // Now try investing 200 (available is only 150)
  const insufficientRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${u1Cookie}`,
    },
    body: JSON.stringify({ ideaId: idea4.id, amount: 200 }),
  });
  const insufficientData = await insufficientRes.json();
  const insufficientBlocked =
    insufficientRes.status === 400 && insufficientData.code === 'INSUFFICIENT_COINS';
  record(
    '16. Overdraft / Insufficient Coins Blocked',
    insufficientBlocked && duplicateBlocked,
    `Code: ${insufficientData.code}, Remaining: ${insufficientData.availableCoins}, DuplicateBlocked: ${duplicateBlocked}`
  );

  // TEST STEP 17: Admin Overview Scoped Metrics
  const adminOverviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Cookie: `pnp_session=${adminCookie}` },
  });
  const adminOverviewData = await adminOverviewRes.json();
  const overviewOk =
    adminOverviewRes.ok &&
    adminOverviewData.success &&
    adminOverviewData.stats.roomStats.some((r: any) => r.id === roomA.id && r.totalCoinsInvested === 200) &&
    adminOverviewData.stats.roomStats.some((r: any) => r.id === roomB.id && r.totalCoinsInvested === 450);
  record(
    '17. Admin Overview Room-Scoped Accounting Metrics',
    overviewOk,
    `Room A invested: 200, Room B invested: 450`
  );

  // TEST STEP 18: Admin Rooms List Scoped Metrics
  const adminRoomsRes = await fetch(`${BASE_URL}/api/admin/rooms`, {
    headers: { Cookie: `pnp_session=${adminCookie}` },
  });
  const adminRoomsData = await adminRoomsRes.json();
  const roomsOk =
    adminRoomsRes.ok &&
    adminRoomsData.success &&
    adminRoomsData.rooms.some((r: any) => r.id === roomA.id && r.totalCoinsInvested === 200) &&
    adminRoomsData.rooms.some((r: any) => r.id === roomB.id && r.totalCoinsInvested === 450);
  record('18. Admin Rooms Endpoint Scoped Metrics', roomsOk, `Room stats accurate`);

  // TEST STEP 19: Portfolio Room Scoping
  const portfolioInvRes = await fetch(`${BASE_URL}/api/me/investments?roomId=${roomB.id}`, {
    headers: { Cookie: `pnp_session=${u1Cookie}` },
  });
  const portfolioInvData = await portfolioInvRes.json();
  const portfolioRoomBOk =
    portfolioInvRes.ok &&
    portfolioInvData.success &&
    portfolioInvData.investments.every((i: any) => i.roomId === roomB.id);
  record(
    '19. Portfolio Investments Scoped to Room B',
    portfolioRoomBOk,
    `Returned ${portfolioInvData.count} investments for Room B`
  );

  // Final Invariant Check Across All Created Budgets
  const allTestBudgets = await prisma.participantBudget.findMany({
    where: {
      userId: { in: [user1.id, user2.id, user3.id, user4.id] },
    },
  });
  const invariantsHold = allTestBudgets.every(
    (b) => b.availableCoins === b.allocatedCoins - b.investedCoins && b.availableCoins >= 0
  );
  record(
    '20. Global Mathematical Invariant Check (available === allocated - invested >= 0)',
    invariantsHold,
    `Tested ${allTestBudgets.length} budgets, all verified valid.`
  );

  console.log('===============================================================');
  const allPassed = results.every((r) => r.passed);
  const passCount = results.filter((r) => r.passed).length;
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${passCount} | FAILED: ${results.length - passCount}`);
  console.log(`FINAL VERDICT: ${allPassed ? 'ALL ROOM-SCOPED BUDGET CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
  console.log('===============================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
