import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

interface StepResult {
  step: string;
  passed: boolean;
  details?: any;
}

const results: StepResult[] = [];

function record(step: string, passed: boolean, details?: any) {
  results.push({ step, passed, details });
  const tag = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${tag} ${step}${details ? ` -> ${typeof details === 'object' ? JSON.stringify(details) : details}` : ''}`);
}

async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const sessionToken = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      id: sessionToken,
      userId,
      expiresAt,
    },
  });
  return sessionToken;
}

async function main() {
  console.log('================================================================');
  console.log('  VERIFICATION SUITE: ROOM CONTEXT CONSISTENCY & SECURITY       ');
  console.log('================================================================\n');

  // Locate ABC participant user (Pradesh)
  const abcUser = await prisma.user.findFirst({
    where: { email: 'pradesh@student.tce.edu' },
    include: { team: true, wallet: true },
  });
  if (!abcUser) throw new Error('ABC user not found in DB');

  const teamABC = await prisma.team.findFirst({
    where: { name: 'ABC' },
    include: { room: true },
  });
  if (!teamABC) throw new Error('Team ABC not found in DB');

  console.log(`ABC Participant: ${abcUser.email} (${abcUser.id})`);
  console.log(`Team ABC: ${teamABC.name} (${teamABC.id}), RoomId: ${teamABC.roomId}`);

  // Ensure active room is OPEN
  const activeRoom = await prisma.room.findUnique({
    where: { id: teamABC.roomId! },
  });
  if (!activeRoom) throw new Error('Room for Team ABC not found in DB');

  await prisma.room.update({
    where: { id: activeRoom.id },
    data: { status: 'OPEN' },
  });

  // Ensure active event is OPEN and wallet has sufficient coins
  const activeEvent = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (activeEvent) {
    await prisma.event.update({
      where: { id: activeEvent.id },
      data: { status: 'OPEN', minInvestment: 20, maxInvestment: 100 },
    });
  }

  // Ensure ABC wallet has at least 300 available coins
  await prisma.wallet.upsert({
    where: { userId: abcUser.id },
    update: { totalCoins: 500, investedCoins: 0, availableCoins: 500 },
    create: { userId: abcUser.id, totalCoins: 500, investedCoins: 0, availableCoins: 500 },
  });

  const sessionId = await createSession(abcUser.id);
  const headers = {
    Cookie: `pnp_session=${sessionId}`,
    'Content-Type': 'application/json',
  };

  // -------------------------------------------------------------
  // STEP 7: VERIFY WITH LIVE DATA
  // -------------------------------------------------------------
  console.log('\n>>> STEP 7: LIVE DATA VERIFICATION');

  // 1. GET /api/me/context
  const resContext = await fetch(`${BASE_URL}/api/me/context`, { headers });
  const dataContext = await resContext.json();
  const contextRoomId = dataContext.context?.roomId || dataContext.context?.room?.id;
  record(
    'GET /api/me/context resolves ABC assigned room',
    resContext.status === 200 && contextRoomId === teamABC.roomId,
    { status: resContext.status, resolvedRoomId: contextRoomId, expected: teamABC.roomId }
  );

  // 2. GET /api/teams/mine
  const resMine = await fetch(`${BASE_URL}/api/teams/mine`, { headers });
  const dataMine = await resMine.json();
  const mineRoomId = dataMine.room?.id;
  record(
    'GET /api/teams/mine resolves the exact same room',
    resMine.status === 200 && mineRoomId === contextRoomId,
    { status: resMine.status, mineRoomId, contextRoomId }
  );

  // 3. GET /api/ideas
  const resIdeas = await fetch(`${BASE_URL}/api/ideas`, { headers });
  const dataIdeas = await resIdeas.json();
  const ideasRoomId = dataIdeas.room?.id;
  record(
    'GET /api/ideas resolves the exact same room',
    resIdeas.status === 200 && ideasRoomId === contextRoomId && Array.isArray(dataIdeas.ideas),
    { status: resIdeas.status, ideasRoomId, count: dataIdeas.ideas?.length }
  );

  // Check that own team's idea is excluded from investable ideas
  const ownIdeaInIdeas = dataIdeas.ideas?.some((i: any) => i.title === 'ABC' || i.anonymousId === 'IDEA A16');
  record(
    'GET /api/ideas excludes participant own team idea',
    !ownIdeaInIdeas,
    `Investable ideas count: ${dataIdeas.ideas?.length}`
  );

  // 4. POST /api/invest (Valid 50-coin investment)
  const peerIdea = dataIdeas.ideas?.[0];
  if (!peerIdea) throw new Error('No investable peer idea found in room');

  const resInvest = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ideaId: peerIdea.id,
      amount: 50,
    }),
  });
  const dataInvest = await resInvest.json();
  record(
    'POST /api/invest succeeds with 50 coins (No "not assigned to room" error)',
    resInvest.status === 200 && dataInvest.success === true,
    { status: resInvest.status, message: dataInvest.message, wallet: dataInvest.wallet }
  );

  // Verify wallet decremented in DB
  const updatedWallet = await prisma.wallet.findUnique({ where: { userId: abcUser.id } });
  record(
    'DB Wallet decremented by 50 (500 -> 450 available)',
    updatedWallet?.investedCoins === 50 && updatedWallet?.availableCoins === 450,
    `total=${updatedWallet?.totalCoins}, invested=${updatedWallet?.investedCoins}, available=${updatedWallet?.availableCoins}`
  );

  // -------------------------------------------------------------
  // STEP 8: SECURITY RULES VERIFICATION
  // -------------------------------------------------------------
  console.log('\n>>> STEP 8: SECURITY RULES VERIFICATION');

  // Rule A: ABC -> own team idea -> reject 403
  const ownIdea = await prisma.idea.findFirst({ where: { teamId: teamABC.id } });
  if (ownIdea) {
    const resOwn = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ideaId: ownIdea.id, amount: 50 }),
    });
    const dataOwn = await resOwn.json();
    record(
      'Rule A: Own-team idea rejected with HTTP 403',
      resOwn.status === 403 && dataOwn.code === 'OWN_TEAM_INVESTMENT_FORBIDDEN',
      { status: resOwn.status, code: dataOwn.code, message: dataOwn.message }
    );
  }

  // Rule B: ABC -> peer idea in same room -> allow if valid
  const secondPeerIdea = dataIdeas.ideas?.[1] || peerIdea;
  const resPeer = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ideaId: secondPeerIdea.id, amount: 30 }),
  });
  const dataPeer = await resPeer.json();
  record(
    'Rule B: Valid investment in other team in same room succeeds',
    resPeer.status === 200 && dataPeer.success === true,
    { status: resPeer.status, amount: 30, remaining: dataPeer.wallet?.remaining }
  );

  // Rule C: ABC -> idea in another room -> reject 403
  // Create a temporary idea in a different room or use an idea from another room
  const otherRoom = await prisma.room.findFirst({
    where: { id: { not: teamABC.roomId! } },
  });
  let crossRoomIdeaId: string | null = null;
  if (otherRoom) {
    const crossIdea = await prisma.idea.findFirst({ where: { roomId: otherRoom.id } });
    if (crossIdea) {
      crossRoomIdeaId = crossIdea.id;
    } else {
      // Create a test idea in other room
      const dummyTeam = await prisma.team.create({
        data: {
          teamId: `TEST-CROSS-${Date.now()}`,
          name: 'Dummy Cross Team',
          submissionId: `PNP-CROSS-${Date.now()}`,
          roomId: otherRoom.id,
        },
      });
      const dummyIdea = await prisma.idea.create({
        data: {
          anonymousId: `IDEA-X-${Date.now()}`.slice(0, 10),
          title: 'Cross Room Dummy Idea',
          track: 'INNOVATION',
          categoryTag: 'TECH',
          problemStatement: 'Problem',
          solution: 'Solution',
          innovation: 'Innovation',
          impact: 'Impact',
          whyInvest: 'Why',
          technology: 'Tech',
          status: 'APPROVED',
          teamId: dummyTeam.id,
          roomId: otherRoom.id,
        },
      });
      crossRoomIdeaId = dummyIdea.id;
    }
  }

  if (crossRoomIdeaId) {
    const resCross = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ideaId: crossRoomIdeaId, amount: 50 }),
    });
    const dataCross = await resCross.json();
    record(
      'Rule C: Cross-room investment rejected with HTTP 403',
      resCross.status === 403 && dataCross.code === 'CROSS_ROOM_INVESTMENT_FORBIDDEN',
      { status: resCross.status, code: dataCross.code, message: dataCross.message }
    );
  }

  // Rule E: Room PAUSED -> reject 403
  await prisma.room.update({
    where: { id: activeRoom.id },
    data: { status: 'PAUSED' },
  });
  const resPaused = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ideaId: peerIdea.id, amount: 50 }),
  });
  const dataPaused = await resPaused.json();
  record(
    'Rule E: Room PAUSED rejected with HTTP 403',
    resPaused.status === 403 && dataPaused.code === 'ROOM_PAUSED',
    { status: resPaused.status, code: dataPaused.code, message: dataPaused.message }
  );

  // Rule F: Room CLOSED -> reject 403
  await prisma.room.update({
    where: { id: activeRoom.id },
    data: { status: 'CLOSED' },
  });
  const resClosed = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ideaId: peerIdea.id, amount: 50 }),
  });
  const dataClosed = await resClosed.json();
  record(
    'Rule F: Room CLOSED rejected with HTTP 403',
    resClosed.status === 403 && dataClosed.code === 'ROOM_CLOSED',
    { status: resClosed.status, code: dataClosed.code, message: dataClosed.message }
  );

  // Restore room status to OPEN
  await prisma.room.update({
    where: { id: activeRoom.id },
    data: { status: 'OPEN' },
  });

  // Rule D: ABC with no room assignment -> reject
  // Temporarily unassign ABC
  await prisma.team.update({
    where: { id: teamABC.id },
    data: { roomId: null },
  });
  await prisma.user.update({
    where: { id: abcUser.id },
    data: { roomId: null },
  });

  const resNoRoom = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ideaId: peerIdea.id, amount: 50 }),
  });
  const dataNoRoom = await resNoRoom.json();
  record(
    'Rule D: Unassigned team investment rejected with HTTP 403',
    resNoRoom.status === 403 && dataNoRoom.code === 'NO_ROOM_ASSIGNED',
    { status: resNoRoom.status, code: dataNoRoom.code, message: dataNoRoom.message }
  );

  // Restore ABC assignment back to activeRoom
  await prisma.team.update({
    where: { id: teamABC.id },
    data: { roomId: activeRoom.id },
  });
  await prisma.user.update({
    where: { id: abcUser.id },
    data: { roomId: activeRoom.id },
  });

  // -------------------------------------------------------------
  // STEP 9: ADMIN ASSIGNMENT / MOVE / UNASSIGN TRACE
  // -------------------------------------------------------------
  console.log('\n>>> STEP 9: ADMIN ASSIGNMENT / MOVE / UNASSIGN VERIFICATION');

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) throw new Error('Admin user not found');
  const adminSessionId = await createSession(adminUser.id);
  const adminHeaders = {
    Cookie: `pnp_session=${adminSessionId}`,
    'Content-Type': 'application/json',
  };

  // Test admin moving ABC between rooms (create a temporary draft room)
  const draftRoom = await prisma.room.create({
    data: {
      name: `Test Target Room ${Date.now()}`,
      code: `TR${Date.now()}`.slice(0, 10),
      status: 'DRAFT',
      eventId: activeEvent?.id,
    },
  });

  // Temporarily set activeRoom to DRAFT to allow move
  await prisma.room.update({ where: { id: activeRoom.id }, data: { status: 'DRAFT' } });

  const resMove = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      teamId: teamABC.id,
      roomId: draftRoom.id,
    }),
  });
  const dataMove = await resMove.json();
  record(
    'Admin assigns ABC -> draftRoom succeeds',
    resMove.status === 200 && dataMove.success === true,
    dataMove.message
  );

  // Verify context resolver sees new room
  const resContextMoved = await fetch(`${BASE_URL}/api/me/context`, { headers });
  const dataContextMoved = await resContextMoved.json();
  const movedRoomId = dataContextMoved.context?.roomId || dataContextMoved.context?.room?.id;
  record(
    'Authoritative context resolver immediately reflects moved room',
    movedRoomId === draftRoom.id,
    `Resolved: ${movedRoomId}, Target: ${draftRoom.id}`
  );

  // Move back to activeRoom
  const resMoveBack = await fetch(`${BASE_URL}/api/admin/rooms/assign`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      teamId: teamABC.id,
      roomId: activeRoom.id,
    }),
  });
  await resMoveBack.json();

  // Restore activeRoom to OPEN
  await prisma.room.update({ where: { id: activeRoom.id }, data: { status: 'OPEN' } });

  // Delete draftRoom
  await prisma.room.delete({ where: { id: draftRoom.id } }).catch(() => {});

  // -------------------------------------------------------------
  // STEP 10: CACHE / STALE STATE RESILIENCE
  // -------------------------------------------------------------
  console.log('\n>>> STEP 10: CACHE / STALE STATE RESILIENCE');

  // Verify relogin and re-fetch
  const reloginSessionId = await createSession(abcUser.id);
  const reloginHeaders = {
    Cookie: `pnp_session=${reloginSessionId}`,
    'Content-Type': 'application/json',
  };

  const resReloginContext = await fetch(`${BASE_URL}/api/me/context`, { headers: reloginHeaders });
  const dataReloginContext = await resReloginContext.json();
  const reloginRoomId = dataReloginContext.context?.roomId || dataReloginContext.context?.room?.id;
  record(
    'Context correct after fresh session login',
    reloginRoomId === activeRoom.id,
    `Resolved roomId: ${reloginRoomId}`
  );

  const resReloginIdeas = await fetch(`${BASE_URL}/api/ideas`, { headers: reloginHeaders });
  const dataReloginIdeas = await resReloginIdeas.json();
  record(
    'Ideas endpoint correct after fresh session login',
    dataReloginIdeas.room?.id === activeRoom.id && dataReloginIdeas.ideas?.length > 0,
    `Ideas count: ${dataReloginIdeas.ideas?.length}`
  );

  // Clean up test investment
  await prisma.investment.deleteMany({
    where: { investorId: abcUser.id, amount: { in: [30, 50] } },
  });
  await prisma.wallet.update({
    where: { userId: abcUser.id },
    data: { totalCoins: 500, investedCoins: 0, availableCoins: 500 },
  });

  // Clean up sessions
  await prisma.session.deleteMany({ where: { id: { in: [sessionId, adminSessionId, reloginSessionId] } } });

  // Summary
  console.log('\n================================================================');
  console.log('                      VERIFICATION SUMMARY                      ');
  console.log('================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Results: ${passedCount}/${totalCount} checks passed.`);

  if (passedCount !== totalCount) {
    console.error('❌ Some verification checks failed!');
    process.exit(1);
  } else {
    console.log('✅ ALL ACCEPTANCE & SECURITY CHECKS PASSED PERFECTLY!');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
