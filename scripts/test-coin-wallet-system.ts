import { PrismaClient } from '@prisma/client';
import { createDatabaseSession } from '../lib/auth/session';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`  [PASS] ${name}${details ? ` (${details})` : ''}`);
  } else {
    results.push({ name, passed: false, error: details || 'Assertion failed' });
    console.error(`  [FAIL] ${name}${details ? ` (${details})` : ''}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('  PITCH AND PROSPER — FULL COIN / WALLET ACCEPTANCE TEST SUITE  ');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------
    // SETUP: Find Active Event and Users
    // -------------------------------------------------------------
    const activeEvent = await prisma.event.findFirst({
      where: { status: { in: ['DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'REVEALED'] } },
      orderBy: { updatedAt: 'desc' },
    });

    if (!activeEvent) {
      throw new Error('No active event found in database.');
    }
    console.log(`Active Event: "${activeEvent.name}" (${activeEvent.id})`);

    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) throw new Error('No admin user found in database.');

    const abcLeader = await prisma.user.findFirst({ where: { email: 'pradesh@student.tce.edu' } });
    if (!abcLeader) throw new Error('Team ABC leader not found.');

    const medibridgeLeader = await prisma.user.findFirst({ where: { email: 'rohan.medibridge@student.tce.edu' } });
    if (!medibridgeLeader) throw new Error('MediBridge leader not found.');

    const ecopulseLeader = await prisma.user.findFirst({ where: { email: 'kavya.ecopulse@student.tce.edu' } });
    if (!ecopulseLeader) throw new Error('EcoPulse leader not found.');

    // Create session cookies
    const adminSessionId = await createDatabaseSession(adminUser.id);
    const abcSessionId = await createDatabaseSession(abcLeader.id);
    const medibridgeSessionId = await createDatabaseSession(medibridgeLeader.id);

    const adminHeaders = { 'Cookie': `pnp_session=${adminSessionId}`, 'Content-Type': 'application/json' };
    const abcHeaders = { 'Cookie': `pnp_session=${abcSessionId}`, 'Content-Type': 'application/json' };
    const medibridgeHeaders = { 'Cookie': `pnp_session=${medibridgeSessionId}`, 'Content-Type': 'application/json' };

    // Find ideas in Room Beta and their authoritative target room
    const ecopulseIdea = await prisma.idea.findFirst({
      where: { team: { name: 'EcoPulse' } },
      include: { team: true },
    });
    const medibridgeIdea = await prisma.idea.findFirst({
      where: { team: { name: 'MediBridge' } },
      include: { team: true },
    });
    const transitiqIdea = await prisma.idea.findFirst({
      where: { team: { name: 'TransitIQ' } },
      include: { team: true },
    });

    const targetRoomId = ecopulseIdea?.team?.roomId || ecopulseIdea?.roomId;
    if (!targetRoomId) throw new Error('Target room ID not found for EcoPulse');
    const roomBeta = await prisma.room.findUnique({ where: { id: targetRoomId } });
    if (!roomBeta) throw new Error('Target room not found.');

    console.log(`Room Beta: ${roomBeta.name} (${roomBeta.id}), Status: ${roomBeta.status}`);
    console.log(`EcoPulse Idea: ${ecopulseIdea?.anonymousId} (${ecopulseIdea?.id})`);
    console.log(`MediBridge Idea: ${medibridgeIdea?.anonymousId} (${medibridgeIdea?.id})`);
    console.log(`TransitIQ Idea: ${transitiqIdea?.anonymousId} (${transitiqIdea?.id})\n`);

    // Ensure Room Beta is OPEN for investments
    await prisma.room.update({
      where: { id: roomBeta.id },
      data: { status: 'OPEN' },
    });

    // =============================================================
    // SECTION 1: EVENT-GLOBAL COIN CONFIGURATION & ADMIN API
    // =============================================================
    console.log('--- SECTION 1: EVENT-GLOBAL COIN CONFIGURATION & ADMIN API ---');

    // 1.1: Validation failure when minInvestment > maxInvestment
    const resInvalidMinMax = await fetch(`${BASE_URL}/api/admin/event/settings`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        totalCoinsPerParticipant: 1000,
        minimumInvestment: 150,
        maximumInvestment: 100,
      }),
    });
    assert(resInvalidMinMax.status === 400, 'Rejects when minInvestment > maxInvestment (HTTP 400)');

    // 1.2: Validation failure when maxInvestment > totalCoinsPerParticipant
    const resInvalidMaxTotal = await fetch(`${BASE_URL}/api/admin/event/settings`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        totalCoinsPerParticipant: 50,
        minimumInvestment: 10,
        maximumInvestment: 100,
      }),
    });
    assert(resInvalidMaxTotal.status === 400, 'Rejects when maxInvestment > totalCoins (HTTP 400)');

    // 1.3: Validation failure when lowering totalCoins below participant invested amount
    // pradesh has 994 invested, so setting totalCoins to 500 must fail
    const resLowerBelowInvested = await fetch(`${BASE_URL}/api/admin/event/settings`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        totalCoinsPerParticipant: 500,
        minimumInvestment: 20,
        maximumInvestment: 100,
      }),
    });
    assert(resLowerBelowInvested.status === 400, 'Rejects lowering totalCoins below invested amount (HTTP 400)');
    const lowerErrorData = await resLowerBelowInvested.json();
    assert(lowerErrorData.error?.includes('already invested') || lowerErrorData.message?.includes('already invested'), 'Error message clearly explains invested coins constraint');

    // 1.4: Valid update to totalCoins=1500, min=20, max=100
    const resValidUpdate = await fetch(`${BASE_URL}/api/admin/event/settings`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        totalCoinsPerParticipant: 1500,
        minimumInvestment: 20,
        maximumInvestment: 100,
      }),
    });
    assert(resValidUpdate.status === 200, 'Admin can update valid settings (total=1500, min=20, max=100) (HTTP 200)');
    const validData = await resValidUpdate.json();
    assert(validData.settings?.totalCoins === 1500, 'Updated event totalCoins persisted in DB');
    assert(validData.settings?.minInvestment === 20, 'Updated event minInvestment persisted in DB');
    assert(validData.settings?.maxInvestment === 100, 'Updated event maxInvestment persisted in DB');

    // Clean initial test state for MediBridge leader to ensure reproducible tests
    await prisma.investment.deleteMany({
      where: {
        investorId: medibridgeLeader.id,
      },
    });
    await prisma.wallet.update({
      where: { userId: medibridgeLeader.id },
      data: {
        totalCoins: 1500,
        investedCoins: 0,
        availableCoins: 1500,
      },
    });

    // =============================================================
    // SECTION 2: PARTICIPANT WALLET STRUCTURE & CONTEXT
    // =============================================================
    console.log('\n--- SECTION 2: PARTICIPANT WALLET STRUCTURE & CONTEXT ---');

    // 2.1: Context for Team ABC Leader
    const resAbcContext = await fetch(`${BASE_URL}/api/me/context`, {
      method: 'GET',
      headers: abcHeaders,
    });
    assert(resAbcContext.status === 200, 'Team ABC leader can fetch /api/me/context (HTTP 200)');
    const abcResData = await resAbcContext.json();
    const abcContext = abcResData.context || abcResData;
    assert(abcContext.team?.name === 'ABC', 'Team ABC context resolves Team ABC');
    assert(abcContext.room?.name === 'Room Beta', 'Team ABC context resolves Room Beta');
    assert(typeof abcContext.wallet?.allocatedCoins === 'number', 'Wallet contains allocatedCoins');
    assert(typeof abcContext.wallet?.investedCoins === 'number', 'Wallet contains investedCoins');
    assert(typeof abcContext.wallet?.availableCoins === 'number', 'Wallet contains availableCoins');
    assert(
      abcContext.wallet.availableCoins === abcContext.wallet.allocatedCoins - abcContext.wallet.investedCoins,
      'Consistency: availableCoins === allocatedCoins - investedCoins',
      `${abcContext.wallet.availableCoins} === ${abcContext.wallet.allocatedCoins} - ${abcContext.wallet.investedCoins}`
    );
    assert(abcContext.eventSettings?.totalCoins === 1500, 'Context includes eventSettings.totalCoins=1500');
    assert(abcContext.eventSettings?.minInvestment === 20, 'Context includes eventSettings.minInvestment=20');
    assert(abcContext.eventSettings?.maxInvestment === 100, 'Context includes eventSettings.maxInvestment=100');

    // 2.2: Context for MediBridge Leader (unspent balance)
    const resMediContext = await fetch(`${BASE_URL}/api/me/context`, {
      method: 'GET',
      headers: medibridgeHeaders,
    });
    assert(resMediContext.status === 200, 'MediBridge leader can fetch /api/me/context (HTTP 200)');
    const mediResData = await resMediContext.json();
    const mediContext = mediResData.context || mediResData;
    assert(mediContext.wallet.allocatedCoins === 1500, 'MediBridge leader wallet allocatedCoins=1500');
    assert(mediContext.wallet.investedCoins === 0, 'MediBridge leader wallet investedCoins=0');
    assert(mediContext.wallet.availableCoins === 1500, 'MediBridge leader wallet availableCoins=1500');

    // =============================================================
    // SECTION 3: INVESTMENT RULES & ROOM SCOPING
    // =============================================================
    console.log('\n--- SECTION 3: INVESTMENT RULES & ROOM SCOPING ---');

    // 3.1: Reject investment below minInvestment (amount = 10 < 20)
    const resBelowMin = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: medibridgeHeaders,
      body: JSON.stringify({
        ideaId: ecopulseIdea?.id,
        amount: 10,
      }),
    });
    assert(resBelowMin.status === 400, 'Rejects investment below minimum (HTTP 400)');
    const belowMinData = await resBelowMin.json();
    assert(belowMinData.error === 'Minimum investment is 20 coins.', 'Exact error message: "Minimum investment is 20 coins."');

    // 3.2: Reject investment above maxInvestment (amount = 120 > 100)
    const resAboveMax = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: medibridgeHeaders,
      body: JSON.stringify({
        ideaId: ecopulseIdea?.id,
        amount: 120,
      }),
    });
    assert(resAboveMax.status === 400, 'Rejects investment above maximum (HTTP 400)');
    const aboveMaxData = await resAboveMax.json();
    assert(aboveMaxData.error === 'Maximum investment is 100 coins.', 'Exact error message: "Maximum investment is 100 coins."');

    // 3.3: Reject own-team investment (MediBridge -> MediBridge Idea)
    const resOwnTeam = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: medibridgeHeaders,
      body: JSON.stringify({
        ideaId: medibridgeIdea?.id,
        amount: 50,
      }),
    });
    assert(resOwnTeam.status === 403, 'Rejects own-team investment (HTTP 403)');
    const ownTeamData = await resOwnTeam.json();
    assert(ownTeamData.error === "You cannot invest in your own team's idea.", 'Exact error: "You cannot invest in your own team\'s idea."');

    // 3.4: Valid Investment 1: MediBridge (Rohan) -> EcoPulse Idea (50 coins)
    const resInvest1 = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: medibridgeHeaders,
      body: JSON.stringify({
        ideaId: ecopulseIdea?.id,
        amount: 50,
      }),
    });
    assert(resInvest1.status === 200, 'Valid investment of 50 coins succeeds (HTTP 200)');
    const invest1Data = await resInvest1.json();
    assert(invest1Data.wallet?.allocatedCoins === 1500, 'Returned wallet allocatedCoins === 1500');
    assert(invest1Data.wallet?.investedCoins === 50, 'Returned wallet investedCoins === 50');
    assert(invest1Data.wallet?.availableCoins === 1450, 'Returned wallet availableCoins === 1450');

    // 3.5: Valid Investment 2: MediBridge (Rohan) -> TransitIQ Idea (80 coins)
    const resInvest2 = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: medibridgeHeaders,
      body: JSON.stringify({
        ideaId: transitiqIdea?.id,
        amount: 80,
      }),
    });
    assert(resInvest2.status === 200, 'Second valid investment of 80 coins succeeds (HTTP 200)');
    const invest2Data = await resInvest2.json();
    assert(invest2Data.wallet?.investedCoins === 130, 'Returned wallet investedCoins === 130 (50 + 80)');
    assert(invest2Data.wallet?.availableCoins === 1370, 'Returned wallet availableCoins === 1370 (1500 - 130)');

    // 3.6: Verify in MySQL Database
    const dbMediWallet = await prisma.wallet.findUnique({ where: { userId: medibridgeLeader.id } });
    assert(dbMediWallet?.investedCoins === 130, 'DB wallet investedCoins matches: 130');
    assert(dbMediWallet?.availableCoins === 1370, 'DB wallet availableCoins matches: 1370');
    assert(dbMediWallet?.totalCoins === 1500, 'DB wallet totalCoins matches: 1500');

    // =============================================================
    // SECTION 4: ROOM LIFECYCLE REJECTION
    // =============================================================
    console.log('\n--- SECTION 4: ROOM LIFECYCLE REJECTION ---');

    // 4.1: Pause Room Beta and verify rejection
    await prisma.room.update({ where: { id: roomBeta.id }, data: { status: 'PAUSED' } });
    const resPausedInvest = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: medibridgeHeaders,
      body: JSON.stringify({ ideaId: ecopulseIdea?.id, amount: 20 }),
    });
    assert(resPausedInvest.status === 400 || resPausedInvest.status === 403, 'Rejects investment when room is PAUSED (HTTP 400/403)');

    // 4.2: Close Room Beta and verify rejection
    await prisma.room.update({ where: { id: roomBeta.id }, data: { status: 'CLOSED' } });
    const resClosedInvest = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: medibridgeHeaders,
      body: JSON.stringify({ ideaId: ecopulseIdea?.id, amount: 20 }),
    });
    assert(resClosedInvest.status === 400 || resClosedInvest.status === 403, 'Rejects investment when room is CLOSED (HTTP 400/403)');

    // Restore Room Beta to OPEN
    await prisma.room.update({ where: { id: roomBeta.id }, data: { status: 'OPEN' } });

    // =============================================================
    // SECTION 5: CONCURRENCY & RACE CONDITION TEST
    // =============================================================
    console.log('\n--- SECTION 5: CONCURRENCY & RACE CONDITION TEST ---');

    // We create a temporary test user and team with exactly 60 coins available, assigned to Room Beta
    const testEmail = `race.test.${Date.now()}@csea.edu`;
    const raceUser = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Race Test User',
        passwordHash: 'dummy:hash',
        role: 'TEAM_LEADER',
        roomId: roomBeta.id,
        avatarInitials: 'RT',
        wallet: {
          create: {
            totalCoins: 60,
            investedCoins: 0,
            availableCoins: 60,
          },
        },
      },
      include: { wallet: true },
    });

    const raceTeam = await prisma.team.create({
      data: {
        teamId: `TEAM-RACE-${Date.now()}`,
        name: `Race Team ${Date.now()}`,
        submissionId: `SUB-RACE-${Date.now()}`,
        roomId: roomBeta.id,
        leaderId: raceUser.id,
      },
    });

    const raceSessionId = await createDatabaseSession(raceUser.id);
    const raceHeaders = { 'Cookie': `pnp_session=${raceSessionId}`, 'Content-Type': 'application/json' };

    console.log(`Created test user ${raceUser.email} in ${roomBeta.name} with 60 available coins.`);
    console.log('Sending 2 concurrent investment requests of 50 coins each...');

    // Fire 2 concurrent requests of 50 coins each simultaneously
    const [req1, req2] = await Promise.all([
      fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: raceHeaders,
        body: JSON.stringify({ ideaId: ecopulseIdea?.id, amount: 50 }),
      }),
      fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: raceHeaders,
        body: JSON.stringify({ ideaId: transitiqIdea?.id, amount: 50 }),
      }),
    ]);

    const status1 = req1.status;
    const status2 = req2.status;
    const body1 = await req1.json();
    const body2 = await req2.json();

    const successCount = (status1 === 200 ? 1 : 0) + (status2 === 200 ? 1 : 0);
    const failCount = (status1 === 400 ? 1 : 0) + (status2 === 400 ? 1 : 0);

    assert(successCount === 1, 'Exactly one concurrent investment succeeded', `Status 1: ${status1}, Status 2: ${status2}`);
    assert(failCount === 1, 'Exactly one concurrent investment failed due to insufficient funds');

    // Verify DB wallet balance was not overspent
    const raceDbWallet = await prisma.wallet.findUnique({ where: { userId: raceUser.id } });
    assert(raceDbWallet?.availableCoins === 10, 'Race test user wallet has exactly 10 coins remaining (60 - 50)');
    assert(raceDbWallet?.investedCoins === 50, 'Race test user wallet has exactly 50 coins invested');
    assert((raceDbWallet?.availableCoins ?? -1) >= 0, 'No negative balance occurred under concurrent execution');

    // Clean up race test user and team
    await prisma.investment.deleteMany({ where: { investorId: raceUser.id } });
    await prisma.team.delete({ where: { id: raceTeam.id } });
    await prisma.wallet.delete({ where: { userId: raceUser.id } });
    await prisma.session.deleteMany({ where: { userId: raceUser.id } });
    await prisma.user.delete({ where: { id: raceUser.id } });

    // =============================================================
    // SECTION 6: ADMIN OVERVIEW & AGGREGATE METRICS
    // =============================================================
    console.log('\n--- SECTION 6: ADMIN OVERVIEW & AGGREGATE METRICS ---');

    const resOverview = await fetch(`${BASE_URL}/api/admin/overview`, {
      method: 'GET',
      headers: adminHeaders,
    });
    assert(resOverview.status === 200, 'Admin can fetch /api/admin/overview (HTTP 200)');
    const overviewData = await resOverview.json();

    const totalDistributed = overviewData.stats.totalDistributedCoins;
    const totalInvested = overviewData.stats.totalCoinsInvested;
    const totalRemaining = overviewData.stats.totalCoinsRemaining;

    assert(typeof totalDistributed === 'number', 'Overview has totalDistributedCoins');
    assert(typeof totalInvested === 'number', 'Overview has totalCoinsInvested');
    assert(typeof totalRemaining === 'number', 'Overview has totalCoinsRemaining');
    assert(
      totalRemaining === totalDistributed - totalInvested,
      'Global Equation: Remaining === Distributed - Invested',
      `${totalRemaining} === ${totalDistributed} - ${totalInvested}`
    );

    // Verify room stats for Room Beta
    const betaStats = overviewData.stats.roomStats?.find((r: any) => r.code === 'ROOM-BETA');
    assert(!!betaStats, 'Room Beta present in admin roomStats');
    if (betaStats) {
      assert(
        betaStats.totalCoinsRemaining === betaStats.totalCoinsDistributed - betaStats.totalCoinsInvested,
        'Room Beta Equation: Remaining === Distributed - Invested',
        `${betaStats.totalCoinsRemaining} === ${betaStats.totalCoinsDistributed} - ${betaStats.totalCoinsInvested}`
      );
    }

    // Clean up test investments made by Rohan during test (to preserve original test state)
    await prisma.investment.deleteMany({
      where: {
        investorId: medibridgeLeader.id,
        amount: { in: [50, 80] },
      },
    });

    // Reconcile wallets to restore clean state
    await prisma.wallet.update({
      where: { userId: medibridgeLeader.id },
      data: {
        totalCoins: 1500,
        investedCoins: 0,
        availableCoins: 1500,
      },
    });

    // Clean up test sessions
    await prisma.session.deleteMany({
      where: { id: { in: [adminSessionId, abcSessionId, medibridgeSessionId] } },
    });

    // =============================================================
    // FINAL SUMMARY
    // =============================================================
    console.log('\n================================================================');
    console.log('                      TEST SUMMARY REPORT                       ');
    console.log('================================================================');
    const totalPassed = results.filter(r => r.passed).length;
    const totalFailed = results.filter(r => !r.passed).length;
    console.log(`Total Assertions: ${results.length}`);
    console.log(`Passed:           ${totalPassed}`);
    console.log(`Failed:           ${totalFailed}`);
    console.log('================================================================\n');

    if (totalFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
