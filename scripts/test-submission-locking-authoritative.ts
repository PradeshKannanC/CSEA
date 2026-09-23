import { PrismaClient, UserRole, RoomStatus, EventStatus } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';
import { createDatabaseSession } from '../lib/auth/session';

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    throw new Error(`Assertion failed: ${testName} - ${detail || ''}`);
  }
}

async function main() {
  console.log('============================================================');
  console.log('TEST SUITE: AUTHORITATIVE ROOM-SCOPED SUBMISSION LOCKING');
  console.log('============================================================\n');

  const ts = Date.now();
  const testPassword = 'Password@123';
  const testPwHash = hashPassword(testPassword);

  // 1. Setup Test Event (OPEN status to ensure global event does NOT lock unassigned/DRAFT teams)
  const event = await prisma.event.upsert({
    where: { id: 'evt-pnp-production' },
    create: {
      id: 'evt-pnp-production',
      name: 'PITCH AND PROSPER Arena 2024',
      status: EventStatus.OPEN,
      round: 1,
      totalCoins: 100,
      minInvestment: 10,
      maxInvestment: 50,
      investmentStartsAt: new Date(),
    },
    update: {
      status: EventStatus.OPEN,
      investmentStartsAt: new Date(),
    },
  });
  console.log(`✓ Active Event configured: status = ${event.status}, investmentStartsAt = active`);

  // 2. Setup Independent/Competitor Room (Room Other) which is OPEN with its own team
  const otherRoom = await prisma.room.create({
    data: {
      name: `Competitor Active Room ${ts}`,
      code: `RM-OTHER-${ts}`.slice(0, 16),
      status: RoomStatus.OPEN,
      eventId: event.id,
      startedAt: new Date(),
    },
  });

  // 3. Setup Test Room (Room Alpha) which starts in DRAFT
  const roomAlpha = await prisma.room.create({
    data: {
      name: `Room Alpha ${ts}`,
      code: `RM-ALPHA-${ts}`.slice(0, 16),
      status: RoomStatus.DRAFT,
      eventId: event.id,
    },
  });

  // 4. Create Team INX (No Room Assigned Initially: roomId = null)
  const teamInx = await prisma.team.create({
    data: {
      name: `Team INX ${ts}`,
      teamId: `INX-${ts}`.slice(0, 10),
      submissionId: `PNP-INX-${ts}`.slice(0, 16),
      cohort: 'Alpha 2024',
      roomId: null, // CRITICAL: NO ROOM ASSIGNED
    },
  });

  // 5. Create Team Leader DDD for Team INX
  const leaderInx = await prisma.user.create({
    data: {
      name: 'Leader DDD',
      email: `leader_ddd_${ts}@test.com`,
      passwordHash: testPwHash,
      role: UserRole.TEAM_LEADER,
      isActive: true,
      emailVerified: true,
      avatarInitials: 'LD',
      teamId: teamInx.id,
    },
  });

  await prisma.team.update({
    where: { id: teamInx.id },
    data: { leaderId: leaderInx.id },
  });

  await prisma.teamMember.create({
    data: {
      teamId: teamInx.id,
      userId: leaderInx.id,
      email: leaderInx.email,
      name: leaderInx.name,
      role: UserRole.TEAM_LEADER,
    },
  });

  // 6. Create Team Member EEE for Team INX
  const memberInx = await prisma.user.create({
    data: {
      name: 'Member EEE',
      email: `member_eee_${ts}@test.com`,
      passwordHash: testPwHash,
      role: UserRole.TEAM_MEMBER,
      isActive: true,
      emailVerified: true,
      avatarInitials: 'ME',
      teamId: teamInx.id,
    },
  });

  await prisma.teamMember.create({
    data: {
      teamId: teamInx.id,
      userId: memberInx.id,
      email: memberInx.email,
      name: memberInx.name,
      role: UserRole.TEAM_MEMBER,
    },
  });

  // Create session cookies
  const leaderSessionId = await createDatabaseSession(leaderInx.id);
  const leaderCookie = `pnp_session=${leaderSessionId}`;

  const memberSessionId = await createDatabaseSession(memberInx.id);
  const memberCookie = `pnp_session=${memberSessionId}`;

  console.log('✓ Initialized test entities: Team INX (roomId: null), Leader DDD, Member EEE');

  // =========================================================================
  // TEST 1: NO ROOM ASSIGNED -> SUBMISSION EDITABLE (Global Event is OPEN)
  // =========================================================================
  console.log('\n--- TEST 1: NO ROOM ASSIGNED (team.roomId == null) ---');
  {
    const getRes = await fetch(`${BASE_URL}/api/team/submission`, {
      headers: { Cookie: leaderCookie },
    });
    assert(getRes.status === 200, 'T1.1: GET /api/team/submission returns HTTP 200');
    const getData = await getRes.json();
    assert(getData.success === true, 'T1.2: GET response reports success = true');
    assert(getData.isLocked === false, 'T1.3: isLocked is FALSE when team has no room assigned');
    assert(getData.roomId === null, 'T1.4: roomId is null');

    // POST initial proposal revisions
    const postRes = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: leaderCookie,
      },
      body: JSON.stringify({
        problem: 'Autonomous microgrid balancing challenges in urban density.',
        solution: 'Edge-orchestrated dynamic battery distribution routing.',
        innovation: 'Zero-knowledge peer dispatch protocol.',
        impact: 'Reduces peak feeder line congestion by 42 percent.',
        whyInvest: 'First-mover localized distributed energy trading engine.',
        techStack: 'Rust, WebSockets, TimescaleDB, Docker.',
        submitForReview: false,
      }),
    });
    assert(postRes.status === 200, 'T1.5: POST /api/team/submission succeeds (HTTP 200) for unassigned team');
    const postData = await postRes.json();
    assert(postData.success === true, 'T1.6: POST response reports success = true');
    assert(postData.isLocked === false, 'T1.7: Returned isLocked is FALSE');

    // PATCH update
    const patchRes = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: leaderCookie,
      },
      body: JSON.stringify({
        problem: 'Updated problem statement for urban microgrids.',
        solution: 'Edge-orchestrated dynamic battery distribution routing.',
        innovation: 'Zero-knowledge peer dispatch protocol.',
        impact: 'Reduces peak feeder line congestion by 42 percent.',
        whyInvest: 'First-mover localized distributed energy trading engine.',
        techStack: 'Rust, WebSockets, TimescaleDB, Docker.',
        submitForReview: false,
      }),
    });
    assert(patchRes.status === 200, 'T1.8: PATCH /api/team/submission succeeds (HTTP 200)');
  }

  // =========================================================================
  // TEST 2: ROOM ASSIGNED AND STATUS IS DRAFT -> SUBMISSION EDITABLE
  // =========================================================================
  console.log('\n--- TEST 2: ROOM IS DRAFT (team.roomId != null && room.status == DRAFT) ---');
  {
    // Admin assigns INX to Room Alpha (DRAFT)
    await prisma.team.update({
      where: { id: teamInx.id },
      data: { roomId: roomAlpha.id },
    });
    await prisma.idea.updateMany({
      where: { teamId: teamInx.id },
      data: { roomId: roomAlpha.id, isLocked: false },
    });

    const getRes = await fetch(`${BASE_URL}/api/team/submission`, {
      headers: { Cookie: leaderCookie },
    });
    assert(getRes.status === 200, 'T2.1: GET /api/team/submission returns HTTP 200 for DRAFT room');
    const getData = await getRes.json();
    assert(getData.isLocked === false, 'T2.2: isLocked is FALSE when room status is DRAFT');
    assert(getData.roomStatus === 'DRAFT', 'T2.3: roomStatus reports DRAFT');

    const postRes = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: leaderCookie,
      },
      body: JSON.stringify({
        problem: 'Revised problem in draft room Alpha.',
        solution: 'Draft room solution updated by Team Leader.',
        innovation: 'Draft room innovation.',
        impact: 'Draft room impact.',
        whyInvest: 'Draft room why invest.',
        techStack: 'Rust, TypeScript, Next.js.',
        submitForReview: true,
      }),
    });
    assert(postRes.status === 200, 'T2.4: POST /api/team/submission succeeds in DRAFT room');
    const postData = await postRes.json();
    assert(postData.status === 'APPROVED', 'T2.5: Proposal submitted for review marked APPROVED');
  }

  // =========================================================================
  // TEST 3: ROOM STARTS (OPEN) -> SUBMISSION LOCKED
  // =========================================================================
  console.log('\n--- TEST 3: ROOM OPEN (team.roomId != null && room.status == OPEN) ---');
  {
    // Admin starts Room Alpha (transitions DRAFT -> OPEN)
    await prisma.room.update({
      where: { id: roomAlpha.id },
      data: { status: RoomStatus.OPEN, startedAt: new Date() },
    });
    await prisma.idea.updateMany({
      where: { roomId: roomAlpha.id },
      data: { isLocked: true },
    });

    const getRes = await fetch(`${BASE_URL}/api/team/submission`, {
      headers: { Cookie: leaderCookie },
    });
    assert(getRes.status === 200, 'T3.1: GET /api/team/submission returns HTTP 200');
    const getData = await getRes.json();
    assert(getData.isLocked === true, 'T3.2: isLocked is TRUE when room status is OPEN');
    assert(getData.roomStatus === 'OPEN', 'T3.3: roomStatus reports OPEN');

    // Attempt modification during OPEN
    const postRes = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: leaderCookie,
      },
      body: JSON.stringify({
        problem: 'Illegal modification during active investment window.',
        solution: 'Should be rejected by server guard.',
      }),
    });
    assert(postRes.status === 403, 'T3.4: POST rejected with HTTP 403 when room is OPEN');
    const postData = await postRes.json();
    assert(postData.code === 'IDEA_LOCKED', 'T3.5: Error code is IDEA_LOCKED');
    assert(
      postData.message && postData.message.includes('Your idea is locked because the investment period has begun'),
      'T3.6: Expected authoritative lock message returned'
    );
  }

  // =========================================================================
  // TEST 4: ROOM PAUSED -> SUBMISSION REMAINS LOCKED
  // =========================================================================
  console.log('\n--- TEST 4: ROOM PAUSED (room.status == PAUSED) ---');
  {
    await prisma.room.update({
      where: { id: roomAlpha.id },
      data: { status: RoomStatus.PAUSED, pausedAt: new Date() },
    });

    const getRes = await fetch(`${BASE_URL}/api/team/submission`, {
      headers: { Cookie: leaderCookie },
    });
    const getData = await getRes.json();
    assert(getData.isLocked === true, 'T4.1: isLocked is TRUE when room status is PAUSED');

    const postRes = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: leaderCookie,
      },
      body: JSON.stringify({
        problem: 'Illegal modification while room is paused.',
      }),
    });
    assert(postRes.status === 403, 'T4.2: POST rejected with HTTP 403 when room is PAUSED');
  }

  // =========================================================================
  // TEST 5: ROOM CLOSED -> SUBMISSION IS RE-ENABLED (EDITABLE)
  // =========================================================================
  console.log('\n--- TEST 5: ROOM CLOSED (room.status == CLOSED) ---');
  {
    await prisma.room.update({
      where: { id: roomAlpha.id },
      data: { status: RoomStatus.CLOSED, closedAt: new Date() },
    });

    const getRes = await fetch(`${BASE_URL}/api/team/submission`, {
      headers: { Cookie: leaderCookie },
    });
    const getData = await getRes.json();
    assert(getData.isLocked === false, 'T5.1: isLocked is FALSE when room status is CLOSED (Team Leader can edit again)');
    assert(getData.submissionIsLocked === false, 'T5.2: submissionIsLocked is FALSE when room status is CLOSED');

    const postRes = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: leaderCookie,
      },
      body: JSON.stringify({
        problem: 'Revised problem in CLOSED room — Team Leader preparing for next round.',
        solution: 'Revised solution saved by Team Leader in CLOSED room.',
        innovation: 'Revised innovation in CLOSED room.',
        impact: 'Revised impact in CLOSED room.',
        whyInvest: 'Revised why invest in CLOSED room.',
        techStack: 'Revised tech stack in CLOSED room.',
        submitForReview: false,
      }),
    });
    assert(postRes.status === 200, 'T5.3: POST /api/team/submission succeeds (HTTP 200) in CLOSED room');
    const postData = await postRes.json();
    assert(postData.success === true, 'T5.4: POST response reports success = true in CLOSED room');

    const patchRes = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: leaderCookie,
      },
      body: JSON.stringify({
        problem: 'Further revised problem in CLOSED room via PATCH.',
      }),
    });
    assert(patchRes.status === 200, 'T5.5: PATCH /api/team/submission succeeds (HTTP 200) in CLOSED room');
  }

  // =========================================================================
  // TEST 6: ROOM REVEALED -> SUBMISSION REMAINS LOCKED
  // =========================================================================
  console.log('\n--- TEST 6: ROOM REVEALED (room.status == REVEALED) ---');
  {
    await prisma.room.update({
      where: { id: roomAlpha.id },
      data: { status: RoomStatus.REVEALED, revealedAt: new Date() },
    });

    const getRes = await fetch(`${BASE_URL}/api/team/submission`, {
      headers: { Cookie: leaderCookie },
    });
    const getData = await getRes.json();
    assert(getData.isLocked === true, 'T6.1: isLocked is TRUE when room status is REVEALED');

    const postRes = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: leaderCookie,
      },
      body: JSON.stringify({
        problem: 'Illegal modification after results revealed.',
      }),
    });
    assert(postRes.status === 403, 'T6.2: POST rejected with HTTP 403 when room is REVEALED');
  }

  // =========================================================================
  // TEST 7: MULTI-ROOM ISOLATION (Room A OPEN, Room B DRAFT, Team C unassigned)
  // =========================================================================
  console.log('\n--- TEST 7: MULTI-ROOM CONCURRENCY & ISOLATION ---');
  {
    // Room A -> OPEN
    const roomA = await prisma.room.create({
      data: {
        name: `Multi Room A ${ts}`,
        code: `RM-A-${ts}`.slice(0, 16),
        status: RoomStatus.OPEN,
        eventId: event.id,
      },
    });

    // Room B -> DRAFT
    const roomB = await prisma.room.create({
      data: {
        name: `Multi Room B ${ts}`,
        code: `RM-B-${ts}`.slice(0, 16),
        status: RoomStatus.DRAFT,
        eventId: event.id,
      },
    });

    // Team A -> Room A
    const teamA = await prisma.team.create({
      data: {
        name: `Team A ${ts}`,
        teamId: `TMA-${ts}`.slice(0, 10),
        submissionId: `PNP-A-${ts}`.slice(0, 16),
        roomId: roomA.id,
      },
    });
    const leaderA = await prisma.user.create({
      data: {
        name: 'Leader A',
        email: `leader_a_${ts}@test.com`,
        passwordHash: testPwHash,
        role: UserRole.TEAM_LEADER,
        teamId: teamA.id,
        avatarInitials: 'LA',
      },
    });
    await prisma.team.update({ where: { id: teamA.id }, data: { leaderId: leaderA.id } });
    const sessionAId = await createDatabaseSession(leaderA.id);
    const cookieA = `pnp_session=${sessionAId}`;

    // Team B -> Room B
    const teamB = await prisma.team.create({
      data: {
        name: `Team B ${ts}`,
        teamId: `TMB-${ts}`.slice(0, 10),
        submissionId: `PNP-B-${ts}`.slice(0, 16),
        roomId: roomB.id,
      },
    });
    const leaderB = await prisma.user.create({
      data: {
        name: 'Leader B',
        email: `leader_b_${ts}@test.com`,
        passwordHash: testPwHash,
        role: UserRole.TEAM_LEADER,
        teamId: teamB.id,
        avatarInitials: 'LB',
      },
    });
    await prisma.team.update({ where: { id: teamB.id }, data: { leaderId: leaderB.id } });
    const sessionBId = await createDatabaseSession(leaderB.id);
    const cookieB = `pnp_session=${sessionBId}`;

    // Team C -> unassigned
    const teamC = await prisma.team.create({
      data: {
        name: `Team C ${ts}`,
        teamId: `TMC-${ts}`.slice(0, 10),
        submissionId: `PNP-C-${ts}`.slice(0, 16),
        roomId: null, // UNASSIGNED
      },
    });
    const leaderC = await prisma.user.create({
      data: {
        name: 'Leader C',
        email: `leader_c_${ts}@test.com`,
        passwordHash: testPwHash,
        role: UserRole.TEAM_LEADER,
        teamId: teamC.id,
        avatarInitials: 'LC',
      },
    });
    await prisma.team.update({ where: { id: teamC.id }, data: { leaderId: leaderC.id } });
    const sessionCId = await createDatabaseSession(leaderC.id);
    const cookieC = `pnp_session=${sessionCId}`;

    // Test Team A (Room A is OPEN) -> LOCKED
    const resA = await fetch(`${BASE_URL}/api/team/submission`, { headers: { Cookie: cookieA } });
    const dataA = await resA.json();
    assert(dataA.isLocked === true, 'T7.1: Team A (in OPEN room) is LOCKED');

    const postA = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ problem: 'Test A' }),
    });
    assert(postA.status === 403, 'T7.2: Team A cannot modify submission (403)');

    // Test Team B (Room B is DRAFT) -> EDITABLE
    const resB = await fetch(`${BASE_URL}/api/team/submission`, { headers: { Cookie: cookieB } });
    const dataB = await resB.json();
    assert(dataB.isLocked === false, 'T7.3: Team B (in DRAFT room) is EDITABLE despite Room A being OPEN');

    const postB = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieB },
      body: JSON.stringify({
        problem: 'Valid problem statement for Team B in draft room.',
        solution: 'Valid solution for Team B.',
        innovation: 'Valid innovation.',
        impact: 'Valid impact statement.',
        whyInvest: 'Valid pitch.',
        techStack: 'Node.js, TypeScript.',
      }),
    });
    assert(postB.status === 200, 'T7.4: Team B can modify submission (200)');

    // Test Team C (Unassigned) -> EDITABLE
    const resC = await fetch(`${BASE_URL}/api/team/submission`, { headers: { Cookie: cookieC } });
    const dataC = await resC.json();
    assert(dataC.isLocked === false, 'T7.5: Team C (Unassigned) is EDITABLE despite Room A being OPEN');

    const postC = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieC },
      body: JSON.stringify({
        problem: 'Valid problem statement for Team C without room.',
        solution: 'Valid solution for Team C.',
        innovation: 'Valid innovation.',
        impact: 'Valid impact statement.',
        whyInvest: 'Valid pitch.',
        techStack: 'Python, PyTorch.',
      }),
    });
    assert(postC.status === 200, 'T7.6: Team C can modify submission (200)');

    // Room D -> CLOSED
    const roomD = await prisma.room.create({
      data: {
        name: `Multi Room D ${ts}`,
        code: `RM-D-${ts}`.slice(0, 16),
        status: RoomStatus.CLOSED,
        eventId: event.id,
      },
    });
    const teamD = await prisma.team.create({
      data: {
        name: `Team D ${ts}`,
        teamId: `TMD-${ts}`.slice(0, 10),
        submissionId: `PNP-D-${ts}`.slice(0, 16),
        roomId: roomD.id,
      },
    });
    const leaderD = await prisma.user.create({
      data: {
        name: 'Leader D',
        email: `leader_d_${ts}@test.com`,
        passwordHash: testPwHash,
        role: UserRole.TEAM_LEADER,
        teamId: teamD.id,
        avatarInitials: 'LD',
      },
    });
    await prisma.team.update({ where: { id: teamD.id }, data: { leaderId: leaderD.id } });
    const sessionDId = await createDatabaseSession(leaderD.id);
    const cookieD = `pnp_session=${sessionDId}`;

    // Test Team D (Room D is CLOSED) -> EDITABLE
    const resD = await fetch(`${BASE_URL}/api/team/submission`, { headers: { Cookie: cookieD } });
    const dataD = await resD.json();
    assert(dataD.isLocked === false, 'T7.7: Team D (in CLOSED room) is EDITABLE');

    const postD = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieD },
      body: JSON.stringify({
        problem: 'Valid problem statement for Team D in CLOSED room.',
        solution: 'Valid solution for Team D.',
        innovation: 'Valid innovation.',
        impact: 'Valid impact statement.',
        whyInvest: 'Valid pitch.',
        techStack: 'Go, Docker.',
      }),
    });
    assert(postD.status === 200, 'T7.8: Team D can modify submission in CLOSED room (200)');
  }

  // =========================================================================
  // TEST 8: TEAM MEMBER READ-ONLY ENFORCEMENT
  // =========================================================================
  console.log('\n--- TEST 8: TEAM MEMBER READ-ONLY GUARANTEE ---');
  {
    // Member EEE attempts to save proposal on Team INX
    const postMem = await fetch(`${BASE_URL}/api/team/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: memberCookie,
      },
      body: JSON.stringify({
        problem: 'Team member unauthorized edit attempt.',
      }),
    });
    assert(postMem.status === 403, 'T8.1: TEAM_MEMBER rejected with HTTP 403');
    const memData = await postMem.json();
    assert(memData.code === 'PERMISSION_DENIED', 'T8.2: Code is PERMISSION_DENIED');
  }

  // Clean up all temporary test records created during this run
  console.log('\n--- CLEANING UP TEMPORARY TEST ARTIFACTS ---');
  const testUserEmails = [
    `leader_ddd_${ts}@test.com`,
    `member_eee_${ts}@test.com`,
    `leader_a_${ts}@test.com`,
    `leader_b_${ts}@test.com`,
    `leader_c_${ts}@test.com`,
    `leader_d_${ts}@test.com`,
  ];
  const testUsers = await prisma.user.findMany({ where: { email: { in: testUserEmails } }, select: { id: true } });
  const testUserIds = testUsers.map((u) => u.id);

  await prisma.session.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.teamMember.deleteMany({ where: { userId: { in: testUserIds } } });

  const testTeamNames = [
    `Team INX ${ts}`,
    `Team A ${ts}`,
    `Team B ${ts}`,
    `Team C ${ts}`,
  ];
  const testTeams = await prisma.team.findMany({ where: { name: { in: testTeamNames } }, select: { id: true } });
  const testTeamIds = testTeams.map((t) => t.id);

  await prisma.idea.deleteMany({ where: { teamId: { in: testTeamIds } } });
  await prisma.team.deleteMany({ where: { id: { in: testTeamIds } } });
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });

  const testRoomNames = [
    `Competitor Active Room ${ts}`,
    `Room Alpha ${ts}`,
    `Multi Room A ${ts}`,
    `Multi Room B ${ts}`,
  ];
  await prisma.room.deleteMany({ where: { name: { in: testRoomNames } } });

  // Reset event back to clean DRAFT state
  await prisma.event.update({
    where: { id: 'evt-pnp-production' },
    data: {
      status: EventStatus.DRAFT,
      investmentStartsAt: null,
      investmentEndsAt: null,
    },
  });

  console.log('✓ Successfully purged temporary test entities and restored event to DRAFT');

  console.log('\n============================================================');
  console.log('ALL 8 AUTHORITATIVE SUBMISSION LOCKING SCENARIOS PASSED (100%)');
  console.log('============================================================\n');
}

main()
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
