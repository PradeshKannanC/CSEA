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
  console.log('========================================================================');
  console.log('STARTING MULTI-ADMIN SYNCHRONIZATION, CONCURRENCY & HARDENING TEST SUITE');
  console.log('========================================================================');

  const ts = Date.now();
  const passwordHash = hashPassword('password123');

  // Setup Admin A and Admin B
  const adminAEmail = `admin_a_${ts}@csea.edu`;
  await prisma.user.create({
    data: {
      name: 'Admin A',
      email: adminAEmail,
      passwordHash,
      role: UserRole.ADMIN,
      avatarInitials: 'AA',
      isActive: true,
      emailVerified: true,
    },
  });
  const adminACookie = await loginUser(adminAEmail);

  const adminBEmail = `admin_b_${ts}@csea.edu`;
  await prisma.user.create({
    data: {
      name: 'Admin B',
      email: adminBEmail,
      passwordHash,
      role: UserRole.ADMIN,
      avatarInitials: 'AB',
      isActive: true,
      emailVerified: true,
    },
  });
  const adminBCookie = await loginUser(adminBEmail);
  record('SETUP_TWO_ADMINS', Boolean(adminACookie && adminBCookie), `Admin A and Admin B logged in`);

  // Ensure active Event
  let event = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        name: `Concurrency Event ${ts}`,
        totalCoins: 200,
        minInvestment: 20,
        maxInvestment: 100,
        status: 'OPEN',
        version: 1,
      },
    });
  }

  // -------------------------------------------------------------------------
  // TEST 1: Optimistic Concurrency Control on Event Settings
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: Optimistic Concurrency Control on Event Settings ---');
  // Both Admins fetch settings at version V
  const getSettingsRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const settingsData = await getSettingsRes.json();
  const currentVersion = settingsData.settings.settingsVersion;

  // Admin A saves settings with currentVersion -> succeeds, increments to currentVersion + 1
  const updateARes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${adminACookie}`,
    },
    body: JSON.stringify({
      totalCoins: 250,
      minInvestment: 25,
      maxInvestment: 125,
      settingsVersion: currentVersion,
    }),
  });
  const updateAData = await updateARes.json();
  record(
    'ADMIN_A_UPDATE_SUCCESS',
    updateARes.ok && updateAData.settings.settingsVersion === currentVersion + 1,
    `Admin A updated settings: new version = ${updateAData.settings?.settingsVersion}`
  );

  // Admin B attempts to save using stale currentVersion -> must be REJECTED with 409 SETTINGS_VERSION_CONFLICT
  const updateBRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pnp_session=${adminBCookie}`,
    },
    body: JSON.stringify({
      totalCoins: 280,
      minInvestment: 28,
      maxInvestment: 140,
      settingsVersion: currentVersion, // Stale version!
    }),
  });
  const updateBData = await updateBRes.json();
  const isConflictRejected =
    updateBRes.status === 409 && updateBData.code === 'SETTINGS_VERSION_CONFLICT';
  record(
    'ADMIN_B_STALE_UPDATE_REJECTED',
    isConflictRejected,
    `Status ${updateBRes.status} code="${updateBData.code}" message="${updateBData.message}"`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Concurrent Room Starts
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Concurrent Room Starts ---');
  // Create Room Gamma with 2 teams & approved ideas
  const roomGamma = await prisma.room.create({
    data: {
      name: `Room Gamma ${ts}`,
      code: `RG-${ts.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
      initialCoins: 150,
      minInvestment: 15,
      maxInvestment: 75,
      version: 1,
    },
  });

  const defaultIdeaFields = {
    categoryTag: 'AI',
    problemStatement: 'Problem',
    solution: 'Solution',
    innovation: 'Innovation',
    impact: 'Impact',
    whyInvest: 'Why invest',
    technology: 'Tech',
  };

  const teamG1 = await prisma.team.create({
    data: { teamId: `TEAM-G1-${ts}`, name: `Gamma Team 1 ${ts}`, submissionId: `PNP-G1-${ts}`, roomId: roomGamma.id },
  });
  await prisma.idea.create({
    data: { anonymousId: `IDEA-G1-${ts}`, teamId: teamG1.id, roomId: roomGamma.id, title: `Idea G1 ${ts}`, status: 'APPROVED', track: 'TRACK', ...defaultIdeaFields },
  });

  const teamG2 = await prisma.team.create({
    data: { teamId: `TEAM-G2-${ts}`, name: `Gamma Team 2 ${ts}`, submissionId: `PNP-G2-${ts}`, roomId: roomGamma.id },
  });
  await prisma.idea.create({
    data: { anonymousId: `IDEA-G2-${ts}`, teamId: teamG2.id, roomId: roomGamma.id, title: `Idea G2 ${ts}`, status: 'APPROVED', track: 'TRACK', ...defaultIdeaFields },
  });

  // Execute two concurrent start requests in parallel
  const [start1, start2] = await Promise.all([
    fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    }).then(async (r) => ({ status: r.status, data: await r.json() })),
    fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminBCookie}` },
    }).then(async (r) => ({ status: r.status, data: await r.json() })),
  ]);

  console.log('start1 result:', JSON.stringify(start1));
  console.log('start2 result:', JSON.stringify(start2));

  const successCount = [start1, start2].filter((s) => s.status === 200).length;
  const conflictCount = [start1, start2].filter(
    (s) => s.status === 409 && s.data.code === 'ROOM_STATE_CHANGED'
  ).length;

  record(
    'CONCURRENT_START_HANDLED_SAFELY',
    successCount === 1 && conflictCount === 1,
    `1 request succeeded (HTTP 200), 1 request rejected with HTTP 409 ROOM_STATE_CHANGED (exact code match)`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Safe Room Deletion
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Safe Room Deletion Invariants ---');
  // Case A: Room in OPEN state
  const deleteOpenRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}`, {
    method: 'DELETE',
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const deleteOpenData = await deleteOpenRes.json();
  record(
    'REJECT_DELETE_OPEN_ROOM',
    deleteOpenRes.status === 409 && deleteOpenData.code === 'ROOM_ACTIVE_CANNOT_DELETE',
    `Status ${deleteOpenRes.status} code="${deleteOpenData.code}" message="${deleteOpenData.message}"`
  );

  // Pause Room Gamma -> Room in PAUSED state
  await prisma.room.update({ where: { id: roomGamma.id }, data: { status: 'PAUSED' } });
  const deletePausedRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}`, {
    method: 'DELETE',
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const deletePausedData = await deletePausedRes.json();
  record(
    'REJECT_DELETE_PAUSED_ROOM',
    deletePausedRes.status === 409 && deletePausedData.code === 'ROOM_ACTIVE_CANNOT_DELETE',
    `Status ${deletePausedRes.status} code="${deletePausedData.code}" message="${deletePausedData.message}"`
  );

  // Case B: Room in DRAFT state but has teams assigned
  const roomZeta = await prisma.room.create({
    data: {
      name: `Room Zeta with Teams ${ts}`,
      code: `RZ-${ts.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
    },
  });
  const teamZ = await prisma.team.create({
    data: { teamId: `TEAM-Z-${ts}`, name: `Zeta Team ${ts}`, submissionId: `PNP-Z-${ts}`, roomId: roomZeta.id },
  });

  const deleteWithTeamsRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomZeta.id}`, {
    method: 'DELETE',
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const deleteWithTeamsData = await deleteWithTeamsRes.json();
  record(
    'REJECT_DELETE_ROOM_WITH_TEAMS',
    deleteWithTeamsRes.status === 409 && deleteWithTeamsData.code === 'ROOM_HAS_HISTORICAL_DATA',
    `Status ${deleteWithTeamsRes.status} code="${deleteWithTeamsData.code}" message="${deleteWithTeamsData.message}"`
  );

  // Case C: Empty DRAFT room (0 teams, 0 ideas, 0 investments, 0 budgets)
  const roomEta = await prisma.room.create({
    data: {
      name: `Room Eta Empty ${ts}`,
      code: `RE-${ts.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
    },
  });

  const deleteEmptyRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomEta.id}`, {
    method: 'DELETE',
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const deleteEmptyData = await deleteEmptyRes.json();
  record(
    'CLEAN_DELETE_EMPTY_DRAFT_ROOM',
    deleteEmptyRes.ok && deleteEmptyData.success === true,
    `Room Eta deleted cleanly: message="${deleteEmptyData.message}"`
  );

  const roomEtaInDb = await prisma.room.findUnique({ where: { id: roomEta.id } });
  record('EMPTY_ROOM_REMOVED_FROM_DB', roomEtaInDb === null, `Room Eta completely removed from database`);

  // -------------------------------------------------------------------------
  // TEST 4: Collision-Safe Automated Code Generation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Collision-Safe Automated Code Generation ---');
  // Generate 25 rooms with auto-generated RM-XXXX in parallel
  const roomPromises = Array.from({ length: 15 }, (_, i) =>
    fetch(`${BASE_URL}/api/admin/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
      body: JSON.stringify({ name: `AutoRoom_${ts}_${i}` }),
    }).then((r) => r.json())
  );
  const createdRooms = await Promise.all(roomPromises);
  const roomCodes = createdRooms.map((r) => r.room?.code).filter(Boolean);
  const uniqueRoomCodes = new Set(roomCodes);

  record(
    'COLLISION_SAFE_ROOM_CODES',
    roomCodes.length === 15 && uniqueRoomCodes.size === 15 && roomCodes.every((c) => c.startsWith('RM-')),
    `Generated 15 unique Room codes in parallel with 0 collisions: ${roomCodes.slice(0, 3).join(', ')}...`
  );

  // Generate 20 teams with auto-generated TEAM-XXXX in parallel
  const teamPromises = Array.from({ length: 15 }, (_, i) =>
    fetch(`${BASE_URL}/api/admin/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
      body: JSON.stringify({
        teamName: `AutoTeam_${ts}_${i}`,
        members: [
          { name: `Leader ${i}`, email: `lead_${ts}_${i}@test.com`, role: 'TEAM_LEADER' },
        ],
      }),
    }).then((r) => r.json())
  );
  const createdTeams = await Promise.all(teamPromises);
  const teamIds = createdTeams.map((t) => t.team?.id).filter(Boolean);
  const submissionIds = createdTeams.map((t) => t.team?.submissionId).filter(Boolean);
  const uniqueTeamIds = new Set(teamIds);
  const uniqueSubmissionIds = new Set(submissionIds);

  record(
    'COLLISION_SAFE_TEAM_CODES',
    teamIds.length === 15 && uniqueTeamIds.size === 15 && teamIds.every((id) => id.startsWith('TEAM-')),
    `Generated 15 unique Team IDs in parallel with 0 collisions: ${teamIds.slice(0, 3).join(', ')}...`
  );

  record(
    'COLLISION_SAFE_SUBMISSION_IDS',
    submissionIds.length === 15 && uniqueSubmissionIds.size === 15 && submissionIds.every((id) => id.startsWith('PNP-2024-')),
    `Generated 15 unique Submission IDs in parallel with 0 collisions: ${submissionIds.slice(0, 3).join(', ')}...`
  );

  // -------------------------------------------------------------------------
  // TEST 5: Team Assignment Lock in Active Rooms
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Team Assignment Lock in Active Rooms ---');
  // Attempt to assign a team to Room Gamma (which is currently PAUSED)
  const assignToActiveRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ teamId: teamZ.id }),
  });
  const assignToActiveData = await assignToActiveRes.json();
  record(
    'REJECT_ASSIGN_TO_ACTIVE_ROOM',
    assignToActiveRes.status === 403 && assignToActiveData.code === 'TEAM_ASSIGNMENT_LOCKED',
    `Status ${assignToActiveRes.status} code="${assignToActiveData.code}" message="${assignToActiveData.message}"`
  );

  // Attempt to move a team OUT of Room Gamma (active/paused)
  const roomTheta = await prisma.room.create({
    data: { name: `Room Theta ${ts}`, code: `RT-${ts.toString().slice(-4)}`, status: 'DRAFT', eventId: event.id },
  });
  const moveFromActiveRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomTheta.id}/teams/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ teamId: teamG1.id }),
  });
  const moveFromActiveData = await moveFromActiveRes.json();
  record(
    'REJECT_MOVE_OUT_OF_ACTIVE_ROOM',
    moveFromActiveRes.status === 403 && moveFromActiveData.code === 'TEAM_ASSIGNMENT_LOCKED',
    `Status ${moveFromActiveRes.status} code="${moveFromActiveData.code}" message="${moveFromActiveData.message}"`
  );

  // Attempt to unassign from active Room Gamma
  const unassignActiveRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}/teams/unassign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ teamIds: [teamG1.id] }),
  });
  const unassignActiveData = await unassignActiveRes.json();
  record(
    'REJECT_UNASSIGN_FROM_ACTIVE_ROOM',
    unassignActiveRes.status === 403 && unassignActiveData.code === 'TEAM_ASSIGNMENT_LOCKED',
    `Status ${unassignActiveRes.status} code="${unassignActiveData.code}" message="${unassignActiveData.message}"`
  );

  console.log('\n===============================================================');
  console.log('MULTI-ADMIN HARDENING VERIFICATION SUMMARY');
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
