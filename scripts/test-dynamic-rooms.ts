import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth/password';

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

console.log('============================================================');
console.log('TEST SUITE: DYNAMIC ROOM MANAGEMENT & ROOM-SCOPED INVESTMENT');
console.log(`Target: ${BASE_URL}`);
console.log('============================================================\n');

let passedTests = 0;
let failedTests = 0;

function logResult(title: string, passed: boolean, details: string[] = []) {
  if (passed) {
    console.log(`  [✅ PASS] ${title}`);
    details.forEach((d) => console.log(`            ${d}`));
    passedTests++;
  } else {
    console.log(`  [❌ FAIL] ${title}`);
    details.forEach((d) => console.log(`            ${d}`));
    failedTests++;
  }
}

async function loginUser(email: string, passwordPlain: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwordPlain }),
  });
  const data = await res.json();
  const cookieHeader = res.headers.get('set-cookie') || '';
  const match = cookieHeader.match(/pnp_session=([^;]+)/);
  const cookie = match ? `pnp_session=${match[1]}` : '';
  return { status: res.status, data, cookie };
}

async function runRoomTests() {
  const adminEmail = 'pradeshkannan64@gmail.com';
  const adminPass = 'pradesh@2006K';
  const ecoPulseEmail = 'kavya.ecopulse@student.tce.edu';
  const mediBridgeEmail = 'rohan.medibridge@student.tce.edu';
  const transitIqEmail = 'harish.transitiq@student.tce.edu';
  const defaultPass = 'Demo@2024';

  // Ensure passwords and roles
  await prisma.user.updateMany({
    where: { email: adminEmail },
    data: { passwordHash: hashPassword(adminPass), isActive: true, role: 'ADMIN' },
  });
  await prisma.user.updateMany({
    where: { email: { in: [ecoPulseEmail, mediBridgeEmail, transitIqEmail] } },
    data: { passwordHash: hashPassword(defaultPass), isActive: true },
  });

  // 1. Authenticate Admin
  const adminLogin = await loginUser(adminEmail, adminPass);
  logResult('Step 1: Admin Login', adminLogin.status === 200, [
    `Admin Cookie: ${adminLogin.cookie ? 'Acquired' : 'Missing'}`,
  ]);
  const adminHeaders = {
    'Content-Type': 'application/json',
    Cookie: adminLogin.cookie,
  };

  // Set event to DRAFT for clean setup
  await fetch(`${BASE_URL}/api/admin/event/status`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'DRAFT', force: true }),
  });

  // 2. Create or Retrieve Dynamic Rooms
  let roomAlphaId = '';
  let roomBetaId = '';

  const getRoomsRes = await fetch(`${BASE_URL}/api/admin/rooms`, { headers: adminHeaders });
  const getRoomsData = await getRoomsRes.json();
  let existingAlpha = getRoomsData.rooms?.find((r: any) => r.code === 'ROOM-ALPHA');
  let existingBeta = getRoomsData.rooms?.find((r: any) => r.code === 'ROOM-BETA');

  if (!existingAlpha) {
    const resA = await fetch(`${BASE_URL}/api/admin/rooms`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Room Alpha',
        code: 'ROOM-ALPHA',
        description: 'Physical Arena 1 - CSE Main Lab',
      }),
    });
    const dataA = await resA.json();
    roomAlphaId = dataA.room?.id;
    logResult('Step 2A: Create Room Alpha', resA.ok && Boolean(roomAlphaId), [
      `Room Alpha ID: ${roomAlphaId}`,
    ]);
  } else {
    roomAlphaId = existingAlpha.id;
    // Reset status to DRAFT
    await prisma.room.update({ where: { id: roomAlphaId }, data: { status: 'DRAFT' } });
    logResult('Step 2A: Room Alpha Exists (Reset to DRAFT)', true, [`Room Alpha ID: ${roomAlphaId}`]);
  }

  if (!existingBeta) {
    const resB = await fetch(`${BASE_URL}/api/admin/rooms`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Room Beta',
        code: 'ROOM-BETA',
        description: 'Physical Arena 2 - Seminar Hall',
      }),
    });
    const dataB = await resB.json();
    roomBetaId = dataB.room?.id;
    logResult('Step 2B: Create Room Beta', resB.ok && Boolean(roomBetaId), [
      `Room Beta ID: ${roomBetaId}`,
    ]);
  } else {
    roomBetaId = existingBeta.id;
    // Reset status to DRAFT
    await prisma.room.update({ where: { id: roomBetaId }, data: { status: 'DRAFT' } });
    logResult('Step 2B: Room Beta Exists (Reset to DRAFT)', true, [`Room Beta ID: ${roomBetaId}`]);
  }

  // 3. Team Assignment
  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  const ecoPulseTeam = teams.find((t) => t.name === 'EcoPulse');
  const transitIqTeam = teams.find((t) => t.name === 'TransitIQ');
  const mediBridgeTeam = teams.find((t) => t.name === 'MediBridge');
  const abcTeam = teams.find((t) => t.name === 'ABC');

  // 3A: Single team assignment to Room Alpha
  if (ecoPulseTeam) {
    const assignRes = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ teamId: ecoPulseTeam.id, roomId: roomAlphaId }),
    });
    const assignData = await assignRes.json();
    logResult('Step 3A: Single Team Assignment (EcoPulse -> Room Alpha)', assignRes.status === 200 && assignData.success);
  }

  if (transitIqTeam) {
    const assignRes = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ teamId: transitIqTeam.id, roomId: roomAlphaId }),
    });
    const assignData = await assignRes.json();
    logResult('Step 3B: Single Team Assignment (TransitIQ -> Room Alpha)', assignRes.status === 200 && assignData.success);
  }

  // 3C: Batch team assignment to Room Beta
  const betaTeamIds: string[] = [];
  if (mediBridgeTeam) betaTeamIds.push(mediBridgeTeam.id);
  if (abcTeam) betaTeamIds.push(abcTeam.id);

  if (betaTeamIds.length > 0) {
    const batchAssignRes = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ roomId: roomBetaId, teamIds: betaTeamIds }),
    });
    const batchData = await batchAssignRes.json();
    logResult('Step 3C: Batch Team Assignment ([MediBridge, ABC] -> Room Beta)', batchAssignRes.status === 200 && batchData.success, [
      `Assigned Count: ${batchData.count || betaTeamIds.length}`,
    ]);
  }

  // 4. Session Derivation & Room Propagation Verification
  const ecoPulseLogin = await loginUser(ecoPulseEmail, defaultPass);
  const ecoPulseMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: ecoPulseLogin.cookie },
  });
  const ecoPulseMe = await ecoPulseMeRes.json();

  const mediBridgeLogin = await loginUser(mediBridgeEmail, defaultPass);
  const mediBridgeMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: mediBridgeLogin.cookie },
  });
  const mediBridgeMe = await mediBridgeMeRes.json();

  logResult(
    'Step 4A: EcoPulse Participant Room Derivation',
    ecoPulseMe.user?.roomId === roomAlphaId && ecoPulseMe.user?.roomName === 'Room Alpha',
    [
      `User: ${ecoPulseMe.user?.name}`,
      `Derives Room ID: ${ecoPulseMe.user?.roomId}`,
      `Room Name: ${ecoPulseMe.user?.roomName}`,
      `Room Code: ${ecoPulseMe.user?.roomCode}`,
    ]
  );

  logResult(
    'Step 4B: MediBridge Participant Room Derivation',
    mediBridgeMe.user?.roomId === roomBetaId && mediBridgeMe.user?.roomName === 'Room Beta',
    [
      `User: ${mediBridgeMe.user?.name}`,
      `Derives Room ID: ${mediBridgeMe.user?.roomId}`,
      `Room Name: ${mediBridgeMe.user?.roomName}`,
      `Room Code: ${mediBridgeMe.user?.roomCode}`,
    ]
  );

  // 5. Test Room-Scoped Team Roster API (/api/teams/mine)
  const teamMineRes = await fetch(`${BASE_URL}/api/teams/mine`, {
    headers: { Cookie: ecoPulseLogin.cookie },
  });
  const teamMineData = await teamMineRes.json();
  const seesTeamsInRoom = teamMineData.teamsInRoom && Array.isArray(teamMineData.teamsInRoom);
  const correctRoomTeams = seesTeamsInRoom && teamMineData.teamsInRoom.every((t: any) => t.id !== ecoPulseTeam?.id);
  const noLeakedIdeas = seesTeamsInRoom && teamMineData.teamsInRoom.every((t: any) => !t.ideaAnonymousId && !t.ideaTitle);

  logResult(
    'Step 5: Teams In My Room Roster (Without Leaking Anonymous Ideas)',
    seesTeamsInRoom && noLeakedIdeas,
    [
      `Assigned Room: ${teamMineData.room?.name} (${teamMineData.room?.code})`,
      `Teams In Room Count: ${teamMineData.teamsInRoom?.length}`,
      `No Anonymity Leaks: ${noLeakedIdeas}`,
    ]
  );

  // 6. Independent Room Lifecycle: Start Room Alpha
  const startAlphaRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlphaId}/start`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const startAlphaData = await startAlphaRes.json();
  logResult(
    'Step 6: Independent Room Start (Room Alpha -> OPEN)',
    startAlphaRes.status === 200 && startAlphaData.room?.status === 'OPEN',
    [`Room Alpha Status: ${startAlphaData.room?.status}`]
  );

  // Room Beta is still DRAFT
  const roomBetaCheck = await prisma.room.findUnique({ where: { id: roomBetaId } });
  logResult(
    'Step 6B: Independent Coexistence (Room Beta remains DRAFT)',
    roomBetaCheck?.status === 'DRAFT',
    [`Room Beta Status: ${roomBetaCheck?.status}`]
  );

  // 7. Test Assignment Lock while Room is OPEN
  if (ecoPulseTeam) {
    const lockRes = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ teamId: ecoPulseTeam.id, roomId: roomBetaId }),
    });
    const lockData = await lockRes.json();
    logResult(
      'Step 7: Room Assignment Lock Enforcement',
      lockRes.status === 403 && (lockData.code === 'ROOM_ASSIGNMENTS_LOCKED' || lockData.code === 'ROOM_ASSIGNMENT_LOCKED'),
      [`HTTP Status: ${lockRes.status}`, `Code: ${lockData.code}`, `Message: ${lockData.message}`]
    );
  }

  // 8. Arena Isolation: Query Ideas
  const ecoPulseIdeasRes = await fetch(`${BASE_URL}/api/ideas`, {
    headers: { Cookie: ecoPulseLogin.cookie },
  });
  const ecoPulseIdeasData = await ecoPulseIdeasRes.json();
  const ecoPulseIdeas = ecoPulseIdeasData.ideas || [];

  const seesOnlyRoomAlpha = ecoPulseIdeas.every((i: any) => i.roomId === roomAlphaId);
  const doesNotSeeOwnIdea = !ecoPulseIdeas.some((i: any) => i.title?.includes('EcoPulse'));
  const doesNotSeeRoomBeta = !ecoPulseIdeas.some(
    (i: any) => i.title?.includes('MediBridge') || i.title?.includes('ABC')
  );

  logResult(
    'Step 8: Arena Query Isolation (EcoPulse only sees Room Alpha opponent ideas)',
    seesOnlyRoomAlpha && doesNotSeeOwnIdea && doesNotSeeRoomBeta,
    [
      `Ideas Count for EcoPulse: ${ecoPulseIdeas.length}`,
      `All ideas in Room Alpha: ${seesOnlyRoomAlpha}`,
      `Own idea excluded: ${doesNotSeeOwnIdea}`,
      `Room Beta ideas excluded: ${doesNotSeeRoomBeta}`,
    ]
  );

  // 9. Cross-Room Investment Protection
  const mediBridgeIdea = await prisma.idea.findFirst({
    where: { team: { name: 'MediBridge' } },
  });

  if (mediBridgeIdea) {
    const crossInvRes = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ecoPulseLogin.cookie,
      },
      body: JSON.stringify({
        ideaId: mediBridgeIdea.id,
        amount: 20,
      }),
    });
    const crossInvData = await crossInvRes.json();
    logResult(
      'Step 9: Cross-Room Investment Rejection (EcoPulse cannot invest in MediBridge)',
      crossInvRes.status === 403 && crossInvData.code === 'CROSS_ROOM_INVESTMENT_FORBIDDEN',
      [
        `HTTP Status: ${crossInvRes.status}`,
        `Code: ${crossInvData.code}`,
        `Message: ${crossInvData.message}`,
      ]
    );
  }

  // 10. Pause & Resume Room Alpha
  const pauseAlphaRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlphaId}/pause`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const pauseAlphaData = await pauseAlphaRes.json();
  logResult(
    'Step 10A: Independent Room Pause (Room Alpha -> PAUSED)',
    pauseAlphaRes.status === 200 && pauseAlphaData.room?.status === 'PAUSED',
    [`Room Alpha Status: ${pauseAlphaData.room?.status}`]
  );

  // Test investment blocked while room is PAUSED
  const transitIqIdea = await prisma.idea.findFirst({
    where: { team: { name: 'TransitIQ' } },
  });

  if (transitIqIdea) {
    const pausedInvRes = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ecoPulseLogin.cookie,
      },
      body: JSON.stringify({
        ideaId: transitIqIdea.id,
        amount: 20,
      }),
    });
    const pausedInvData = await pausedInvRes.json();
    logResult(
      'Step 10B: Investment Blocked While Room is PAUSED',
      (pausedInvRes.status === 400 || pausedInvRes.status === 403) &&
        (pausedInvData.code === 'ROOM_PAUSED' || pausedInvData.code === 'ARENA_PAUSED'),
      [`HTTP Status: ${pausedInvRes.status}`, `Code: ${pausedInvData.code}`]
    );
  }

  // Resume Room Alpha
  const resumeAlphaRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlphaId}/resume`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const resumeAlphaData = await resumeAlphaRes.json();
  logResult(
    'Step 10C: Independent Room Resume (Room Alpha -> OPEN)',
    resumeAlphaRes.status === 200 && resumeAlphaData.room?.status === 'OPEN',
    [`Room Alpha Status: ${resumeAlphaData.room?.status}`]
  );

  // 11. Legitimate Same-Room Investment
  const ecoPulseUser = await prisma.user.findUnique({
    where: { email: ecoPulseEmail },
    include: { wallet: true },
  });
  if (ecoPulseUser?.wallet) {
    await prisma.wallet.update({
      where: { id: ecoPulseUser.wallet.id },
      data: { availableCoins: 100, investedCoins: 0, totalCoins: 100 },
    });
  }

  if (transitIqIdea) {
    const sameRoomInvRes = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ecoPulseLogin.cookie,
      },
      body: JSON.stringify({
        ideaId: transitIqIdea.id,
        amount: 20,
      }),
    });
    const sameRoomInvData = await sameRoomInvRes.json();
    logResult(
      'Step 11: Legitimate Same-Room Investment (EcoPulse -> TransitIQ in Room Alpha)',
      sameRoomInvRes.status === 200 && sameRoomInvData.success,
      [
        `HTTP Status: ${sameRoomInvRes.status}`,
        `Success: ${sameRoomInvData.success}`,
        `Remaining Wallet: ${sameRoomInvData.wallet?.remaining}`,
      ]
    );
  }

  // 12. Close Room Alpha
  const closeAlphaRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlphaId}/close`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const closeAlphaData = await closeAlphaRes.json();
  logResult(
    'Step 12: Independent Room Close (Room Alpha -> CLOSED)',
    closeAlphaRes.status === 200 && closeAlphaData.room?.status === 'CLOSED',
    [`Room Alpha Status: ${closeAlphaData.room?.status}`]
  );

  // 13. Reveal Room Alpha
  const revealAlphaRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlphaId}/reveal`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const revealAlphaData = await revealAlphaRes.json();
  logResult(
    'Step 13: Independent Room Reveal (Room Alpha -> REVEALED)',
    revealAlphaRes.status === 200 && revealAlphaData.room?.status === 'REVEALED',
    [
      `Room Alpha Status: ${revealAlphaData.room?.status}`,
      `Results Count: ${revealAlphaData.results?.length}`,
    ]
  );

  // 14. Room Results API & Participant Results Isolation
  const participantResultsRes = await fetch(`${BASE_URL}/api/results`, {
    headers: { Cookie: ecoPulseLogin.cookie },
  });
  const participantResultsData = await participantResultsRes.json();
  const participantResults = participantResultsData.results || [];
  const onlyRoomAlphaInResults =
    participantResults.length > 0 &&
    participantResults.every((r: any) => r.roomId === roomAlphaId);

  logResult(
    'Step 14A: Participant Results Isolation (EcoPulse only sees Room Alpha rankings)',
    participantResultsRes.status === 200 && onlyRoomAlphaInResults,
    [
      `Results Count: ${participantResults.length}`,
      `Assigned Room: ${participantResultsData.room?.name}`,
      `All results strictly in Room Alpha: ${onlyRoomAlphaInResults}`,
    ]
  );

  // Unrevealed Room Isolation: MediBridge in Room Beta (which is still DRAFT) should NOT see results
  const mediBridgeResultsRes = await fetch(`${BASE_URL}/api/results`, {
    headers: { Cookie: mediBridgeLogin.cookie },
  });
  logResult(
    'Step 14B: Unrevealed Room Security (MediBridge in Room Beta blocked from unrevealed results)',
    mediBridgeResultsRes.status === 403,
    [`HTTP Status: ${mediBridgeResultsRes.status}`]
  );

  // 15. Room Detail & Dedicated Results APIs
  const roomDetailRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlphaId}`, {
    headers: adminHeaders,
  });
  const roomDetailData = await roomDetailRes.json();
  logResult(
    'Step 15A: Admin Room Detail API (Metrics, Teams, Ideas, Results)',
    roomDetailRes.status === 200 && Boolean(roomDetailData.room?.stats),
    [
      `Room Name: ${roomDetailData.room?.name}`,
      `Status: ${roomDetailData.room?.status}`,
      `Teams Count: ${roomDetailData.room?.teams?.length}`,
      `Total Coins Volume: ${roomDetailData.room?.stats?.totalCoins}`,
    ]
  );

  const roomResultsRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlphaId}/results`, {
    headers: adminHeaders,
  });
  const roomResultsData = await roomResultsRes.json();
  logResult(
    'Step 15B: Dedicated Room Results API',
    roomResultsRes.status === 200 && roomResultsData.success && roomResultsData.results?.length > 0,
    [
      `Results Length: ${roomResultsData.results?.length}`,
      `Top Rank: #${roomResultsData.results?.[0]?.rank} - ${roomResultsData.results?.[0]?.teamName}`,
    ]
  );

  // 16. Safe Deletion Guards
  const deleteLockedRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlphaId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  const deleteLockedData = await deleteLockedRes.json();
  logResult(
    'Step 16A: Tournament Phase Deletion Lock (Cannot delete revealed room)',
    deleteLockedRes.status === 403 && deleteLockedData.code === 'ROOM_DELETE_LOCKED',
    [`HTTP Status: ${deleteLockedRes.status}`, `Code: ${deleteLockedData.code}`]
  );

  // Create an empty temporary room in DRAFT and verify clean deletion
  const createTempRes = await fetch(`${BASE_URL}/api/admin/rooms`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Temp Room',
      code: 'ROOM-TEMP',
      description: 'Temporary empty room for deletion testing',
    }),
  });
  const createTempData = await createTempRes.json();
  const tempRoomId = createTempData.room?.id;

  if (tempRoomId) {
    const deleteEmptyRes = await fetch(`${BASE_URL}/api/admin/rooms/${tempRoomId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    const deleteEmptyData = await deleteEmptyRes.json();
    logResult(
      'Step 16B: Clean Deletion of Empty Room in DRAFT',
      deleteEmptyRes.status === 200 && deleteEmptyData.success,
      [`HTTP Status: ${deleteEmptyRes.status}`, `Message: ${deleteEmptyData.message}`]
    );
  }

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runRoomTests()
  .catch((err) => {
    console.error('Fatal error running room tests:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
