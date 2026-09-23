import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

interface StepResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const steps: StepResult[] = [];
let stepCounter = 1;

function assertStep(name: string, passed: boolean, details: string) {
  const num = stepCounter++;
  steps.push({ num, name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[Step ${num.toString().padStart(2, '0')}] ${status} | ${name}: ${details}`);
  if (!passed) {
    console.error(`FAILED STEP DETAILS: ${details}`);
  }
}

async function login(email: string, password: string = 'password123'): Promise<string> {
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

async function runE2ESuite() {
  console.log('================================================================================');
  console.log('STARTING FINAL PRODUCTION HARDENING & ACCEPTANCE E2E VERIFICATION SUITE');
  console.log('PITCH AND PROSPER — CSEA LIVE EVENT READINESS');
  console.log('================================================================================\n');

  const ts = Date.now();
  const passwordHash = hashPassword('password123');

  // STEP 1: Admin A setup & authentication
  const adminAEmail = `super_admin_a_${ts}@csea.edu`;
  const adminA = await prisma.user.create({
    data: {
      name: 'Super Admin Alpha',
      email: adminAEmail,
      passwordHash,
      role: UserRole.ADMIN,
      avatarInitials: 'SA',
      isActive: true,
      emailVerified: true,
    },
  });
  const adminACookie = await login(adminAEmail);
  assertStep('AUTH_ADMIN_A', Boolean(adminACookie), `Admin A authenticated with session cookie`);

  // STEP 2: Admin B setup & authentication (for multi-admin concurrency)
  const adminBEmail = `super_admin_b_${ts}@csea.edu`;
  const adminB = await prisma.user.create({
    data: {
      name: 'Super Admin Beta',
      email: adminBEmail,
      passwordHash,
      role: UserRole.ADMIN,
      avatarInitials: 'SB',
      isActive: true,
      emailVerified: true,
    },
  });
  const adminBCookie = await login(adminBEmail);
  assertStep('AUTH_ADMIN_B', Boolean(adminBCookie), `Admin B authenticated with session cookie`);

  // STEP 3: Setup active Event record
  let event = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        name: `CSEA Master Event ${ts}`,
        totalCoins: 200,
        minInvestment: 20,
        maxInvestment: 100,
        status: 'OPEN',
        version: 1,
      },
    });
  }
  assertStep('ACTIVE_EVENT_EXISTS', Boolean(event), `Active event ID: ${event.id}, version: ${event.version}`);

  // STEP 4: Set baseline defaults to 200 / 20 / 100
  const baselineSettingsRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const initialSettingsData = await baselineSettingsRes.json();
  const v0 = initialSettingsData.settings.settingsVersion;

  const setBaselineRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({
      totalCoins: 200,
      minInvestment: 20,
      maxInvestment: 100,
      settingsVersion: v0,
    }),
  });
  const setBaselineData = await setBaselineRes.json();
  assertStep(
    'SET_BASELINE_EVENT_SETTINGS',
    setBaselineRes.ok && setBaselineData.settings?.totalCoins === 200,
    `Baseline set: 200 coins, min 20, max 100 (version ${setBaselineData.settings?.settingsVersion})`
  );

  // STEP 5: Create Room Alpha with initialCoins=200, min=20, max=100
  const roomAlpha = await prisma.room.create({
    data: {
      name: `Room Alpha E2E ${ts}`,
      code: `RA-${ts.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
      initialCoins: 200,
      minInvestment: 20,
      maxInvestment: 100,
      version: 1,
    },
  });
  assertStep(
    'CREATE_ROOM_ALPHA_DRAFT',
    roomAlpha.status === 'DRAFT' && roomAlpha.initialCoins === 200,
    `Room Alpha created in DRAFT: 200/20/100, version 1`
  );

  // STEP 6: Create Teams in Room Alpha with approved ideas
  const defaultIdea = {
    categoryTag: 'Fintech',
    problemStatement: 'Problem A',
    solution: 'Solution A',
    innovation: 'Innovation A',
    impact: 'Impact A',
    whyInvest: 'Growth A',
    technology: 'Next.js, MySQL',
  };

  const teamA1 = await prisma.team.create({
    data: { teamId: `TEAM-A1-${ts}`, name: `Alpha Team One ${ts}`, submissionId: `PNP-A1-${ts}`, roomId: roomAlpha.id },
  });
  const ideaA1 = await prisma.idea.create({
    data: { anonymousId: `IDEA-A1-${ts}`, teamId: teamA1.id, roomId: roomAlpha.id, title: `Alpha Idea 1 ${ts}`, status: 'APPROVED', track: 'WEB', ...defaultIdea },
  });

  const teamA2 = await prisma.team.create({
    data: { teamId: `TEAM-A2-${ts}`, name: `Alpha Team Two ${ts}`, submissionId: `PNP-A2-${ts}`, roomId: roomAlpha.id },
  });
  const ideaA2 = await prisma.idea.create({
    data: { anonymousId: `IDEA-A2-${ts}`, teamId: teamA2.id, roomId: roomAlpha.id, title: `Alpha Idea 2 ${ts}`, status: 'APPROVED', track: 'AI', ...defaultIdea },
  });
  assertStep('SETUP_ROOM_ALPHA_TEAMS', Boolean(ideaA1 && ideaA2), `Teams A1 & A2 with approved ideas assigned to Room Alpha`);

  // STEP 7: Create Participant P1 (Leader of Team A1) and Participant P3 (Investor)
  const p1Email = `p1_alpha_${ts}@csea.edu`;
  const p1User = await prisma.user.create({
    data: {
      name: 'Participant P1',
      email: p1Email,
      passwordHash,
      role: UserRole.TEAM_LEADER,
      teamId: teamA1.id,
      avatarInitials: 'P1',
      isActive: true,
      emailVerified: true,
    },
  });
  await prisma.team.update({ where: { id: teamA1.id }, data: { leaderId: p1User.id } });
  const p1Cookie = await login(p1Email);

  const p3Email = `p3_investor_${ts}@csea.edu`;
  const p3User = await prisma.user.create({
    data: {
      name: 'Independent Investor P3',
      email: p3Email,
      passwordHash,
      role: UserRole.INVESTOR,
      avatarInitials: 'P3',
      isActive: true,
      emailVerified: true,
    },
  });
  const p3Cookie = await login(p3Email);
  assertStep('AUTH_PARTICIPANTS', Boolean(p1Cookie && p3Cookie), `P1 (Leader) and P3 (Investor) registered & logged in`);

  // STEP 8: Transition Room Alpha: DRAFT -> OPEN (Arena Start)
  const startAlphaRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
  });
  const startAlphaData = await startAlphaRes.json();
  assertStep(
    'ARENA_START_ROOM_ALPHA',
    startAlphaRes.ok && startAlphaData.room?.status === 'OPEN',
    `Room Alpha transitioned DRAFT -> OPEN atomically. Version incremented to ${startAlphaData.room?.version}`
  );

  // STEP 9: Verify P1 Budget initial allocation equals Room Alpha initialCoins (200)
  const p1Budget = await prisma.participantBudget.findUnique({
    where: { userId_roomId: { userId: p1User.id, roomId: roomAlpha.id } },
  });
  assertStep(
    'P1_BUDGET_INITIALIZED',
    p1Budget !== null && p1Budget.allocatedCoins === 200 && p1Budget.availableCoins === 200,
    `P1 budget created: allocated=${p1Budget?.allocatedCoins}, available=${p1Budget?.availableCoins}`
  );

  // STEP 10: Verify Room Alpha settings snapshot in DB
  const roomAlphaInDb = await prisma.room.findUnique({ where: { id: roomAlpha.id } });
  assertStep(
    'ROOM_ALPHA_SNAPSHOT_EXACT',
    roomAlphaInDb?.initialCoins === 200 && roomAlphaInDb?.minInvestment === 20 && roomAlphaInDb?.maxInvestment === 100,
    `Room Alpha DB snapshot verified: 200 initial, 20 min, 100 max`
  );

  // STEP 11: Change Global Event Defaults to 300 / 30 / 150
  const getSettingsForUpdate = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const v1Data = await getSettingsForUpdate.json();
  const v1 = v1Data.settings.settingsVersion;

  const updateDefaultsRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({
      totalCoins: 300,
      minInvestment: 30,
      maxInvestment: 150,
      settingsVersion: v1,
    }),
  });
  const updateDefaultsData = await updateDefaultsRes.json();
  assertStep(
    'CHANGE_GLOBAL_EVENT_DEFAULTS',
    updateDefaultsRes.ok && updateDefaultsData.settings?.totalCoins === 300,
    `Global defaults updated to 300 coins, min 30, max 150 (version ${updateDefaultsData.settings?.settingsVersion})`
  );

  // STEP 12: CRITICAL INVARIANT: Room Alpha MUST REMAIN 200 / 20 / 100
  const roomAlphaAfterGlobalChange = await prisma.room.findUnique({ where: { id: roomAlpha.id } });
  assertStep(
    'CRITICAL_ROOM_ALPHA_IMMUTABLE',
    roomAlphaAfterGlobalChange?.initialCoins === 200 &&
      roomAlphaAfterGlobalChange?.minInvestment === 20 &&
      roomAlphaAfterGlobalChange?.maxInvestment === 100,
    `Room Alpha remains 200/20/100 (NOT changed to 300/30/150). Historical isolation guaranteed.`
  );

  // STEP 13: CRITICAL INVARIANT: P1 budget MUST REMAIN 200 (NOT overwritten)
  const p1BudgetAfterGlobalChange = await prisma.participantBudget.findUnique({
    where: { userId_roomId: { userId: p1User.id, roomId: roomAlpha.id } },
  });
  assertStep(
    'CRITICAL_P1_BUDGET_NOT_OVERWRITTEN',
    p1BudgetAfterGlobalChange?.allocatedCoins === 200 && p1BudgetAfterGlobalChange?.availableCoins === 200,
    `P1 budget remains 200 (NOT altered by global settings change)`
  );

  // STEP 14: Server-Side Rejection: Attempt to edit settings of OPEN room -> HTTP 409 ROOM_SETTINGS_LOCKED
  const editOpenRoomRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ initialCoins: 250, minInvestment: 25, maxInvestment: 120 }),
  });
  const editOpenRoomData = await editOpenRoomRes.json();
  assertStep(
    'REJECT_EDIT_OPEN_ROOM_SETTINGS',
    editOpenRoomRes.status === 409 && editOpenRoomData.code === 'ROOM_SETTINGS_LOCKED',
    `Status 409 ROOM_SETTINGS_LOCKED: "${editOpenRoomData.message}"`
  );

  // STEP 15: Pause Room Alpha -> status PAUSED
  const pauseRoomRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ status: 'PAUSED' }),
  });
  assertStep('PAUSE_ROOM_ALPHA', pauseRoomRes.ok, `Room Alpha transitioned OPEN -> PAUSED`);

  // STEP 16: Server-Side Rejection: Attempt to edit settings of PAUSED room -> HTTP 409 ROOM_SETTINGS_LOCKED
  const editPausedRoomRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ initialCoins: 250, minInvestment: 25, maxInvestment: 120 }),
  });
  const editPausedRoomData = await editPausedRoomRes.json();
  assertStep(
    'REJECT_EDIT_PAUSED_ROOM_SETTINGS',
    editPausedRoomRes.status === 409 && editPausedRoomData.code === 'ROOM_SETTINGS_LOCKED',
    `Status 409 ROOM_SETTINGS_LOCKED: "${editPausedRoomData.message}"`
  );

  // STEP 17: Resume Room Alpha -> status OPEN, budgets intact
  const resumeRoomRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomAlpha.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ status: 'OPEN' }),
  });
  assertStep('RESUME_ROOM_ALPHA', resumeRoomRes.ok, `Room Alpha resumed PAUSED -> OPEN`);

  // STEP 18: Investment Rule Check: Exceeding Room Alpha max (100) -> HTTP 400 EXCEEDS_MAXIMUM
  const invest120Res = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
    body: JSON.stringify({ ideaId: ideaA2.id, amount: 120 }),
  });
  const invest120Data = await invest120Res.json();
  assertStep(
    'REJECT_EXCEEDING_ROOM_MAX',
    invest120Res.status === 400 && invest120Data.code === 'EXCEEDS_MAXIMUM',
    `Status 400 EXCEEDS_MAXIMUM: "${invest120Data.message}"`
  );

  // STEP 19: Investment Rule Check: Below Room Alpha min (20) -> HTTP 400 BELOW_MINIMUM
  const invest15Res = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
    body: JSON.stringify({ ideaId: ideaA2.id, amount: 15 }),
  });
  const invest15Data = await invest15Res.json();
  assertStep(
    'REJECT_BELOW_ROOM_MIN',
    invest15Res.status === 400 && invest15Data.code === 'BELOW_MINIMUM',
    `Status 400 BELOW_MINIMUM: "${invest15Data.message}"`
  );

  // STEP 20: Valid Investment: P1 invests 80 in Idea A2 -> HTTP 200
  const invest80Res = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
    body: JSON.stringify({ ideaId: ideaA2.id, amount: 80 }),
  });
  const invest80Data = await invest80Res.json();
  const p1Remaining = invest80Data.budget?.availableCoins;
  assertStep(
    'VALID_INVESTMENT_80_COINS',
    invest80Res.ok && p1Remaining === 120,
    `P1 invested 80 in Idea A2. Available: ${p1Remaining} coins`
  );

  // STEP 21: CRITICAL RULE: ONE INVESTMENT PER IDEA -> Second investment rejected HTTP 409 ALREADY_INVESTED
  const investDuplicateRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
    body: JSON.stringify({ ideaId: ideaA2.id, amount: 20 }),
  });
  const investDuplicateData = await investDuplicateRes.json();
  assertStep(
    'REJECT_DUPLICATE_INVESTMENT',
    investDuplicateRes.status === 409 && investDuplicateData.code === 'ALREADY_INVESTED',
    `Status 409 ALREADY_INVESTED: "${investDuplicateData.message}"`
  );

  // STEP 22: CRITICAL RULE: CANNOT INVEST IN OWN IDEA -> P1 investing in Idea A1 rejected HTTP 403 OWN_TEAM_IDEA
  const investOwnRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p1Cookie}` },
    body: JSON.stringify({ ideaId: ideaA1.id, amount: 50 }),
  });
  const investOwnData = await investOwnRes.json();
  assertStep(
    'REJECT_INVEST_OWN_IDEA',
    investOwnRes.status === 403 && investOwnData.code === 'OWN_TEAM_IDEA',
    `Status 403 OWN_TEAM_IDEA: "${investOwnData.message}"`
  );

  // STEP 23: Create Room Beta AFTER global settings were updated to 300 / 30 / 150
  const roomBeta = await prisma.room.create({
    data: {
      name: `Room Beta E2E ${ts}`,
      code: `RB-${ts.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
      version: 1,
    },
  });
  const teamB1 = await prisma.team.create({
    data: { teamId: `TEAM-B1-${ts}`, name: `Beta Team One ${ts}`, submissionId: `PNP-B1-${ts}`, roomId: roomBeta.id },
  });
  const ideaB1 = await prisma.idea.create({
    data: { anonymousId: `IDEA-B1-${ts}`, teamId: teamB1.id, roomId: roomBeta.id, title: `Beta Idea 1 ${ts}`, status: 'APPROVED', track: 'AI', ...defaultIdea },
  });
  const teamB2 = await prisma.team.create({
    data: { teamId: `TEAM-B2-${ts}`, name: `Beta Team Two ${ts}`, submissionId: `PNP-B2-${ts}`, roomId: roomBeta.id },
  });
  const ideaB2 = await prisma.idea.create({
    data: { anonymousId: `IDEA-B2-${ts}`, teamId: teamB2.id, roomId: roomBeta.id, title: `Beta Idea 2 ${ts}`, status: 'APPROVED', track: 'CLOUD', ...defaultIdea },
  });

  const p2Email = `p2_beta_${ts}@csea.edu`;
  const p2User = await prisma.user.create({
    data: {
      name: 'Participant P2',
      email: p2Email,
      passwordHash,
      role: UserRole.TEAM_LEADER,
      teamId: teamB1.id,
      avatarInitials: 'P2',
      isActive: true,
      emailVerified: true,
    },
  });
  await prisma.team.update({ where: { id: teamB1.id }, data: { leaderId: p2User.id } });
  const p2Cookie = await login(p2Email);

  // Start Room Beta -> should snapshot 300 / 30 / 150
  const startBetaRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomBeta.id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
  });
  const startBetaData = await startBetaRes.json();
  const roomBetaInDb = await prisma.room.findUnique({ where: { id: roomBeta.id } });
  assertStep(
    'ROOM_BETA_SNAPSHOTS_NEW_DEFAULTS',
    startBetaRes.ok && roomBetaInDb?.initialCoins === 300 && roomBetaInDb?.maxInvestment === 150,
    `Room Beta snapshotted 300 initial, 30 min, 150 max`
  );

  // STEP 24: Participant P2 in Room Beta invests up to 150 coins -> SUCCEEDS (under Beta's 150 cap)
  const invest150BetaRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${p2Cookie}` },
    body: JSON.stringify({ ideaId: ideaB2.id, amount: 150 }),
  });
  const invest150BetaData = await invest150BetaRes.json();
  const p2Remaining = invest150BetaData.budget?.availableCoins;
  assertStep(
    'P2_INVESTS_150_IN_ROOM_BETA',
    invest150BetaRes.ok && p2Remaining === 150,
    `P2 invested 150 successfully in Room Beta (allowed by Room Beta's 150 limit, remaining=${p2Remaining})`
  );

  // STEP 25: Multi-Admin Optimistic Concurrency Control
  const latestSettingsRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const latestSettings = await latestSettingsRes.json();
  const currVer = latestSettings.settings.settingsVersion;

  // Admin A saves at currVer -> succeeds, increments to currVer + 1
  const adminAUpdateRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ totalCoins: 350, minInvestment: 35, maxInvestment: 175, settingsVersion: currVer }),
  });
  const adminAUpdateData = await adminAUpdateRes.json();
  assertStep(
    'ADMIN_A_CONCURRENT_UPDATE_SUCCESS',
    adminAUpdateRes.ok && adminAUpdateData.settings.settingsVersion === currVer + 1,
    `Admin A updated settings to version ${adminAUpdateData.settings?.settingsVersion}`
  );

  // Admin B saves at stale currVer -> must reject HTTP 409 SETTINGS_VERSION_CONFLICT
  const adminBStaleRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminBCookie}` },
    body: JSON.stringify({ totalCoins: 400, minInvestment: 40, maxInvestment: 200, settingsVersion: currVer }),
  });
  const adminBStaleData = await adminBStaleRes.json();
  assertStep(
    'ADMIN_B_STALE_UPDATE_CONFLICT',
    adminBStaleRes.status === 409 && adminBStaleData.code === 'SETTINGS_VERSION_CONFLICT',
    `Status 409 SETTINGS_VERSION_CONFLICT: "${adminBStaleData.message}"`
  );

  // STEP 26: Concurrent Room Starts
  const roomGamma = await prisma.room.create({
    data: {
      name: `Room Gamma Concurrent ${ts}`,
      code: `RGC-${ts.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
      version: 1,
    },
  });
  const teamG1 = await prisma.team.create({
    data: { teamId: `TEAM-GC1-${ts}`, name: `GC Team 1 ${ts}`, submissionId: `PNP-GC1-${ts}`, roomId: roomGamma.id },
  });
  await prisma.idea.create({
    data: { anonymousId: `IDEA-GC1-${ts}`, teamId: teamG1.id, roomId: roomGamma.id, title: `Idea GC1 ${ts}`, status: 'APPROVED', track: 'AI', ...defaultIdea },
  });
  const teamG2 = await prisma.team.create({
    data: { teamId: `TEAM-GC2-${ts}`, name: `GC Team 2 ${ts}`, submissionId: `PNP-GC2-${ts}`, roomId: roomGamma.id },
  });
  await prisma.idea.create({
    data: { anonymousId: `IDEA-GC2-${ts}`, teamId: teamG2.id, roomId: roomGamma.id, title: `Idea GC2 ${ts}`, status: 'APPROVED', track: 'AI', ...defaultIdea },
  });

  const [concStartA, concStartB] = await Promise.all([
    fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    }).then(async (r) => ({ status: r.status, data: await r.json() })),
    fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminBCookie}` },
    }).then(async (r) => ({ status: r.status, data: await r.json() })),
  ]);

  const concSuccess = [concStartA, concStartB].filter((r) => r.status === 200).length;
  const concConflict = [concStartA, concStartB].filter(
    (r) => r.status === 409 && r.data.code === 'ROOM_STATE_CHANGED'
  ).length;
  assertStep(
    'CONCURRENT_START_ATOMIC_PROTECTION',
    concSuccess === 1 && concConflict === 1,
    `Exactly 1 start succeeded (200), 1 received HTTP 409 ROOM_STATE_CHANGED`
  );

  // STEP 27: Safe Room Deletion Invariants: Reject delete on OPEN room
  const deleteOpenRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}`, {
    method: 'DELETE',
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const deleteOpenData = await deleteOpenRes.json();
  assertStep(
    'REJECT_DELETE_OPEN_ROOM',
    deleteOpenRes.status === 409 && deleteOpenData.code === 'ROOM_ACTIVE_CANNOT_DELETE',
    `Status 409 ROOM_ACTIVE_CANNOT_DELETE: "${deleteOpenData.message}"`
  );

  // STEP 28: Safe Room Deletion Invariants: Reject delete on PAUSED room
  await prisma.room.update({ where: { id: roomGamma.id }, data: { status: 'PAUSED' } });
  const deletePausedRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}`, {
    method: 'DELETE',
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const deletePausedData = await deletePausedRes.json();
  assertStep(
    'REJECT_DELETE_PAUSED_ROOM',
    deletePausedRes.status === 409 && deletePausedData.code === 'ROOM_ACTIVE_CANNOT_DELETE',
    `Status 409 ROOM_ACTIVE_CANNOT_DELETE: "${deletePausedData.message}"`
  );

  // STEP 29: Safe Room Deletion Invariants: Reject delete on DRAFT room with teams
  const draftRoomWithTeams = await prisma.room.create({
    data: {
      name: `Draft With Teams ${ts}`,
      code: `RDW-${ts.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
    },
  });
  const teamInDraft = await prisma.team.create({
    data: { teamId: `TEAM-DW-${ts}`, name: `DW Team ${ts}`, submissionId: `PNP-DW-${ts}`, roomId: draftRoomWithTeams.id },
  });
  const deleteDraftWithTeamsRes = await fetch(`${BASE_URL}/api/admin/rooms/${draftRoomWithTeams.id}`, {
    method: 'DELETE',
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const deleteDraftWithTeamsData = await deleteDraftWithTeamsRes.json();
  assertStep(
    'REJECT_DELETE_ROOM_WITH_TEAMS',
    deleteDraftWithTeamsRes.status === 409 && deleteDraftWithTeamsData.code === 'ROOM_HAS_HISTORICAL_DATA',
    `Status 409 ROOM_HAS_HISTORICAL_DATA: "${deleteDraftWithTeamsData.message}"`
  );

  // STEP 30: Safe Room Deletion Invariants: Clean delete on empty DRAFT room
  const emptyDraftRoom = await prisma.room.create({
    data: {
      name: `Empty Draft Room ${ts}`,
      code: `RED-${ts.toString().slice(-4)}`,
      status: 'DRAFT',
      eventId: event.id,
    },
  });
  const deleteEmptyDraftRes = await fetch(`${BASE_URL}/api/admin/rooms/${emptyDraftRoom.id}`, {
    method: 'DELETE',
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const deleteEmptyDraftData = await deleteEmptyDraftRes.json();
  assertStep(
    'CLEAN_DELETE_EMPTY_DRAFT_ROOM',
    deleteEmptyDraftRes.ok && deleteEmptyDraftData.success === true,
    `Empty DRAFT room deleted cleanly: "${deleteEmptyDraftData.message}"`
  );

  const emptyRoomInDb = await prisma.room.findUnique({ where: { id: emptyDraftRoom.id } });
  assertStep('EMPTY_ROOM_PURGED_FROM_DB', emptyRoomInDb === null, `Empty room record confirmed deleted in MySQL`);

  // STEP 31: Collision-Safe Automated Code Generation: 10 Rooms
  const roomGenPromises = Array.from({ length: 10 }, (_, i) =>
    fetch(`${BASE_URL}/api/admin/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
      body: JSON.stringify({ name: `BulkAutoRoom_${ts}_${i}` }),
    }).then((r) => r.json())
  );
  const genRooms = await Promise.all(roomGenPromises);
  const autoCodes = genRooms.map((r) => r.room?.code).filter(Boolean);
  const uniqueAutoCodes = new Set(autoCodes);
  assertStep(
    'AUTO_GENERATE_ROOM_CODES',
    autoCodes.length === 10 && uniqueAutoCodes.size === 10 && autoCodes.every((c) => c.startsWith('RM-')),
    `Generated 10 unique RM-XXXX codes: ${autoCodes.slice(0, 3).join(', ')}...`
  );

  // STEP 32: Collision-Safe Automated Code Generation: 10 Teams
  const teamGenPromises = Array.from({ length: 10 }, (_, i) =>
    fetch(`${BASE_URL}/api/admin/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
      body: JSON.stringify({
        teamName: `BulkAutoTeam_${ts}_${i}`,
        members: [{ name: `Lead ${i}`, email: `lead_bulk_${ts}_${i}@test.com`, role: 'TEAM_LEADER' }],
      }),
    }).then((r) => r.json())
  );
  const genTeams = await Promise.all(teamGenPromises);
  const autoTeamIds = genTeams.map((t) => t.team?.id).filter(Boolean);
  const autoSubIds = genTeams.map((t) => t.team?.submissionId).filter(Boolean);
  const uniqueTeamIds = new Set(autoTeamIds);
  const uniqueSubIds = new Set(autoSubIds);
  assertStep(
    'AUTO_GENERATE_TEAM_CODES',
    autoTeamIds.length === 10 && uniqueTeamIds.size === 10 && autoTeamIds.every((t) => t.startsWith('TEAM-')),
    `Generated 10 unique TEAM-XXXX IDs: ${autoTeamIds.slice(0, 3).join(', ')}...`
  );
  assertStep(
    'AUTO_GENERATE_SUBMISSION_IDS',
    autoSubIds.length === 10 && uniqueSubIds.size === 10 && autoSubIds.every((s) => s.startsWith('PNP-2024-')),
    `Generated 10 unique PNP-2024-XXXX submission IDs: ${autoSubIds.slice(0, 3).join(', ')}...`
  );

  // STEP 33: Team Assignment Lock: Reject assign to active room
  const assignActiveRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ teamId: teamInDraft.id }),
  });
  const assignActiveData = await assignActiveRes.json();
  assertStep(
    'REJECT_ASSIGN_TEAMS_TO_ACTIVE_ROOM',
    assignActiveRes.status === 403 && assignActiveData.code === 'TEAM_ASSIGNMENT_LOCKED',
    `Status 403 TEAM_ASSIGNMENT_LOCKED: "${assignActiveData.message}"`
  );

  // STEP 34: Team Assignment Lock: Reject move out of active room
  const draftRoomTarget = await prisma.room.create({
    data: { name: `Target Draft ${ts}`, code: `TRG-${ts.toString().slice(-4)}`, status: 'DRAFT', eventId: event.id },
  });
  const moveActiveRes = await fetch(`${BASE_URL}/api/admin/rooms/${draftRoomTarget.id}/teams/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ teamId: teamG1.id }),
  });
  const moveActiveData = await moveActiveRes.json();
  assertStep(
    'REJECT_MOVE_OUT_OF_ACTIVE_ROOM',
    moveActiveRes.status === 403 && moveActiveData.code === 'TEAM_ASSIGNMENT_LOCKED',
    `Status 403 TEAM_ASSIGNMENT_LOCKED: "${moveActiveData.message}"`
  );

  // STEP 35: Team Assignment Lock: Reject unassign from active room
  const unassignActiveRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomGamma.id}/teams/unassign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ teamIds: [teamG1.id] }),
  });
  const unassignActiveData = await unassignActiveRes.json();
  assertStep(
    'REJECT_UNASSIGN_FROM_ACTIVE_ROOM',
    unassignActiveRes.status === 403 && unassignActiveData.code === 'TEAM_ASSIGNMENT_LOCKED',
    `Status 403 TEAM_ASSIGNMENT_LOCKED: "${unassignActiveData.message}"`
  );

  // STEP 36: Batch Team Move in DRAFT rooms succeeds
  const batchMoveRes = await fetch(`${BASE_URL}/api/admin/rooms/${draftRoomTarget.id}/teams/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ teamIds: [teamInDraft.id] }),
  });
  const batchMoveData = await batchMoveRes.json();
  assertStep(
    'BATCH_MOVE_TEAMS_IN_DRAFT',
    batchMoveRes.ok && batchMoveData.success === true,
    `Batch moved 1 team into target draft room: "${batchMoveData.message}"`
  );

  // STEP 37: Batch Team Unassign in DRAFT room succeeds
  const batchUnassignRes = await fetch(`${BASE_URL}/api/admin/rooms/${draftRoomTarget.id}/teams/unassign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pnp_session=${adminACookie}` },
    body: JSON.stringify({ teamIds: [teamInDraft.id] }),
  });
  const batchUnassignData = await batchUnassignRes.json();
  assertStep(
    'BATCH_UNASSIGN_TEAMS_IN_DRAFT',
    batchUnassignRes.ok && batchUnassignData.success === true,
    `Batch unassigned team cleanly from draft room`
  );

  // STEP 38: Leaderboard / Idea Room Scoping: Room Alpha vs Room Beta
  const roomAlphaIdeasRes = await fetch(`${BASE_URL}/api/ideas?roomId=${roomAlpha.id}`, {
    headers: { Cookie: `pnp_session=${adminACookie}` },
  });
  const roomAlphaIdeas = await roomAlphaIdeasRes.json();
  const alphaHasIdeaA2 = roomAlphaIdeas.ideas?.some((i: any) => i.id === ideaA2.id);
  const alphaHasIdeaB2 = roomAlphaIdeas.ideas?.some((i: any) => i.id === ideaB2.id);
  assertStep(
    'IDEAS_ROOM_SCOPED',
    alphaHasIdeaA2 && !alphaHasIdeaB2,
    `Room Alpha query strictly contains Idea A2 and excludes Idea B2 from Room Beta`
  );

  console.log('\n================================================================================');
  console.log('ACCEPTANCE SUITE SUMMARY');
  console.log('================================================================================');
  const allPassed = steps.every((s) => s.passed);
  console.log(`TOTAL STEPS: ${steps.length}`);
  console.log(`PASSED: ${steps.filter((s) => s.passed).length}`);
  console.log(`FAILED: ${steps.filter((s) => !s.passed).length}`);
  console.log(`STATUS: ${allPassed ? 'ALL VERIFICATIONS PASSED (100%) ✅' : 'FAILURES DETECTED ❌'}`);

  if (!allPassed) {
    process.exit(1);
  }
}

runE2ESuite()
  .catch((err) => {
    console.error('Master E2E suite encountered uncaught error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
