import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth/password';

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

console.log('============================================================');
console.log('TEST SUITE: ASSIGNABLE TEAMS DIRECTORY & ROOM ASSIGNMENT FIX');
console.log(`Target: ${BASE_URL}`);
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function logResult(title: string, ok: boolean, details: string[] = []) {
  if (ok) {
    console.log(`  [✅ PASS] ${title}`);
    details.forEach((d) => console.log(`            ${d}`));
    passed++;
  } else {
    console.log(`  [❌ FAIL] ${title}`);
    details.forEach((d) => console.log(`            ${d}`));
    failed++;
  }
}

async function loginAdmin() {
  const adminEmail = 'pradeshkannan64@gmail.com';
  const adminPass = 'pradesh@2006K';

  await prisma.user.updateMany({
    where: { email: adminEmail },
    data: { passwordHash: hashPassword(adminPass), isActive: true, role: 'ADMIN' },
  });

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPass }),
  });
  const cookieHeader = res.headers.get('set-cookie') || '';
  const match = cookieHeader.match(/pnp_session=([^;]+)/);
  return match ? `pnp_session=${match[1]}` : '';
}

async function run() {
  const adminCookie = await loginAdmin();
  const headers = {
    'Content-Type': 'application/json',
    Cookie: adminCookie,
  };

  logResult('Step 1: Admin Authentication', Boolean(adminCookie), [
    `Cookie acquired: ${Boolean(adminCookie)}`,
  ]);

  // Find or create room "Pitch" (ROOM A) as reported on user screen
  let pitchRoom = await prisma.room.findFirst({
    where: { code: 'ROOM A' },
  });

  if (!pitchRoom) {
    pitchRoom = await prisma.room.create({
      data: {
        name: 'Pitch',
        code: 'ROOM A',
        status: 'DRAFT',
        description: 'Main presentation room',
      },
    });
  } else {
    // Reset to DRAFT for clean testing
    await prisma.room.update({
      where: { id: pitchRoom.id },
      data: { status: 'DRAFT' },
    });
  }

  logResult('Step 2: Room "Pitch" (ROOM A) Ready in DRAFT', Boolean(pitchRoom), [
    `Room ID: ${pitchRoom.id}`,
    `Status: ${pitchRoom.status}`,
  ]);

  // Step 3: GET /api/admin/rooms - Verify ALL rooms are returned
  const roomsRes = await fetch(`${BASE_URL}/api/admin/rooms`, { headers });
  const roomsData = await roomsRes.json();
  const allRooms = roomsData.rooms || [];
  const pitchInList = allRooms.some((r: any) => r.id === pitchRoom?.id);

  logResult('Step 3: All Rooms Retrieved (No eventId masking)', roomsRes.status === 200 && pitchInList, [
    `Total Rooms in API: ${allRooms.length}`,
    `Pitch Room Visible: ${pitchInList}`,
    `Room Codes: ${allRooms.map((r: any) => r.code).join(', ')}`,
  ]);

  // Step 4: GET /api/admin/rooms/[id]/assignable-teams
  // THIS WAS THE CRITICAL USER BUG: When admin clicks Manage Teams, ALL existing teams MUST appear!
  const assignableRes = await fetch(`${BASE_URL}/api/admin/rooms/${pitchRoom.id}/assignable-teams`, { headers });
  const assignableData = await assignableRes.json();
  const teams = assignableData.teams || [];

  logResult(
    'Step 4: Assignable Teams Directory Returns Real DB Teams (Fix for 0 Teams Bug)',
    assignableRes.status === 200 && teams.length >= 4,
    [
      `Total Teams Found: ${teams.length}`,
      `Counts: Total=${assignableData.counts?.total}, AssignedThisRoom=${assignableData.counts?.assignedThisRoom}, Unassigned=${assignableData.counts?.unassigned}, AssignedOther=${assignableData.counts?.assignedOther}`,
      `Team Names: ${teams.map((t: any) => `${t.name} (${t.teamId}: ${t.assignmentStatus})`).join(' | ')}`,
    ]
  );

  // Step 5: Test Search Functionality against Real DB Data (Part 4)
  // Search by team name
  const searchNameRes = await fetch(
    `${BASE_URL}/api/admin/rooms/${pitchRoom.id}/assignable-teams?search=Pulse`,
    { headers }
  );
  const searchNameData = await searchNameRes.json();
  const foundPulse = searchNameData.teams?.some((t: any) => t.name === 'EcoPulse');

  // Search by team ID
  const searchIdRes = await fetch(
    `${BASE_URL}/api/admin/rooms/${pitchRoom.id}/assignable-teams?search=CSEA-067`,
    { headers }
  );
  const searchIdData = await searchIdRes.json();
  const foundABC = searchIdData.teams?.some((t: any) => t.name === 'ABC' && t.teamId === 'CSEA-067');

  // Search by team leader email
  const searchLeaderRes = await fetch(
    `${BASE_URL}/api/admin/rooms/${pitchRoom.id}/assignable-teams?search=rohan`,
    { headers }
  );
  const searchLeaderData = await searchLeaderRes.json();
  const foundMediBridge = searchLeaderData.teams?.some((t: any) => t.name === 'MediBridge');

  logResult(
    'Step 5: Search Across Name, Team ID, and Leader Email',
    foundPulse && foundABC && foundMediBridge,
    [
      `Search "Pulse" -> Found EcoPulse: ${foundPulse}`,
      `Search "CSEA-067" -> Found ABC: ${foundABC}`,
      `Search "rohan" -> Found MediBridge: ${foundMediBridge}`,
    ]
  );

  // Step 6: Assign / Move Team to Pitch Room (Part 8 & 9)
  const targetTeam = teams[0];
  const assignRes = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      roomId: pitchRoom.id,
      teamIds: [targetTeam.id],
    }),
  });
  const assignData = await assignRes.json();

  logResult('Step 6: Move / Assign Team to Pitch (ROOM A)', assignRes.status === 200 && assignData.success, [
    `Assigned Team: ${targetTeam.name}`,
    `Assigned Count: ${assignData.assignedCount}`,
    `Message: ${assignData.message}`,
  ]);

  // Step 7: Verify Room Stats Update Immediately (Part 8)
  const verifyRoomRes = await fetch(`${BASE_URL}/api/admin/rooms`, { headers });
  const verifyRoomData = await verifyRoomRes.json();
  const updatedPitch = verifyRoomData.rooms?.find((r: any) => r.id === pitchRoom?.id);

  logResult(
    'Step 7: Room Card Reflects New Team & User Count Immediately',
    updatedPitch?.teamCount >= 1 && updatedPitch?.participantCount >= 1,
    [
      `Pitch Team Count: ${updatedPitch?.teamCount}`,
      `Pitch Participant Count: ${updatedPitch?.participantCount}`,
      `Pitch Assigned Teams: ${updatedPitch?.teams?.map((t: any) => t.name).join(', ')}`,
    ]
  );

  // Step 8: Assignable Teams Directory Reflects Assignment Status
  const recheckAssignableRes = await fetch(
    `${BASE_URL}/api/admin/rooms/${pitchRoom.id}/assignable-teams`,
    { headers }
  );
  const recheckData = await recheckAssignableRes.json();
  const assignedTeamInPitch = recheckData.teams?.find((t: any) => t.id === targetTeam.id);

  logResult(
    'Step 8: Team Directory Reflects "ASSIGNED_THIS_ROOM"',
    assignedTeamInPitch?.assignmentStatus === 'ASSIGNED_THIS_ROOM',
    [
      `Team: ${assignedTeamInPitch?.name}`,
      `Status in Pitch: ${assignedTeamInPitch?.assignmentStatus}`,
      `Room Name: ${assignedTeamInPitch?.roomName}`,
    ]
  );

  // Step 9: Lifecycle Controls: Start Room
  const startRes = await fetch(`${BASE_URL}/api/admin/rooms/${pitchRoom.id}/start`, {
    method: 'POST',
    headers,
  });
  const startData = await startRes.json();

  logResult('Step 9: START ARENA (DRAFT -> OPEN)', startRes.status === 200 && startData.room?.status === 'OPEN', [
    `Pitch Status: ${startData.room?.status}`,
  ]);

  // Step 10: Assignment Lock While OPEN (Part 10)
  const lockedAssignRes = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      roomId: pitchRoom.id,
      teamIds: [targetTeam.id, teams[1]?.id].filter(Boolean),
    }),
  });
  const lockedData = await lockedAssignRes.json();

  logResult(
    'Step 10: Room Assignment Lock Enforced While Room is OPEN',
    lockedAssignRes.status === 403 && lockedData.code === 'ROOM_ASSIGNMENTS_LOCKED',
    [
      `HTTP Status: ${lockedAssignRes.status}`,
      `Code: ${lockedData.code}`,
      `Message: ${lockedData.message}`,
    ]
  );

  // Step 11: PAUSE ARENA
  const pauseRes = await fetch(`${BASE_URL}/api/admin/rooms/${pitchRoom.id}/pause`, {
    method: 'POST',
    headers,
  });
  const pauseData = await pauseRes.json();
  logResult('Step 11: PAUSE ARENA (OPEN -> PAUSED)', pauseRes.status === 200 && pauseData.room?.status === 'PAUSED', [
    `Pitch Status: ${pauseData.room?.status}`,
  ]);

  // Step 12: RESUME ARENA
  const resumeRes = await fetch(`${BASE_URL}/api/admin/rooms/${pitchRoom.id}/resume`, {
    method: 'POST',
    headers,
  });
  const resumeData = await resumeRes.json();
  logResult('Step 12: RESUME ARENA (PAUSED -> OPEN)', resumeRes.status === 200 && resumeData.room?.status === 'OPEN', [
    `Pitch Status: ${resumeData.room?.status}`,
  ]);

  // Step 13: CLOSE ARENA
  const closeRes = await fetch(`${BASE_URL}/api/admin/rooms/${pitchRoom.id}/close`, {
    method: 'POST',
    headers,
  });
  const closeData = await closeRes.json();
  logResult('Step 13: CLOSE ARENA (OPEN -> CLOSED)', closeRes.status === 200 && closeData.room?.status === 'CLOSED', [
    `Pitch Status: ${closeData.room?.status}`,
  ]);

  // Step 14: REVEAL WINNERS
  const revealRes = await fetch(`${BASE_URL}/api/admin/rooms/${pitchRoom.id}/reveal`, {
    method: 'POST',
    headers,
  });
  const revealData = await revealRes.json();
  logResult(
    'Step 14: REVEAL WINNERS (CLOSED -> REVEALED)',
    revealRes.status === 200 && revealData.room?.status === 'REVEALED',
    [
      `Pitch Status: ${revealData.room?.status}`,
      `Results Count: ${revealData.results?.length}`,
    ]
  );

  console.log('\n============================================================');
  console.log(`E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

run()
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
