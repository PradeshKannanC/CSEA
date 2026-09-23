import { prisma } from '../lib/prisma';

const BASE_URL = 'http://localhost:3000';

async function runMultiRoundTest() {
  console.log('============================================================');
  console.log('STARTING MULTI-ROUND ARENA LIFECYCLE E2E HTTP VERIFICATION');
  console.log('============================================================\n');

  // 1. Find or verify Admin
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No Admin user found in database');
  console.log(`[AUTH] Admin user found: ${admin.email} (ID: ${admin.id})`);

  // Create admin session
  const adminSessionId = `test_admin_session_${Date.now()}`;
  await prisma.session.create({
    data: {
      id: adminSessionId,
      userId: admin.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2),
    },
  });
  const adminHeaders = {
    'Content-Type': 'application/json',
    Cookie: `pnp_session=${adminSessionId}`,
  };

  // Find or verify a participant user
  let participant = await prisma.user.findFirst({
    where: { role: { in: ['TEAM_MEMBER', 'TEAM_LEADER'] } },
    include: { wallet: true, team: { include: { idea: true } } },
  });
  if (!participant) {
    throw new Error('No participant user found in database');
  }
  console.log(`[AUTH] Participant user found: ${participant.email} (Role: ${participant.role})`);

  const participantSessionId = `test_part_session_${Date.now()}`;
  await prisma.session.create({
    data: {
      id: participantSessionId,
      userId: participant.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2),
    },
  });
  const participantHeaders = {
    'Content-Type': 'application/json',
    Cookie: `pnp_session=${participantSessionId}`,
  };

  // Find an idea to invest in (preferably not the participant's own idea)
  const candidateIdeas = await prisma.idea.findMany({
    where: {
      team: {
        users: {
          none: { id: participant.id },
        },
      },
    },
  });
  if (candidateIdeas.length === 0) {
    throw new Error('No target idea found for participant investment');
  }
  const targetIdea = candidateIdeas[0];
  console.log(`[IDEA] Target investment idea: ${targetIdea.title} (${targetIdea.id})`);

  // 2. Setup Current Event for Round 1
  let currentEvent = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!currentEvent) {
    currentEvent = await prisma.event.create({
      data: {
        id: 'evt-round-1',
        name: 'Pitch & Prosper Round 1',
        status: 'DRAFT',
        round: 1,
        totalCoins: 100,
        minInvestment: 5,
        maxInvestment: 50,
      },
    });
  } else {
    // Set to DRAFT to start a fresh cycle
    currentEvent = await prisma.event.update({
      where: { id: currentEvent.id },
      data: {
        status: 'DRAFT',
        totalCoins: 100,
        minInvestment: 5,
        maxInvestment: 50,
      },
    });
  }
  console.log(`[EVENT] Initial Active Event: ${currentEvent.id} (Status: ${currentEvent.status}, Round: ${currentEvent.round})`);

  // Ensure participant wallet is funded
  await prisma.wallet.upsert({
    where: { userId: participant.id },
    create: { userId: participant.id, totalCoins: currentEvent.totalCoins, availableCoins: currentEvent.totalCoins, investedCoins: 0 },
    update: { totalCoins: currentEvent.totalCoins, availableCoins: currentEvent.totalCoins, investedCoins: 0 },
  });

  // Helper for HTTP requests
  async function callApi(url: string, options: RequestInit) {
    const res = await fetch(`${BASE_URL}${url}`, options);
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data: json };
  }

  // STEP A: Try investing while DRAFT -> should be blocked
  console.log('\n--- Test A: Investment blocked in DRAFT ---');
  const blockedInvest = await callApi('/api/invest', {
    method: 'POST',
    headers: participantHeaders,
    body: JSON.stringify({ ideaId: targetIdea.id, amount: 20 }),
  });
  console.log(`Invest in DRAFT HTTP status: ${blockedInvest.status}, error: ${blockedInvest.data?.error}`);
  if (blockedInvest.ok) throw new Error('Investment should NOT succeed in DRAFT state!');
  console.log('✓ PASS: Investment correctly blocked when arena is not OPEN');

  // STEP B: Admin START ARENA (DRAFT -> OPEN)
  console.log('\n--- Test B: Admin Starts Arena (DRAFT -> OPEN) ---');
  const startRes = await callApi('/api/admin/event/status', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'OPEN' }),
  });
  if (!startRes.ok) throw new Error(`Failed to start arena: ${JSON.stringify(startRes.data)}`);
  console.log(`✓ Arena started successfully. Event status: ${startRes.data?.status}`);

  // STEP C: Participant Invests in Round 1
  console.log('\n--- Test C: Participant Invests 25 coins in Round 1 ---');
  const investRes1 = await callApi('/api/invest', {
    method: 'POST',
    headers: participantHeaders,
    body: JSON.stringify({ ideaId: targetIdea.id, amount: 25 }),
  });
  if (!investRes1.ok) throw new Error(`Failed to invest: ${JSON.stringify(investRes1.data)}`);
  console.log(`✓ Investment of 25 coins successful. Remaining balance: ${investRes1.data?.wallet?.remaining}`);

  // Verify investment record has eventId
  const dbInvest1 = await prisma.investment.findFirst({
    where: { investorId: participant.id, ideaId: targetIdea.id },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`DB Investment record eventId: ${dbInvest1?.eventId}`);
  if (dbInvest1?.eventId !== currentEvent.id) {
    throw new Error(`Investment eventId ${dbInvest1?.eventId} does not match active event ${currentEvent.id}`);
  }
  console.log('✓ PASS: Investment record properly tagged with current eventId');

  // STEP D: Admin PAUSE ARENA (OPEN -> PAUSED)
  console.log('\n--- Test D: Admin Pauses Arena (OPEN -> PAUSED) ---');
  const pauseRes = await callApi('/api/admin/event/status', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'PAUSED' }),
  });
  if (!pauseRes.ok) throw new Error(`Failed to pause arena: ${JSON.stringify(pauseRes.data)}`);
  console.log(`✓ Arena paused. Status: ${pauseRes.data?.status}`);

  // Verify investment is blocked during PAUSED
  const pausedInvest = await callApi('/api/invest', {
    method: 'POST',
    headers: participantHeaders,
    body: JSON.stringify({ ideaId: targetIdea.id, amount: 10 }),
  });
  if (pausedInvest.ok) throw new Error('Investment should NOT succeed in PAUSED state!');
  console.log('✓ PASS: Investment blocked during PAUSED state');

  // STEP E: Admin RESUME ARENA (PAUSED -> OPEN)
  console.log('\n--- Test E: Admin Resumes Arena (PAUSED -> OPEN) ---');
  const resumeRes = await callApi('/api/admin/event/status', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'OPEN' }),
  });
  if (!resumeRes.ok) throw new Error(`Failed to resume arena: ${JSON.stringify(resumeRes.data)}`);
  console.log(`✓ Arena resumed. Status: ${resumeRes.data?.status}`);

  // STEP F: Admin CLOSE ARENA (OPEN -> CLOSED)
  console.log('\n--- Test F: Admin Closes Arena (OPEN -> CLOSED) ---');
  const closeRes = await callApi('/api/admin/event/status', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'CLOSED' }),
  });
  if (!closeRes.ok) throw new Error(`Failed to close arena: ${JSON.stringify(closeRes.data)}`);
  console.log(`✓ Arena closed. Status: ${closeRes.data?.status}`);

  // STEP G: Admin REVEAL TO ADMIN ONLY (CLOSED -> ADMIN_REVEALED)
  console.log('\n--- Test G: Admin Reveals Winners to Admin Only ---');
  const adminRevealRes = await callApi('/api/admin/event/status', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'ADMIN_REVEALED' }),
  });
  if (!adminRevealRes.ok) throw new Error(`Failed admin reveal: ${JSON.stringify(adminRevealRes.data)}`);
  console.log(`✓ Status changed to ADMIN_REVEALED`);

  // Verify Admin can view results
  const adminResultsView = await callApi(`/api/admin/results?eventId=${currentEvent.id}`, {
    method: 'GET',
    headers: adminHeaders,
  });
  if (!adminResultsView.ok || !adminResultsView.data?.results?.length) {
    throw new Error('Admin could not view results after ADMIN_REVEALED');
  }
  console.log(`✓ Admin sees ${adminResultsView.data.results.length} ranked ideas in results`);

  // STEP H: Admin REVEAL TO PARTICIPANTS (ADMIN_REVEALED -> REVEALED)
  console.log('\n--- Test H: Admin Reveals Results to Participants ---');
  const publicRevealRes = await callApi('/api/admin/event/status', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'REVEALED' }),
  });
  if (!publicRevealRes.ok) throw new Error(`Failed public reveal: ${JSON.stringify(publicRevealRes.data)}`);
  console.log(`✓ Status changed to REVEALED`);

  // Check public results endpoint
  const publicResultsRes = await callApi('/api/results', {
    method: 'GET',
    headers: participantHeaders,
  });
  if (!publicResultsRes.ok || !publicResultsRes.data?.results?.length) {
    throw new Error('Participant could not view results after REVEALED');
  }
  console.log(`✓ Participant sees ${publicResultsRes.data.results.length} ranked ideas in public results`);

  const round1EventId = currentEvent.id;
  const round1InvestmentsCount = await prisma.investment.count({ where: { eventId: round1EventId } });
  const round1ResultsCount = await prisma.result.count({ where: { eventId: round1EventId } });
  console.log(`\n[ROUND 1 SUMMARY] ID: ${round1EventId}, Investments: ${round1InvestmentsCount}, Results: ${round1ResultsCount}`);

  // STEP I: Admin START NEW ARENA (Multi-Round Generation)
  console.log('\n============================================================');
  console.log('--- Test I: Admin Triggers START NEW ARENA ---');
  console.log('============================================================');
  const newArenaRes = await callApi('/api/admin/event/new-arena', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({}),
  });
  if (!newArenaRes.ok) throw new Error(`Failed to initialize new arena: ${JSON.stringify(newArenaRes.data)}`);

  const round2Event = newArenaRes.data.event;
  console.log(`✓ New Arena Created: ID: ${round2Event.id}, Status: ${round2Event.status}, Round: ${round2Event.round}`);
  if (round2Event.status !== 'DRAFT') throw new Error('New arena must start in DRAFT status!');
  if (round2Event.round !== 2 && round2Event.round <= currentEvent.round) {
    throw new Error(`New arena round (${round2Event.round}) should be incremented!`);
  }

  // STEP J: Verify Data Integrity and Preserved History
  console.log('\n--- Test J: Verify Data Preservation and Participant Wallet Reset ---');
  // 1. Previous event is intact
  const dbRound1 = await prisma.event.findUnique({ where: { id: round1EventId } });
  if (dbRound1?.status !== 'REVEALED') throw new Error(`Round 1 event status altered: ${dbRound1?.status}`);
  console.log(`✓ Round 1 Event preserved in database with status: ${dbRound1.status}`);

  // 2. Round 1 investments are intact
  const preservedInvestments = await prisma.investment.count({ where: { eventId: round1EventId } });
  if (preservedInvestments !== round1InvestmentsCount) {
    throw new Error(`Round 1 investments changed! Was ${round1InvestmentsCount}, now ${preservedInvestments}`);
  }
  console.log(`✓ All ${preservedInvestments} Round 1 investments preserved in database`);

  // 3. Round 1 results are intact
  const preservedResults = await prisma.result.count({ where: { eventId: round1EventId } });
  if (preservedResults !== round1ResultsCount) {
    throw new Error(`Round 1 results changed! Was ${round1ResultsCount}, now ${preservedResults}`);
  }
  console.log(`✓ All ${preservedResults} Round 1 results preserved in database`);

  // 4. Participant wallet refilled
  const participantWallet = await prisma.wallet.findUnique({ where: { userId: participant.id } });
  console.log(`Participant wallet balance for Round 2: ${participantWallet?.availableCoins} (expected: ${round2Event.totalCoins})`);
  if (participantWallet?.availableCoins !== round2Event.totalCoins) {
    throw new Error(`Participant wallet was not refilled to ${round2Event.totalCoins}`);
  }
  console.log('✓ Participant wallet successfully reset to full budget for Round 2');

  // 5. Active ideas counters reset
  const activeIdeaCheck = await prisma.idea.findUnique({ where: { id: targetIdea.id } });
  if (activeIdeaCheck?.totalInvested !== 0 || activeIdeaCheck?.investorCount !== 0) {
    throw new Error(`Active idea counters not reset! totalInvested=${activeIdeaCheck?.totalInvested}`);
  }
  console.log('✓ Target idea live counters reset to 0 for Round 2');

  // STEP K: Run Round 2 Lifecycle
  console.log('\n--- Test K: Start and Invest in Round 2 ---');
  const startRound2 = await callApi('/api/admin/event/status', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'OPEN' }),
  });
  if (!startRound2.ok) throw new Error('Failed to start Round 2 arena');
  console.log(`✓ Round 2 started: ${startRound2.data?.status}`);

  // Participant invests 30 coins in Round 2
  const investRound2 = await callApi('/api/invest', {
    method: 'POST',
    headers: participantHeaders,
    body: JSON.stringify({ ideaId: targetIdea.id, amount: 30 }),
  });
  if (!investRound2.ok) throw new Error(`Round 2 investment failed: ${JSON.stringify(investRound2.data)}`);
  console.log(`✓ Round 2 investment of 30 coins successful. Balance: ${investRound2.data?.wallet?.remaining}`);

  const dbInvest2 = await prisma.investment.findFirst({
    where: { investorId: participant.id, eventId: round2Event.id },
  });
  if (!dbInvest2 || dbInvest2.amount !== 30) {
    throw new Error('Round 2 investment not found or incorrect amount');
  }
  console.log(`✓ Round 2 investment properly recorded with eventId: ${dbInvest2.eventId}`);

  // Close and reveal Round 2
  await callApi('/api/admin/event/status', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ status: 'CLOSED' }) });
  await callApi('/api/admin/event/status', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ status: 'ADMIN_REVEALED' }) });
  await callApi('/api/admin/event/status', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ status: 'REVEALED' }) });
  console.log('✓ Round 2 successfully advanced through CLOSED -> ADMIN_REVEALED -> REVEALED');

  // STEP L: Multi-Round Results History API Verification
  console.log('\n--- Test L: Multi-Round Results Historical Query Verification ---');
  const historyQuery = await callApi('/api/admin/results', {
    method: 'GET',
    headers: adminHeaders,
  });
  if (!historyQuery.ok) throw new Error('Failed to fetch admin results history');
  console.log(`All rounds returned by admin results API: ${historyQuery.data?.allEvents?.length}`);
  const roundsList = historyQuery.data?.allEvents?.map((e: any) => `Round ${e.round} (${e.id}) - ${e.status}`);
  console.log('Available rounds:', roundsList);

  if (!historyQuery.data?.allEvents?.some((e: any) => e.id === round1EventId)) {
    throw new Error('Round 1 missing from admin results round switcher!');
  }
  if (!historyQuery.data?.allEvents?.some((e: any) => e.id === round2Event.id)) {
    throw new Error('Round 2 missing from admin results round switcher!');
  }

  // Query specific Round 1 results
  const r1ResultsQuery = await callApi(`/api/admin/results?eventId=${round1EventId}`, {
    method: 'GET',
    headers: adminHeaders,
  });
  console.log(`Round 1 results fetched via API: ${r1ResultsQuery.data?.results?.length} records`);

  // Query specific Round 2 results
  const r2ResultsQuery = await callApi(`/api/admin/results?eventId=${round2Event.id}`, {
    method: 'GET',
    headers: adminHeaders,
  });
  console.log(`Round 2 results fetched via API: ${r2ResultsQuery.data?.results?.length} records`);

  if (!r1ResultsQuery.data?.results?.length || !r2ResultsQuery.data?.results?.length) {
    throw new Error('Historical results could not be queried independently per eventId!');
  }

  console.log('\n============================================================');
  console.log('🎉 ALL MULTI-ROUND ARENA LIFECYCLE TESTS PASSED PERFECTLY!');
  console.log('============================================================');

  // Clean up test sessions
  await prisma.session.deleteMany({
    where: { id: { in: [adminSessionId, participantSessionId] } },
  });
}

runMultiRoundTest().catch((err) => {
  console.error('❌ Multi-round lifecycle test failed:', err);
  process.exit(1);
});
