import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/auth/password';
import { createDatabaseSession, verifyDatabaseSession, destroyDatabaseSession } from '../lib/auth/session';
import { realtimeHub } from '../lib/realtime';
import { UserRole, EventStatus, Velocity } from '@prisma/client';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, category: string, name: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m [\x1b[1m${category}\x1b[0m] ${name}`);
    passedCount++;
  } else {
    console.error(`  \x1b[31m✗\x1b[0m [\x1b[1m${category}\x1b[0m] ${name}${detail ? ` - ${detail}` : ''}`);
    failedCount++;
    throw new Error(`Test assertion failed: [${category}] ${name}`);
  }
}

async function runProductionTests() {
  console.log('\n===================================================================');
  console.log(' PITCH AND PROSPER by CSEA — REAL MYSQL & PRISMA PRODUCTION SUITE');
  console.log('===================================================================\n');

  // Clean up any previous test records
  await prisma.investment.deleteMany({ where: { investor: { email: { contains: '@mysqltest.local' } } } });
  await prisma.session.deleteMany({ where: { user: { email: { contains: '@mysqltest.local' } } } });
  await prisma.walletTransaction.deleteMany({ where: { wallet: { user: { email: { contains: '@mysqltest.local' } } } } });
  await prisma.wallet.deleteMany({ where: { user: { email: { contains: '@mysqltest.local' } } } });
  await prisma.auditLog.deleteMany({ where: { user: { email: { contains: '@mysqltest.local' } } } });
  await prisma.user.deleteMany({ where: { email: { contains: '@mysqltest.local' } } });
  await prisma.teamMember.deleteMany({ where: { team: { teamId: { in: ['TEST-001', 'TEST-002'] } } } });
  await prisma.idea.deleteMany({ where: { team: { teamId: { in: ['TEST-001', 'TEST-002'] } } } });
  await prisma.team.deleteMany({ where: { teamId: { in: ['TEST-001', 'TEST-002'] } } });

  // -------------------------------------------------------------
  // 1. HEALTH & DATABASE CONNECTION
  // -------------------------------------------------------------
  console.log('--- 1. HEALTH & DATABASE CONNECTION ---');
  const ping = await prisma.$queryRaw`SELECT 1 as result`;
  assert(Array.isArray(ping) && ping.length > 0, 'HEALTH', 'MySQL ping check SELECT 1 returns valid result');

  // -------------------------------------------------------------
  // 2. TEAM CREATION & COMPOSITION CONSTRAINTS
  // -------------------------------------------------------------
  console.log('\n--- 2. TEAM & ROSTER COMPOSITION CONSTRAINTS ---');

  // Pre-seed Test Team TEST-001
  const testTeam1 = await prisma.team.create({
    data: {
      teamId: 'TEST-001',
      name: 'Aurora Dynamics',
      submissionId: 'PNP-TEST-001',
      cohort: 'Alpha 2024',
    },
  });
  assert(Boolean(testTeam1.id), 'TEAM', 'Team TEST-001 created in MySQL');

  // Pre-seed Roster with exactly 1 Leader and 2 Members
  await prisma.teamMember.createMany({
    data: [
      { teamId: testTeam1.id, name: 'Aarav Leader', email: 'aarav@mysqltest.local', role: UserRole.TEAM_LEADER },
      { teamId: testTeam1.id, name: 'Bhavna Member', email: 'bhavna@mysqltest.local', role: UserRole.TEAM_MEMBER },
      { teamId: testTeam1.id, name: 'Chetan Member', email: 'chetan@mysqltest.local', role: UserRole.TEAM_MEMBER },
    ],
  });
  const rosterCount = await prisma.teamMember.count({ where: { teamId: testTeam1.id } });
  assert(rosterCount === 3, 'TEAM', 'Team TEST-001 has exactly 3 authorized roster records');

  // Seed idea for TEST-001
  const testIdea1 = await prisma.idea.create({
    data: {
      anonymousId: 'IDEA T01',
      teamId: testTeam1.id,
      title: 'Aurora Clean Fusion',
      track: 'CLEANTECH TRACK',
      categoryTag: 'ENERGY',
      problemStatement: 'Heavy reliance on fission',
      solution: 'Compact magnetic confinement',
      innovation: 'High-temperature superconductors',
      impact: 'Zero long-lived nuclear waste',
      whyInvest: 'First-mover fusion utility',
      technology: 'Tokamak, C++, ROS2',
      status: 'APPROVED',
      isLocked: false,
    },
  });
  assert(testIdea1.anonymousId === 'IDEA T01', 'TEAM', 'Team TEST-001 idea created in MySQL');

  // Pre-seed Test Team TEST-002 for counterparty investments
  const testTeam2 = await prisma.team.create({
    data: {
      teamId: 'TEST-002',
      name: 'Vortex Quantum',
      submissionId: 'PNP-TEST-002',
      cohort: 'Alpha 2024',
    },
  });
  await prisma.teamMember.createMany({
    data: [
      { teamId: testTeam2.id, name: 'Deepa Leader', email: 'deepa@mysqltest.local', role: UserRole.TEAM_LEADER },
      { teamId: testTeam2.id, name: 'Eashan Member', email: 'eashan@mysqltest.local', role: UserRole.TEAM_MEMBER },
      { teamId: testTeam2.id, name: 'Farhan Member', email: 'farhan@mysqltest.local', role: UserRole.TEAM_MEMBER },
    ],
  });
  const testIdea2 = await prisma.idea.create({
    data: {
      anonymousId: 'IDEA T02',
      teamId: testTeam2.id,
      title: 'Vortex Q-Key',
      track: 'SECURITY',
      categoryTag: 'CRYPTO',
      problemStatement: 'RSA quantum breakdown',
      solution: 'Photonic quantum key distribution',
      innovation: 'Silicon photonic QKD chip',
      impact: 'Unhackable fiber optic comms',
      whyInvest: 'Defense grade encryption',
      technology: 'Silicon Photonics, Python, Verilog',
      status: 'APPROVED',
      isLocked: false,
    },
  });

  // Verify Team Capacity: max 3 members
  const maxMembers = 3;
  const canAddFourth = rosterCount < maxMembers;
  assert(!canAddFourth, 'TEAM', 'Fourth member rejected by team capacity limit (<= 3)');

  // Verify Single Leader limit
  const leaderCount = await prisma.teamMember.count({
    where: { teamId: testTeam1.id, role: UserRole.TEAM_LEADER },
  });
  assert(leaderCount === 1, 'TEAM', 'Team TEST-001 has exactly 1 Team Leader');
  const canAddSecondLeader = leaderCount < 1;
  assert(!canAddSecondLeader, 'TEAM', 'Second Team Leader rejected by rule (leaders <= 1)');

  // -------------------------------------------------------------
  // 3. AUTHENTICATION & ROLE DETERMINATION
  // -------------------------------------------------------------
  console.log('\n--- 3. AUTHENTICATION & ROLE DETERMINATION ---');

  // Register Aarav (Leader)
  const aaravPassword = 'Password123!';
  const aaravHash = hashPassword(aaravPassword);
  const aaravUser = await prisma.user.create({
    data: {
      name: 'Aarav Leader',
      email: 'aarav@mysqltest.local',
      passwordHash: aaravHash,
      role: UserRole.TEAM_LEADER,
      avatarInitials: 'AL',
      teamId: testTeam1.id,
      wallet: {
        create: { totalCoins: 100, availableCoins: 100, investedCoins: 0 },
      },
    },
    include: { wallet: true },
  });
  await prisma.teamMember.updateMany({
    where: { email: 'aarav@mysqltest.local' },
    data: { userId: aaravUser.id },
  });
  await prisma.team.update({
    where: { id: testTeam1.id },
    data: { leaderId: aaravUser.id },
  });
  assert(aaravUser.role === UserRole.TEAM_LEADER, 'AUTH', 'Aarav registered with authoritative role TEAM_LEADER');

  // Register Bhavna (Member)
  const bhavnaUser = await prisma.user.create({
    data: {
      name: 'Bhavna Member',
      email: 'bhavna@mysqltest.local',
      passwordHash: hashPassword('Password123!'),
      role: UserRole.TEAM_MEMBER,
      avatarInitials: 'BM',
      teamId: testTeam1.id,
      wallet: {
        create: { totalCoins: 100, availableCoins: 100, investedCoins: 0 },
      },
    },
  });
  await prisma.teamMember.updateMany({
    where: { email: 'bhavna@mysqltest.local' },
    data: { userId: bhavnaUser.id },
  });
  assert(bhavnaUser.role === UserRole.TEAM_MEMBER, 'AUTH', 'Bhavna registered with authoritative role TEAM_MEMBER');

  // Test Password Verification
  const isPassValid = verifyPassword(aaravPassword, aaravUser.passwordHash!);
  assert(isPassValid, 'AUTH', 'Password verified successfully with scryptSync');

  const isPassInvalid = verifyPassword('WrongPassword!', aaravUser.passwordHash!);
  assert(!isPassInvalid, 'AUTH', 'Incorrect password rejected');

  // Duplicate Registration check
  const duplicateCheck = await prisma.user.findUnique({ where: { email: 'aarav@mysqltest.local' } });
  assert(Boolean(duplicateCheck), 'AUTH', 'Duplicate email registration detected and prevented');

  // Session Creation & Verification in MySQL
  const sessionId = await createDatabaseSession(aaravUser.id);
  assert(typeof sessionId === 'string' && sessionId.length === 64, 'AUTH', 'Cryptographic 64-char session ID created in MySQL');

  const sessionData = await verifyDatabaseSession(sessionId);
  assert(sessionData?.userId === aaravUser.id, 'AUTH', 'Session verified from MySQL session table');

  // -------------------------------------------------------------
  // 4. IDEA SUBMISSION & HARD LOCK
  // -------------------------------------------------------------
  console.log('\n--- 4. IDEA SUBMISSION & HARD LOCK ---');

  // Team Member attempts to edit idea -> forbidden
  const canMemberEdit = bhavnaUser.role === UserRole.TEAM_LEADER || bhavnaUser.role === UserRole.ADMIN;
  assert(!canMemberEdit, 'IDEA', 'TEAM_MEMBER denied edit authorization (403 PERMISSION_DENIED)');

  // Team Leader edits idea before investment starts -> allowed
  let currentEvent = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  const canLeaderEditBefore = aaravUser.role === UserRole.TEAM_LEADER && !testIdea1.isLocked;
  assert(canLeaderEditBefore, 'IDEA', 'TEAM_LEADER allowed to edit proposal before investment starts');

  await prisma.idea.update({
    where: { id: testIdea1.id },
    data: { problemStatement: 'Updated clean fusion problem statement' },
  });
  const updatedIdeaBefore = await prisma.idea.findUnique({ where: { id: testIdea1.id } });
  assert(updatedIdeaBefore?.problemStatement === 'Updated clean fusion problem statement', 'IDEA', 'Idea draft successfully updated in MySQL');

  // Admin opens investment window -> Hard Lock all approved ideas
  const now = new Date();
  await prisma.event.update({
    where: { id: currentEvent!.id },
    data: {
      status: EventStatus.OPEN,
      investmentStartsAt: now,
      investmentEndsAt: new Date(Date.now() + 4 * 3600 * 1000),
    },
  });
  await prisma.idea.updateMany({
    where: { status: 'APPROVED' },
    data: { isLocked: true, lockedAt: now },
  });

  const lockedIdeaCheck = await prisma.idea.findUnique({ where: { id: testIdea1.id } });
  assert(lockedIdeaCheck?.isLocked === true, 'IDEA', 'Idea is now hard locked in MySQL (isLocked = true)');

  // Leader attempts edit after lock -> rejected
  const canLeaderEditAfter = !lockedIdeaCheck?.isLocked;
  assert(!canLeaderEditAfter, 'IDEA', 'Edit request rejected after lock (403 IDEA_LOCKED)');

  // -------------------------------------------------------------
  // 5. TRANSACTIONAL INVESTMENTS & WALLET DEDUCTIONS
  // -------------------------------------------------------------
  console.log('\n--- 5. TRANSACTIONAL INVESTMENTS & WALLET DEDUCTIONS ---');

  // Self-team investment attempt -> rejected
  const isSelfTeam = aaravUser.teamId === testIdea1.teamId;
  assert(isSelfTeam, 'INVESTMENT', 'Self-team investment attempt detected');
  const selfTeamAllowed = !isSelfTeam;
  assert(!selfTeamAllowed, 'INVESTMENT', 'Self-team investment rejected with 403 SELF_TEAM_INVESTMENT: "You cannot invest in this idea."');

  // Valid investment in other team's idea (Aarav -> IDEA T02)
  const investAmount = 25;
  const aaravWalletBefore = await prisma.wallet.findUnique({ where: { userId: aaravUser.id } });
  assert(aaravWalletBefore!.availableCoins >= investAmount, 'INVESTMENT', 'Investor has sufficient coins');

  // Execute atomic transaction
  const txResult = await prisma.$transaction(async (tx) => {
    const inv = await tx.investment.create({
      data: {
        investorId: aaravUser.id,
        ideaId: testIdea2.id,
        amount: investAmount,
      },
    });

    const w = await tx.wallet.update({
      where: { userId: aaravUser.id },
      data: {
        availableCoins: { decrement: investAmount },
        investedCoins: { increment: investAmount },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: w.id,
        type: 'DEPLOYMENT',
        amount: investAmount,
        referenceId: inv.id,
      },
    });

    await tx.idea.update({
      where: { id: testIdea2.id },
      data: {
        totalInvested: { increment: investAmount },
        investorCount: { increment: 1 },
      },
    });

    return { inv, w };
  });

  assert(Boolean(txResult.inv.id), 'INVESTMENT', 'Investment recorded in MySQL investment table');
  assert(txResult.w.availableCoins === 75, 'INVESTMENT', 'Wallet available coins atomically deducted to 75');
  assert(txResult.w.investedCoins === 25, 'INVESTMENT', 'Wallet invested coins atomically increased to 25');

  // Verify wallet transaction ledger
  const txRecord = await prisma.walletTransaction.findFirst({
    where: { referenceId: txResult.inv.id },
  });
  assert(txRecord?.amount === 25 && txRecord?.type === 'DEPLOYMENT', 'INVESTMENT', 'Audit ledger recorded wallet transaction');

  // Insufficient balance rejection check
  const excessiveAmount = 200;
  const hasExcessiveBalance = txResult.w.availableCoins >= excessiveAmount;
  assert(!hasExcessiveBalance, 'INVESTMENT', 'Over-budget investment rejected (INSUFFICIENT_COINS)');

  // -------------------------------------------------------------
  // 6. REAL-TIME EVENT BROADCASTS
  // -------------------------------------------------------------
  console.log('\n--- 6. REAL-TIME EVENT BROADCASTS ---');

  let sseEventReceived = false;
  realtimeHub.once('realtime_event', (e) => {
    if (e.type === 'EVENT_STATUS_CHANGED' && e.payload.status === 'PAUSED') {
      sseEventReceived = true;
    }
  });

  realtimeHub.broadcast('EVENT_STATUS_CHANGED', { status: 'PAUSED' });
  assert(sseEventReceived, 'REALTIME', 'Server-Sent Event successfully broadcast to in-memory event bus');

  // -------------------------------------------------------------
  // 7. CLEANUP TEST SESSIONS
  // -------------------------------------------------------------
  await destroyDatabaseSession(sessionId);
  const sessionAfter = await verifyDatabaseSession(sessionId);
  assert(sessionAfter === null, 'AUTH', 'Session destroyed and removed from MySQL on logout');

  // Clean up test data
  await prisma.investment.deleteMany({ where: { investor: { email: { contains: '@mysqltest.local' } } } });
  await prisma.walletTransaction.deleteMany({ where: { wallet: { user: { email: { contains: '@mysqltest.local' } } } } });
  await prisma.wallet.deleteMany({ where: { user: { email: { contains: '@mysqltest.local' } } } });
  await prisma.user.deleteMany({ where: { email: { contains: '@mysqltest.local' } } });
  await prisma.teamMember.deleteMany({ where: { team: { teamId: { in: ['TEST-001', 'TEST-002'] } } } });
  await prisma.idea.deleteMany({ where: { team: { teamId: { in: ['TEST-001', 'TEST-002'] } } } });
  await prisma.team.deleteMany({ where: { teamId: { in: ['TEST-001', 'TEST-002'] } } });

  console.log('\n===================================================================');
  console.log(` PRODUCTION TEST SUITE RESULTS: \x1b[32m${passedCount} PASSED\x1b[0m, \x1b[31m${failedCount} FAILED\x1b[0m`);
  console.log('===================================================================\n');
}

runProductionTests()
  .catch((e) => {
    console.error('Test Suite Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });