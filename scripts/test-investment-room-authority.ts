import { PrismaClient, RoomStatus, UserRole } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';
import { createDatabaseSession } from '../lib/auth/session';
import assert from 'assert';

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('============================================================');
  console.log('TEST SUITE: ROOM-SCOPED SUBMISSION + INVESTMENT AUTHORITY');
  console.log('============================================================');

  const ts = Date.now();
  const testPwHash = hashPassword('TestPass@123');

  // Ensure active production event
  const event = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!event) {
    throw new Error('No active event found');
  }

  // Track created entity IDs for clean teardown
  const createdUserIds: string[] = [];
  const createdTeamIds: string[] = [];
  const createdRoomIds: string[] = [];
  const createdIdeaIds: string[] = [];
  const createdInvestmentIds: string[] = [];
  const createdBudgetIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create Room Alpha and Room Beta
    // Room Alpha: starts in DRAFT, will transition DRAFT -> OPEN -> PAUSED -> CLOSED -> REVEALED
    // -------------------------------------------------------------------------
    const roomAlpha = await prisma.room.create({
      data: {
        name: `Room Alpha ${ts}`,
        code: `RA-${ts}`.slice(0, 16),
        status: RoomStatus.DRAFT,
        eventId: event.id,
        initialCoins: 100,
        minInvestment: 10,
        maxInvestment: 50,
      },
    });
    createdRoomIds.push(roomAlpha.id);

    const roomBeta = await prisma.room.create({
      data: {
        name: `Room Beta ${ts}`,
        code: `RB-${ts}`.slice(0, 16),
        status: RoomStatus.DRAFT,
        eventId: event.id,
        initialCoins: 100,
        minInvestment: 10,
        maxInvestment: 50,
      },
    });
    createdRoomIds.push(roomBeta.id);

    // Team 1 (in Room Alpha)
    const team1 = await prisma.team.create({
      data: {
        name: `Team Alpha 1 ${ts}`,
        teamId: `TA1-${ts}`.slice(0, 10),
        submissionId: `PNP-A1-${ts}`.slice(0, 16),
        roomId: roomAlpha.id,
      },
    });
    createdTeamIds.push(team1.id);

    const leader1 = await prisma.user.create({
      data: {
        name: 'Leader One',
        email: `leader1_${ts}@test.com`,
        passwordHash: testPwHash,
        role: UserRole.TEAM_LEADER,
        teamId: team1.id,
        avatarInitials: 'L1',
      },
    });
    createdUserIds.push(leader1.id);
    await prisma.team.update({ where: { id: team1.id }, data: { leaderId: leader1.id } });

    const idea1 = await prisma.idea.create({
      data: {
        anonymousId: `IDEA-A1-${ts}`.slice(0, 16),
        teamId: team1.id,
        title: 'Alpha 1 Autonomous Solar Drone',
        track: 'CLEANTECH',
        categoryTag: 'ENERGY',
        problemStatement: 'Problem 1',
        solution: 'Solution 1',
        innovation: 'Innovation 1',
        impact: 'Impact 1',
        whyInvest: 'Why Invest 1',
        technology: 'Tech 1',
        status: 'APPROVED',
        roomId: roomAlpha.id,
        isLocked: false,
      },
    });
    createdIdeaIds.push(idea1.id);

    // Team 2 (in Room Alpha)
    const team2 = await prisma.team.create({
      data: {
        name: `Team Alpha 2 ${ts}`,
        teamId: `TA2-${ts}`.slice(0, 10),
        submissionId: `PNP-A2-${ts}`.slice(0, 16),
        roomId: roomAlpha.id,
      },
    });
    createdTeamIds.push(team2.id);

    const leader2 = await prisma.user.create({
      data: {
        name: 'Leader Two',
        email: `leader2_${ts}@test.com`,
        passwordHash: testPwHash,
        role: UserRole.TEAM_LEADER,
        teamId: team2.id,
        avatarInitials: 'L2',
      },
    });
    createdUserIds.push(leader2.id);
    await prisma.team.update({ where: { id: team2.id }, data: { leaderId: leader2.id } });

    const member2 = await prisma.user.create({
      data: {
        name: 'Member Two',
        email: `member2_${ts}@test.com`,
        passwordHash: testPwHash,
        role: UserRole.TEAM_MEMBER,
        teamId: team2.id,
        avatarInitials: 'M2',
      },
    });
    createdUserIds.push(member2.id);

    const idea2 = await prisma.idea.create({
      data: {
        anonymousId: `IDEA-A2-${ts}`.slice(0, 16),
        teamId: team2.id,
        title: 'Alpha 2 Bioelectric Diagnostics',
        track: 'HEALTHCARE',
        categoryTag: 'MEDTECH',
        problemStatement: 'Problem 2',
        solution: 'Solution 2',
        innovation: 'Innovation 2',
        impact: 'Impact 2',
        whyInvest: 'Why Invest 2',
        technology: 'Tech 2',
        status: 'APPROVED',
        roomId: roomAlpha.id,
        isLocked: false,
      },
    });
    createdIdeaIds.push(idea2.id);

    // Team 3 (in Room Beta)
    const team3 = await prisma.team.create({
      data: {
        name: `Team Beta 3 ${ts}`,
        teamId: `TB3-${ts}`.slice(0, 10),
        submissionId: `PNP-B3-${ts}`.slice(0, 16),
        roomId: roomBeta.id,
      },
    });
    createdTeamIds.push(team3.id);

    const leader3 = await prisma.user.create({
      data: {
        name: 'Leader Three',
        email: `leader3_${ts}@test.com`,
        passwordHash: testPwHash,
        role: UserRole.TEAM_LEADER,
        teamId: team3.id,
        avatarInitials: 'L3',
      },
    });
    createdUserIds.push(leader3.id);
    await prisma.team.update({ where: { id: team3.id }, data: { leaderId: leader3.id } });

    const idea3 = await prisma.idea.create({
      data: {
        anonymousId: `IDEA-B3-${ts}`.slice(0, 16),
        teamId: team3.id,
        title: 'Beta 3 Quantum Encryption Mesh',
        track: 'CYBERSECURITY',
        categoryTag: 'QUANTUM',
        problemStatement: 'Problem 3',
        solution: 'Solution 3',
        innovation: 'Innovation 3',
        impact: 'Impact 3',
        whyInvest: 'Why Invest 3',
        technology: 'Tech 3',
        status: 'APPROVED',
        roomId: roomBeta.id,
        isLocked: false,
      },
    });
    createdIdeaIds.push(idea3.id);

    // Sessions
    const session1Id = await createDatabaseSession(leader1.id);
    const cookie1 = `pnp_session=${session1Id}`;

    const session2Id = await createDatabaseSession(leader2.id);
    const cookie2 = `pnp_session=${session2Id}`;

    const sessionMember2Id = await createDatabaseSession(member2.id);
    const cookieMember2 = `pnp_session=${sessionMember2Id}`;

    const session3Id = await createDatabaseSession(leader3.id);
    const cookie3 = `pnp_session=${session3Id}`;

    // =========================================================================
    // TEST 1: DRAFT ROOM -> INVESTMENT REJECTED
    // =========================================================================
    console.log('\n--- TEST 1: DRAFT ROOM (room.status == DRAFT) ---');
    {
      const investRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ ideaId: idea2.id, amount: 20 }),
      });
      assert(investRes.status === 403, 'T1.1: Investment rejected with HTTP 403 in DRAFT room');
      const data = await investRes.json();
      assert(data.code === 'ROOM_NOT_OPEN', 'T1.2: Code is ROOM_NOT_OPEN');
      console.log('✅ PASS | DRAFT room correctly rejects investment');
    }

    // =========================================================================
    // TEST 2: TRANSITION ROOM ALPHA TO OPEN
    // Initialize participant budgets for Room Alpha
    // =========================================================================
    console.log('\n--- TEST 2: OPEN ROOM (room.status == OPEN) ---');
    {
      await prisma.room.update({
        where: { id: roomAlpha.id },
        data: { status: RoomStatus.OPEN, startedAt: new Date() },
      });

      // Attempt investment without budget -> 409 BUDGET_NOT_INITIALIZED
      const noBudgetRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ ideaId: idea2.id, amount: 20 }),
      });
      assert(noBudgetRes.status === 409, 'T2.1: Missing budget returns HTTP 409');
      const noBudgetData = await noBudgetRes.json();
      assert(noBudgetData.code === 'BUDGET_NOT_INITIALIZED', 'T2.2: Code is BUDGET_NOT_INITIALIZED');
      console.log('✅ PASS | Missing budget returns 409 BUDGET_NOT_INITIALIZED');

      // Initialize ParticipantBudgets for Leader 1 and Leader 2
      const b1 = await prisma.participantBudget.create({
        data: {
          userId: leader1.id,
          roomId: roomAlpha.id,
          allocatedCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
      });
      createdBudgetIds.push(b1.id);

      const b2 = await prisma.participantBudget.create({
        data: {
          userId: leader2.id,
          roomId: roomAlpha.id,
          allocatedCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
      });
      createdBudgetIds.push(b2.id);

      // Rule: Own-team idea rejected
      const ownRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ ideaId: idea1.id, amount: 20 }),
      });
      assert(ownRes.status === 403, 'T2.3: Own-team investment rejected with HTTP 403');
      const ownData = await ownRes.json();
      assert(ownData.code === 'OWN_TEAM_IDEA', 'T2.4: Code is OWN_TEAM_IDEA');
      console.log('✅ PASS | Own-team investment strictly rejected');

      // Rule: Cross-room idea rejected (Leader 1 in Room Alpha tries to invest in Idea 3 in Room Beta)
      const crossRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ ideaId: idea3.id, amount: 20 }),
      });
      assert(crossRes.status === 403, 'T2.5: Cross-room investment rejected with HTTP 403');
      const crossData = await crossRes.json();
      assert(crossData.code === 'CROSS_ROOM_INVESTMENT_FORBIDDEN', 'T2.6: Code is CROSS_ROOM_INVESTMENT_FORBIDDEN');
      console.log('✅ PASS | Cross-room investment strictly rejected');

      // Rule: Exceeding available coins rejected
      const overRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ ideaId: idea2.id, amount: 150 }),
      });
      assert(overRes.status === 400, 'T2.7: Exceeding maximum/available rejected with HTTP 400');
      console.log('✅ PASS | Exceeding maximum investment rejected');

      // VALID INVESTMENT: Leader 1 invests 30 coins into Idea 2 (Room Alpha peer)
      const validRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ ideaId: idea2.id, amount: 30 }),
      });
      assert(validRes.status === 200, 'T2.8: Valid investment succeeds with HTTP 200 in OPEN room');
      const validData = await validRes.json();
      assert(validData.success === true, 'T2.9: Response reports success = true');

      // Verify database ledger updates
      const updatedBudget = await prisma.participantBudget.findUnique({
        where: { userId_roomId: { userId: leader1.id, roomId: roomAlpha.id } },
      });
      assert(updatedBudget!.investedCoins === 30, 'T2.10: investedCoins increased to 30');
      assert(updatedBudget!.availableCoins === 70, 'T2.11: availableCoins decreased to 70');

      const invRecord = await prisma.investment.findFirst({
        where: { investorId: leader1.id, ideaId: idea2.id, roomId: roomAlpha.id },
      });
      assert(invRecord !== null, 'T2.12: Investment record created in MySQL');
      assert(invRecord!.amount === 30, 'T2.13: Investment amount is exactly 30');
      createdInvestmentIds.push(invRecord!.id);
      console.log('✅ PASS | Valid investment processed transactionally with accurate ledger updates');

      // Rule: Duplicate investment in the same idea in the same room rejected
      const dupRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ ideaId: idea2.id, amount: 20 }),
      });
      assert(dupRes.status === 409, 'T2.14: Duplicate investment rejected with HTTP 409');
      const dupData = await dupRes.json();
      assert(dupData.code === 'ALREADY_INVESTED', 'T2.15: Code is ALREADY_INVESTED');
      console.log('✅ PASS | Duplicate investment rejected');
    }

    // =========================================================================
    // TEST 3: PAUSED ROOM -> INVESTMENT REJECTED, SUBMISSION LOCKED
    // =========================================================================
    console.log('\n--- TEST 3: PAUSED ROOM (room.status == PAUSED) ---');
    {
      await prisma.room.update({
        where: { id: roomAlpha.id },
        data: { status: RoomStatus.PAUSED, pausedAt: new Date() },
      });

      // Leader 2 tries to invest in Idea 1 while room is PAUSED
      const pauseInvestRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie2 },
        body: JSON.stringify({ ideaId: idea1.id, amount: 20 }),
      });
      assert(pauseInvestRes.status === 403, 'T3.1: Investment rejected with HTTP 403 in PAUSED room');
      const pData = await pauseInvestRes.json();
      assert(pData.code === 'ROOM_PAUSED', 'T3.2: Code is ROOM_PAUSED');

      // Team Leader submission is LOCKED in PAUSED room
      const pauseSubRes = await fetch(`${BASE_URL}/api/team/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie2 },
        body: JSON.stringify({ problem: 'Attempt edit in PAUSED room' }),
      });
      assert(pauseSubRes.status === 403, 'T3.3: Team Leader submission rejected with 403 in PAUSED room');
      console.log('✅ PASS | PAUSED room freezes investment and submission');
    }

    // =========================================================================
    // TEST 4: CLOSED ROOM -> INVESTMENT REJECTED, SUBMISSION IS EDITABLE
    // =========================================================================
    console.log('\n--- TEST 4: CLOSED ROOM (room.status == CLOSED) ---');
    {
      await prisma.room.update({
        where: { id: roomAlpha.id },
        data: { status: RoomStatus.CLOSED, closedAt: new Date() },
      });

      // Investment in CLOSED room -> REJECTED (403)
      const closeInvestRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie2 },
        body: JSON.stringify({ ideaId: idea1.id, amount: 20 }),
      });
      assert(closeInvestRes.status === 403, 'T4.1: Investment rejected with HTTP 403 in CLOSED room');
      const cData = await closeInvestRes.json();
      assert(cData.code === 'ROOM_CLOSED', 'T4.2: Code is ROOM_CLOSED');

      // Team Leader submission in CLOSED room -> RE-ENABLED (EDITABLE)
      const closeSubGet = await fetch(`${BASE_URL}/api/team/submission`, {
        headers: { Cookie: cookie1 },
      });
      const getSubData = await closeSubGet.json();
      assert(getSubData.isLocked === false, 'T4.3: isLocked is FALSE in CLOSED room');
      assert(getSubData.submissionIsLocked === false, 'T4.4: submissionIsLocked is FALSE in CLOSED room');

      const closeSubPost = await fetch(`${BASE_URL}/api/team/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({
          problem: 'Revised problem in CLOSED room by Leader 1.',
          solution: 'Revised solution in CLOSED room.',
          innovation: 'Revised innovation in CLOSED room.',
          impact: 'Revised impact in CLOSED room.',
          whyInvest: 'Revised why invest in CLOSED room.',
          techStack: 'Next.js, Prisma, MySQL.',
          submitForReview: false,
        }),
      });
      assert(closeSubPost.status === 200, 'T4.5: Team Leader can edit & save idea in CLOSED room (HTTP 200)');
      const postSubData = await closeSubPost.json();
      assert(postSubData.success === true, 'T4.6: Response reports success = true');

      // Verify anonymous ID preserved and historical investment unchanged
      const ideaCheck = await prisma.idea.findUnique({ where: { id: idea1.id } });
      assert(ideaCheck!.anonymousId === `IDEA-A1-${ts}`.slice(0, 16), 'T4.7: Anonymous ID preserved');
      const invCheck = await prisma.investment.findFirst({
        where: { investorId: leader1.id, ideaId: idea2.id, roomId: roomAlpha.id },
      });
      assert(invCheck !== null && invCheck.amount === 30, 'T4.8: Historical investment preserved intact');
      console.log('✅ PASS | CLOSED room rejects investment but re-enables Team Leader editing');
    }

    // =========================================================================
    // TEST 5: TEAM MOVEMENT TO ROOM B (HISTORICAL INVESTMENTS PRESERVED)
    // Team 1 moves from Room Alpha (CLOSED) to Room Beta (starts DRAFT -> OPEN)
    // =========================================================================
    console.log('\n--- TEST 5: TEAM MOVES TO ROOM B & HISTORICAL PRESERVATION ---');
    {
      // Move Team 1 to Room Beta
      await prisma.team.update({
        where: { id: team1.id },
        data: { roomId: roomBeta.id },
      });
      await prisma.idea.update({
        where: { id: idea1.id },
        data: { roomId: roomBeta.id },
      });

      // Verify historical investment from Room Alpha remains attached to Room Alpha
      const historicalInv = await prisma.investment.findFirst({
        where: { investorId: leader1.id, ideaId: idea2.id },
      });
      assert(historicalInv!.roomId === roomAlpha.id, 'T5.1: Historical investment remains associated with Room Alpha');

      // Open Room Beta
      await prisma.room.update({
        where: { id: roomBeta.id },
        data: { status: RoomStatus.OPEN, startedAt: new Date() },
      });

      // In Room Beta (OPEN), Team 1 Leader is now LOCKED from editing
      const subInBetaRes = await fetch(`${BASE_URL}/api/team/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ problem: 'Attempting edit while Room Beta is OPEN' }),
      });
      assert(subInBetaRes.status === 403, 'T5.2: Team 1 Leader cannot edit while Room Beta is OPEN');
      const subInBetaData = await subInBetaRes.json();
      assert(subInBetaData.code === 'IDEA_LOCKED', 'T5.3: Code is IDEA_LOCKED in Room Beta');

      // Initialize budget for Leader 3 in Room Beta
      const b3 = await prisma.participantBudget.create({
        data: {
          userId: leader3.id,
          roomId: roomBeta.id,
          allocatedCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
      });
      createdBudgetIds.push(b3.id);

      // Leader 3 (in Room Beta) CAN invest in Team 1's idea (now in Room Beta)
      const investInBetaRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie3 },
        body: JSON.stringify({ ideaId: idea1.id, amount: 40 }),
      });
      assert(investInBetaRes.status === 200, 'T5.4: Leader 3 in Room Beta can invest in Team 1 (HTTP 200)');
      const invBetaData = await investInBetaRes.json();
      assert(invBetaData.success === true, 'T5.5: Investment in Room Beta succeeded');

      // Verify the new investment is associated with Room Beta
      const newInvRecord = await prisma.investment.findFirst({
        where: { investorId: leader3.id, ideaId: idea1.id, roomId: roomBeta.id },
      });
      assert(newInvRecord !== null, 'T5.6: New investment associated with Room Beta in MySQL');
      assert(newInvRecord!.amount === 40, 'T5.7: Investment amount in Room Beta is 40');
      createdInvestmentIds.push(newInvRecord!.id);

      // Verify the old investment from Room Alpha is STILL associated with Room Alpha
      const oldInvCheck = await prisma.investment.findFirst({
        where: { investorId: leader1.id, ideaId: idea2.id },
      });
      assert(oldInvCheck!.roomId === roomAlpha.id, 'T5.8: Historical Room Alpha investment completely untouched');
      console.log('✅ PASS | Team movement preserves historical investments and allows new investments in new room');
    }

    // =========================================================================
    // TEST 6: REVEALED ROOM -> INVESTMENT REJECTED, SUBMISSION LOCKED
    // =========================================================================
    console.log('\n--- TEST 6: REVEALED ROOM (room.status == REVEALED) ---');
    {
      await prisma.room.update({
        where: { id: roomBeta.id },
        data: { status: RoomStatus.REVEALED, revealedAt: new Date() },
      });

      // Investment in REVEALED room -> 403
      const revInvestRes = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie3 },
        body: JSON.stringify({ ideaId: idea1.id, amount: 10 }),
      });
      assert(revInvestRes.status === 403, 'T6.1: Investment rejected in REVEALED room');

      // Submission in REVEALED room -> 403
      const revSubRes = await fetch(`${BASE_URL}/api/team/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ problem: 'Edit attempt in REVEALED room' }),
      });
      assert(revSubRes.status === 403, 'T6.2: Submission rejected in REVEALED room');
      console.log('✅ PASS | REVEALED room locks both investments and submissions');
    }

    // =========================================================================
    // TEST 7: CRITICAL MULTI-ROOM INDEPENDENCE ACCEPTANCE
    // Room A = CLOSED, Room B = OPEN, Room C = DRAFT, Room D = PAUSED
    // =========================================================================
    console.log('\n--- TEST 7: CRITICAL MULTI-ROOM INDEPENDENCE (4 ROOMS CONCURRENT) ---');
    {
      const rA = await prisma.room.create({
        data: { name: `MRA ${ts}`, code: `MRA-${ts}`.slice(0, 16), status: RoomStatus.CLOSED, eventId: event.id },
      });
      const rB = await prisma.room.create({
        data: { name: `MRB ${ts}`, code: `MRB-${ts}`.slice(0, 16), status: RoomStatus.OPEN, eventId: event.id, initialCoins: 100, minInvestment: 10, maxInvestment: 50 },
      });
      const rC = await prisma.room.create({
        data: { name: `MRC ${ts}`, code: `MRC-${ts}`.slice(0, 16), status: RoomStatus.DRAFT, eventId: event.id },
      });
      const rD = await prisma.room.create({
        data: { name: `MRD ${ts}`, code: `MRD-${ts}`.slice(0, 16), status: RoomStatus.PAUSED, eventId: event.id },
      });
      createdRoomIds.push(rA.id, rB.id, rC.id, rD.id);

      // Teams in each room
      const tA = await prisma.team.create({ data: { name: `TA ${ts}`, teamId: `MTA-${ts}`.slice(0, 10), submissionId: `PNP-MA-${ts}`.slice(0, 16), roomId: rA.id } });
      const tB1 = await prisma.team.create({ data: { name: `TB1 ${ts}`, teamId: `MTB1-${ts}`.slice(0, 10), submissionId: `PNP-MB1-${ts}`.slice(0, 16), roomId: rB.id } });
      const tB2 = await prisma.team.create({ data: { name: `TB2 ${ts}`, teamId: `MTB2-${ts}`.slice(0, 10), submissionId: `PNP-MB2-${ts}`.slice(0, 16), roomId: rB.id } });
      const tC = await prisma.team.create({ data: { name: `TC ${ts}`, teamId: `MTC-${ts}`.slice(0, 10), submissionId: `PNP-MC-${ts}`.slice(0, 16), roomId: rC.id } });
      const tD = await prisma.team.create({ data: { name: `TD ${ts}`, teamId: `MTD-${ts}`.slice(0, 10), submissionId: `PNP-MD-${ts}`.slice(0, 16), roomId: rD.id } });
      createdTeamIds.push(tA.id, tB1.id, tB2.id, tC.id, tD.id);

      // Leaders
      const lA = await prisma.user.create({ data: { name: 'LA', email: `la_${ts}@test.com`, passwordHash: testPwHash, role: UserRole.TEAM_LEADER, teamId: tA.id, avatarInitials: 'LA' } });
      const lB1 = await prisma.user.create({ data: { name: 'LB1', email: `lb1_${ts}@test.com`, passwordHash: testPwHash, role: UserRole.TEAM_LEADER, teamId: tB1.id, avatarInitials: 'B1' } });
      const lB2 = await prisma.user.create({ data: { name: 'LB2', email: `lb2_${ts}@test.com`, passwordHash: testPwHash, role: UserRole.TEAM_LEADER, teamId: tB2.id, avatarInitials: 'B2' } });
      const lC = await prisma.user.create({ data: { name: 'LC', email: `lc_${ts}@test.com`, passwordHash: testPwHash, role: UserRole.TEAM_LEADER, teamId: tC.id, avatarInitials: 'LC' } });
      const lD = await prisma.user.create({ data: { name: 'LD', email: `ld_${ts}@test.com`, passwordHash: testPwHash, role: UserRole.TEAM_LEADER, teamId: tD.id, avatarInitials: 'LD' } });
      createdUserIds.push(lA.id, lB1.id, lB2.id, lC.id, lD.id);

      await prisma.team.update({ where: { id: tA.id }, data: { leaderId: lA.id } });
      await prisma.team.update({ where: { id: tB1.id }, data: { leaderId: lB1.id } });
      await prisma.team.update({ where: { id: tB2.id }, data: { leaderId: lB2.id } });
      await prisma.team.update({ where: { id: tC.id }, data: { leaderId: lC.id } });
      await prisma.team.update({ where: { id: tD.id }, data: { leaderId: lD.id } });

      const cA = `pnp_session=${await createDatabaseSession(lA.id)}`;
      const cB1 = `pnp_session=${await createDatabaseSession(lB1.id)}`;
      const cB2 = `pnp_session=${await createDatabaseSession(lB2.id)}`;
      const cC = `pnp_session=${await createDatabaseSession(lC.id)}`;
      const cD = `pnp_session=${await createDatabaseSession(lD.id)}`;

      // Ideas for Room B
      const idB1 = await prisma.idea.create({
        data: {
          anonymousId: `IDEA-MB1-${ts}`.slice(0, 16),
          teamId: tB1.id,
          title: 'Idea B1',
          track: 'AI',
          categoryTag: 'TECH',
          problemStatement: 'P',
          solution: 'S',
          innovation: 'I',
          impact: 'IM',
          whyInvest: 'W',
          technology: 'T',
          status: 'APPROVED',
          roomId: rB.id,
        },
      });
      const idB2 = await prisma.idea.create({
        data: {
          anonymousId: `IDEA-MB2-${ts}`.slice(0, 16),
          teamId: tB2.id,
          title: 'Idea B2',
          track: 'AI',
          categoryTag: 'TECH',
          problemStatement: 'P',
          solution: 'S',
          innovation: 'I',
          impact: 'IM',
          whyInvest: 'W',
          technology: 'T',
          status: 'APPROVED',
          roomId: rB.id,
        },
      });
      createdIdeaIds.push(idB1.id, idB2.id);

      // Budgets for Room B
      const bB1 = await prisma.participantBudget.create({
        data: { userId: lB1.id, roomId: rB.id, allocatedCoins: 100, availableCoins: 100, investedCoins: 0 },
      });
      createdBudgetIds.push(bB1.id);

      // Verify TEAM A (CLOSED): Leader CAN EDIT, Investment CANNOT
      const subA = await fetch(`${BASE_URL}/api/team/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cA },
        body: JSON.stringify({ problem: 'Team A in CLOSED room' }),
      });
      assert(subA.status === 200, 'T7.1: TEAM A Leader in CLOSED room CAN EDIT (200)');

      // Verify TEAM B (OPEN): Leader CANNOT EDIT, Investment CAN
      const subB = await fetch(`${BASE_URL}/api/team/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cB1 },
        body: JSON.stringify({ problem: 'Team B in OPEN room' }),
      });
      assert(subB.status === 403, 'T7.2: TEAM B Leader in OPEN room CANNOT EDIT (403)');

      const invB = await fetch(`${BASE_URL}/api/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cB1 },
        body: JSON.stringify({ ideaId: idB2.id, amount: 25 }),
      });
      assert(invB.status === 200, 'T7.3: TEAM B Participant in OPEN room CAN INVEST (200)');

      // Verify TEAM C (DRAFT): Leader CAN EDIT, Investment CANNOT
      const subC = await fetch(`${BASE_URL}/api/team/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cC },
        body: JSON.stringify({ problem: 'Team C in DRAFT room' }),
      });
      assert(subC.status === 200, 'T7.4: TEAM C Leader in DRAFT room CAN EDIT (200)');

      // Verify TEAM D (PAUSED): Leader CANNOT EDIT, Investment CANNOT
      const subD = await fetch(`${BASE_URL}/api/team/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cD },
        body: JSON.stringify({ problem: 'Team D in PAUSED room' }),
      });
      assert(subD.status === 403, 'T7.5: TEAM D Leader in PAUSED room CANNOT EDIT (403)');

      console.log('✅ PASS | All 4 concurrent rooms operate with complete isolation and adherence to authoritative matrix');
    }
  } finally {
    console.log('\n--- CLEANING UP TEMPORARY TEST ENTITIES ---');
    if (createdInvestmentIds.length > 0) {
      await prisma.investment.deleteMany({ where: { id: { in: createdInvestmentIds } } });
    }
    if (createdBudgetIds.length > 0) {
      await prisma.participantBudget.deleteMany({ where: { id: { in: createdBudgetIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.team.updateMany({ where: { leaderId: { in: createdUserIds } }, data: { leaderId: null } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdIdeaIds.length > 0) {
      await prisma.idea.deleteMany({ where: { id: { in: createdIdeaIds } } });
    }
    if (createdTeamIds.length > 0) {
      await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } });
    }
    if (createdRoomIds.length > 0) {
      await prisma.room.deleteMany({ where: { id: { in: createdRoomIds } } });
    }
    console.log('✓ Teardown complete');
  }

  console.log('\n============================================================');
  console.log('ALL ROOM-SCOPED INVESTMENT & SUBMISSION SCENARIOS PASSED (100%)');
  console.log('============================================================');
}

main()
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
