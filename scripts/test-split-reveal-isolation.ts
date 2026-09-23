import { prisma } from '../lib/prisma';

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

async function main() {
  console.log('================================================================');
  console.log('STARTING AUTOMATED TEST: SPLIT RESULT REVEAL & ROOM ISOLATION');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, cond: boolean, details?: any) {
    if (cond) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`, details ? JSON.stringify(details, null, 2) : '');
      failed++;
    }
  }

  async function loginUser(email: string, password: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new Error(`Login failed for ${email}: ${res.status} ${res.statusText}`);
    }
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) throw new Error(`No cookie received for ${email}`);
    const match = setCookie.match(/pnp_session=([^;]+)/);
    if (!match) throw new Error(`No pnp_session in set-cookie`);
    return `pnp_session=${match[1]}`;
  }

  // 1. Authenticate Admin and Participant
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No ADMIN user in database');

  const adminCookie = await loginUser(admin.email, 'pradesh@2006K');
  assert('Admin login succeeded', Boolean(adminCookie));

  // Find a participant
  const leader = await prisma.user.findFirst({ where: { role: 'TEAM_LEADER' }, include: { team: true } });
  if (!leader) throw new Error('No TEAM_LEADER user in database');

  const leaderCookie = await loginUser(leader.email, 'Demo@2024');
  assert('Leader login succeeded', Boolean(leaderCookie));

  // 2. Setup Test Rooms: Test Room A and Test Room B
  const event = await prisma.event.findFirst();
  const eventId = event?.id;

  const roomA = await prisma.room.create({
    data: {
      name: 'Test Room A (Alpha)',
      code: 'TEST-ALPHA',
      status: 'CLOSED',
      eventId,
      resultsRevealedToAdmins: false,
      resultsRevealedToParticipants: false,
    },
  });

  const roomB = await prisma.room.create({
    data: {
      name: 'Test Room B (Beta)',
      code: 'TEST-BETA',
      status: 'CLOSED',
      eventId,
      resultsRevealedToAdmins: false,
      resultsRevealedToParticipants: false,
    },
  });

  // Assign leader's team to Room A
  const leaderTeam = await prisma.team.findUnique({
    where: { id: leader.teamId! },
    include: { idea: true },
  });
  const originalRoomId = leaderTeam?.roomId;

  await prisma.team.update({
    where: { id: leaderTeam!.id },
    data: { roomId: roomA.id },
  });

  // Create an idea if none
  let idea = leaderTeam?.idea;
  if (!idea) {
    idea = await prisma.idea.create({
      data: {
        teamId: leaderTeam!.id,
        roomId: roomA.id,
        title: 'Alpha Clean Energy Platform',
        anonymousId: 'TEST-IDEA-01',
        track: 'ENERGY',
        categoryTag: 'SUSTAINABLE',
        status: 'APPROVED',
        problemStatement: 'Energy waste',
        solution: 'Smart microgrid',
        innovation: 'Novel algorithm',
        impact: 'Reduces footprint',
        whyInvest: 'High ROI',
        technology: 'TypeScript, Next.js',
      },
    });
  } else {
    await prisma.idea.update({
      where: { id: idea.id },
      data: { roomId: roomA.id, status: 'APPROVED', isLocked: false },
    });
  }

  // Create an investment in Room A
  const inv = await prisma.investment.create({
    data: {
      eventId: eventId || null,
      roomId: roomA.id,
      investorId: admin.id,
      ideaId: idea.id,
      amount: 50,
    },
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Initial State (both CLOSED, unrevealed)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Initial State (CLOSED, unrevealed to anyone) ---');
    const resAInit = await fetch(`${BASE_URL}/api/admin/rooms/${roomA.id}/results`, {
      headers: { Cookie: adminCookie },
    });
    const dataAInit = await resAInit.json();
    assert('Admin results route reports isRevealedToAdmins = false initially', dataAInit.isRevealedToAdmins === false);

    const resPartInit = await fetch(`${BASE_URL}/api/results?roomId=${roomA.id}`, {
      headers: { Cookie: leaderCookie },
    });
    const dataPartInit = await resPartInit.json();
    assert('Participant cannot view results initially (HTTP 403)', resPartInit.status === 403);
    assert('Participant receives RESULTS_NOT_REVEALED code', dataPartInit.code === 'RESULTS_NOT_REVEALED');
    assert('No results returned to participant initially', (!dataPartInit.results || dataPartInit.results.length === 0));

    // -------------------------------------------------------------
    // TEST 2: Action 1 - Reveal Results to Admins for Room A
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Action 1 - [ Reveal Results to Admins ] for Room A ---');
    const resAdminReveal = await fetch(`${BASE_URL}/api/admin/rooms/${roomA.id}/reveal-admin-results`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    const dataAdminReveal = await resAdminReveal.json();
    assert('Admin reveal endpoint returned HTTP 200', resAdminReveal.status === 200);
    assert('resultsRevealedToAdmins is true on room', dataAdminReveal.room?.resultsRevealedToAdmins === true);
    assert('resultsRevealedToParticipants is FALSE on room', dataAdminReveal.room?.resultsRevealedToParticipants === false);
    assert('Room status remains CLOSED (not REVEALED)', dataAdminReveal.room?.status === 'CLOSED');
    assert('Results calculated for Room A', dataAdminReveal.results?.length > 0);

    // Verify Admin can view Room A results
    const resAdminViewA = await fetch(`${BASE_URL}/api/admin/rooms/${roomA.id}/results`, {
      headers: { Cookie: adminCookie },
    });
    const dataAdminViewA = await resAdminViewA.json();
    assert('Admin can view Room A results now', resAdminViewA.status === 200 && dataAdminViewA.results?.length > 0);
    assert('Admin results shows isRevealedToAdmins = true', dataAdminViewA.isRevealedToAdmins === true);
    assert('Admin results shows isRevealedToParticipants = false', dataAdminViewA.isRevealedToParticipants === false);

    // CRITICAL: Verify Participant CANNOT see results yet!
    const resPartUnderReview = await fetch(`${BASE_URL}/api/results?roomId=${roomA.id}`, {
      headers: { Cookie: leaderCookie },
    });
    const dataPartUnderReview = await resPartUnderReview.json();
    assert('Participant still blocked from results (HTTP 403)', resPartUnderReview.status === 403);
    assert('Participant receives RESULTS_UNDER_ADMIN_REVIEW', dataPartUnderReview.code === 'RESULTS_UNDER_ADMIN_REVIEW');
    assert('Participant receives review notification message', dataPartUnderReview.message.includes('reviewed by administrators'));
    assert('No result data exposed to participant', (!dataPartUnderReview.results || dataPartUnderReview.results.length === 0));

    // Also check default /api/results (without roomId query param)
    const resPartDefault = await fetch(`${BASE_URL}/api/results`, {
      headers: { Cookie: leaderCookie },
    });
    const dataPartDefault = await resPartDefault.json();
    assert(
      'Default /api/results returns 403 RESULTS_UNDER_ADMIN_REVIEW for participant',
      resPartDefault.status === 403 && dataPartDefault.code === 'RESULTS_UNDER_ADMIN_REVIEW',
      { status: resPartDefault.status, data: dataPartDefault }
    );

    // -------------------------------------------------------------
    // TEST 3: Room Isolation (Room B must NOT be affected)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Strict Room Isolation (Room A reveal does NOT affect Room B) ---');
    const roomBCheck = await prisma.room.findUnique({ where: { id: roomB.id } });
    assert('Room B resultsRevealedToAdmins remains false', roomBCheck?.resultsRevealedToAdmins === false);
    assert('Room B resultsRevealedToParticipants remains false', roomBCheck?.resultsRevealedToParticipants === false);

    // Participant cannot view Room B results
    const resPartRoomB = await fetch(`${BASE_URL}/api/results?roomId=${roomB.id}`, {
      headers: { Cookie: leaderCookie },
    });
    assert('Participant blocked from cross-room Room B results (HTTP 403)', resPartRoomB.status === 403);

    // -------------------------------------------------------------
    // TEST 4: Action 2 without Action 1 must FAIL (Guard check)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Premature Participant Reveal on Room B must FAIL ---');
    const resPrematureB = await fetch(`${BASE_URL}/api/admin/rooms/${roomB.id}/reveal-participant-results`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    const dataPrematureB = await resPrematureB.json();
    assert('Participant reveal rejected before admin reveal (HTTP 400)', resPrematureB.status === 400);
    assert('Error code is ADMIN_REVEAL_REQUIRED', dataPrematureB.code === 'ADMIN_REVEAL_REQUIRED');

    // -------------------------------------------------------------
    // TEST 5: Action 2 - Reveal Results to Participants for Room A
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Action 2 - [ Reveal Results to Participants ] for Room A ---');
    const resPartReveal = await fetch(`${BASE_URL}/api/admin/rooms/${roomA.id}/reveal-participant-results`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    const dataPartReveal = await resPartReveal.json();
    assert('Participant reveal endpoint returned HTTP 200', resPartReveal.status === 200);
    assert('resultsRevealedToParticipants is now true', dataPartReveal.room?.resultsRevealedToParticipants === true);
    assert('Room status is now REVEALED', dataPartReveal.room?.status === 'REVEALED');

    // Submissions in Room A must be locked
    const ideaCheck = await prisma.idea.findUnique({ where: { id: idea.id } });
    assert('Submissions in revealed room are locked', ideaCheck?.isLocked === true);

    // Participant CAN now view results!
    const resPartSuccess = await fetch(`${BASE_URL}/api/results?roomId=${roomA.id}`, {
      headers: { Cookie: leaderCookie },
    });
    const dataPartSuccess = await resPartSuccess.json();
    assert('Participant can now view results (HTTP 200)', resPartSuccess.status === 200);
    assert('Results returned to participant after public reveal', dataPartSuccess.results?.length > 0);
    assert('First ranked team matches', Boolean(dataPartSuccess.results[0]?.teamName));

    // Room B remains unrevealed and isolated!
    const roomBFinal = await prisma.room.findUnique({ where: { id: roomB.id } });
    assert('Room B remains completely unrevealed', roomBFinal?.resultsRevealedToParticipants === false && roomBFinal?.status === 'CLOSED');

    console.log('\n================================================================');
    console.log(`SPLIT REVEAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

  } finally {
    // Cleanup test artifacts
    await prisma.investment.deleteMany({ where: { roomId: { in: [roomA.id, roomB.id] } } });
    await prisma.result.deleteMany({ where: { roomId: { in: [roomA.id, roomB.id] } } });
    await prisma.team.update({
      where: { id: leaderTeam!.id },
      data: { roomId: originalRoomId || null },
    });
    await prisma.idea.update({
      where: { id: idea.id },
      data: { roomId: originalRoomId || null, isLocked: false },
    });
    await prisma.room.deleteMany({ where: { id: { in: [roomA.id, roomB.id] } } });
    await prisma.$disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
