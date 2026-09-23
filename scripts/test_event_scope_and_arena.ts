import { prisma } from '../lib/prisma';

const BASE_URL = 'http://localhost:3000';

async function login(email: string, password = 'Demo@2024'): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Login failed for ${email}: ${data.message || res.statusText}`);
  }

  const cookieHeader = res.headers.get('set-cookie') || '';
  const match = cookieHeader.match(/pnp_session=([^;]+)/);
  if (!match) throw new Error(`Could not extract session cookie for ${email}`);
  return `pnp_session=${match[1]}`;
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE ARCHITECTURAL & ARENA TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // Obtain logins
    console.log('--- 1. Authenticating test personas ---');
    const adminCookie = await login('pradeshkannan64@gmail.com', 'pradesh@2006K');
    const abcLeaderCookie = await login('pradesh@student.tce.edu', 'pradesh@2006K'); // ABC in Pitch
    const ecoPulseLeaderCookie = await login('kavya.ecopulse@student.tce.edu', 'Demo@2024'); // EcoPulse in Pitch
    const mediBridgeLeaderCookie = await login('rohan.medibridge@student.tce.edu', 'Demo@2024'); // MediBridge in Room A
    const investorCookie = await login('investor.test@csea.edu', 'Investor@2024'); // Investor (no team)
    console.log('All test personas authenticated successfully.\n');

    // TEST 1: Context Resolution - Investor without Team
    console.log('--- 2. Testing Context Resolution ---');
    const resInvestorContext = await fetch(`${BASE_URL}/api/me/context`, {
      headers: { Cookie: investorCookie },
    });
    const dataInvestor = await resInvestorContext.json();
    assert(
      dataInvestor.success && dataInvestor.context?.state === 'TEAM_NOT_ASSIGNED',
      'Investor without team resolves status: TEAM_NOT_ASSIGNED',
      JSON.stringify(dataInvestor)
    );

    // TEST 2: Context Resolution - ABC Leader in Pitch
    const resAbcContext = await fetch(`${BASE_URL}/api/me/context`, {
      headers: { Cookie: abcLeaderCookie },
    });
    const dataAbc = await resAbcContext.json();
    assert(
      dataAbc.success &&
      dataAbc.context?.state === 'AUTHORIZED' &&
      dataAbc.context?.team?.name === 'ABC' &&
      dataAbc.context?.room?.name === 'Pitch',
      'ABC Leader resolves AUTHORIZED with team ABC and room Pitch',
      JSON.stringify(dataAbc)
    );
    assert(
      typeof dataAbc.context?.event?.totalCoins === 'number' &&
      typeof dataAbc.context?.event?.minInvestment === 'number' &&
      typeof dataAbc.context?.event?.maxInvestment === 'number',
      'Participant context includes event-global coin bounds'
    );

    // TEST 3: Context Resolution - MediBridge Leader in Room A
    const resMediContext = await fetch(`${BASE_URL}/api/me/context`, {
      headers: { Cookie: mediBridgeLeaderCookie },
    });
    const dataMedi = await resMediContext.json();
    assert(
      dataMedi.success &&
      dataMedi.context?.state === 'AUTHORIZED' &&
      dataMedi.context?.team?.name === 'MediBridge' &&
      dataMedi.context?.room?.name === 'Room A',
      'MediBridge Leader resolves AUTHORIZED with team MediBridge and room Room A',
      JSON.stringify(dataMedi)
    );

    // TEST 4: Arena Ideas Gating for EcoPulse Leader (Pitch Room)
    console.log('\n--- 3. Testing Arena Ideas Gating & Isolation ---');
    const resEcoIdeas = await fetch(`${BASE_URL}/api/ideas`, {
      headers: { Cookie: ecoPulseLeaderCookie },
    });
    const dataEcoIdeas = await resEcoIdeas.json();
    assert(dataEcoIdeas.success === true, 'GET /api/ideas returns success for EcoPulse leader');
    
    // EcoPulse is in Pitch alongside ABC. Investable list must have ABC and NOT EcoPulse, nor Room A ideas.
    const ecoReturnedIdeas = dataEcoIdeas.ideas || [];
    const hasAbc = ecoReturnedIdeas.some((i: any) => i.title.includes('ABC') || i.categoryTag === 'ABC');
    const hasEcoPulse = ecoReturnedIdeas.some((i: any) => i.title.toLowerCase().includes('microgrid') || i.categoryTag === 'EcoPulse');
    const hasMediBridge = ecoReturnedIdeas.some((i: any) => i.title.toLowerCase().includes('telemetry') || i.categoryTag === 'MediBridge');
    const hasTransitIQ = ecoReturnedIdeas.some((i: any) => i.title.toLowerCase().includes('transit') || i.categoryTag === 'TransitIQ');

    assert(hasAbc, 'EcoPulse sees peer idea from room Pitch (ABC)');
    assert(!hasEcoPulse, 'EcoPulse does NOT see its own idea in investable ideas list');
    assert(!hasMediBridge, 'EcoPulse does NOT see ideas from other room (MediBridge in Room A)');
    assert(!hasTransitIQ, 'EcoPulse does NOT see ideas from other room (TransitIQ in Room A)');

    // TEST 5: Arena Diagnostics Returned
    assert(
      dataEcoIdeas.diagnostics &&
      dataEcoIdeas.diagnostics.roomTeamsCount === 2 &&
      dataEcoIdeas.diagnostics.investableIdeasCount === 1,
      'Arena returns verified diagnostics (roomTeamsCount: 2, investableIdeasCount: 1)',
      JSON.stringify(dataEcoIdeas.diagnostics)
    );

    // TEST 6: Client Room Tamper Protection
    // EcoPulse participant tries to supply ?roomId=<Room A ID>
    const roomARecord = await prisma.room.findFirst({ where: { name: 'Room A' } });
    const tamperRes = await fetch(`${BASE_URL}/api/ideas?roomId=${roomARecord?.id}`, {
      headers: { Cookie: ecoPulseLeaderCookie },
    });
    const dataTamper = await tamperRes.json();
    const tamperHasMediBridge = (dataTamper.ideas || []).some((i: any) => i.title.toLowerCase().includes('telemetry'));
    assert(
      !tamperHasMediBridge && dataTamper.room?.name === 'Pitch',
      'Participant supplying arbitrary ?roomId= is overridden by server to participant authoritative room (Pitch)'
    );

    // TEST 7: Cross-Room Investment Rejection
    console.log('\n--- 4. Testing Investment Authorization & Bounds ---');
    // Find MediBridge's idea (belongs to Room A)
    const mediBridgeIdea = await prisma.idea.findFirst({
      where: { team: { name: 'MediBridge' } },
    });
    if (!mediBridgeIdea) throw new Error('MediBridge idea not found in DB');

    // EcoPulse participant (Pitch) tries to invest in MediBridge idea (Room A)
    const crossRoomInvestRes = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ecoPulseLeaderCookie },
      body: JSON.stringify({ ideaId: mediBridgeIdea.id, amount: 100 }),
    });
    const crossInvestData = await crossRoomInvestRes.json();
    assert(
      crossRoomInvestRes.status === 403 && crossInvestData.code === 'CROSS_ROOM_INVESTMENT_FORBIDDEN',
      'Cross-room investment is blocked with HTTP 403 CROSS_ROOM_INVESTMENT_FORBIDDEN',
      `Got status ${crossRoomInvestRes.status}: ${JSON.stringify(crossInvestData)}`
    );

    // TEST 8: Own-Team Investment Rejection
    const ecoPulseIdea = await prisma.idea.findFirst({
      where: { team: { name: 'EcoPulse' } },
    });
    if (!ecoPulseIdea) throw new Error('EcoPulse idea not found in DB');

    const ownInvestRes = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ecoPulseLeaderCookie },
      body: JSON.stringify({ ideaId: ecoPulseIdea.id, amount: 100 }),
    });
    const ownInvestData = await ownInvestRes.json();
    assert(
      ownInvestRes.status === 403 && ownInvestData.code === 'OWN_TEAM_INVESTMENT_FORBIDDEN',
      'Self-investment in own idea is blocked with HTTP 403 OWN_TEAM_INVESTMENT_FORBIDDEN',
      `Got status ${ownInvestRes.status}: ${JSON.stringify(ownInvestData)}`
    );

    // TEST 9: Investment Bounds Gating (Below Min & Above Max)
    const abcIdea = await prisma.idea.findFirst({
      where: { team: { name: 'ABC' } },
    });
    if (!abcIdea) throw new Error('ABC idea not found in DB');

    // Try investing below min (e.g., 5 coins when min is 50)
    const belowMinRes = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ecoPulseLeaderCookie },
      body: JSON.stringify({ ideaId: abcIdea.id, amount: 5 }),
    });
    assert(belowMinRes.status === 400, 'Investment below minInvestment is rejected with HTTP 400');

    // Try investing above max (e.g., 900 coins when max is 500)
    const aboveMaxRes = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ecoPulseLeaderCookie },
      body: JSON.stringify({ ideaId: abcIdea.id, amount: 900 }),
    });
    assert(aboveMaxRes.status === 400, 'Investment above maxInvestment is rejected with HTTP 400');

    // TEST 10: Cross-Room Results Snooping Gating
    console.log('\n--- 5. Testing Results Isolation & Snooping Gating ---');
    const snoopingResultsRes = await fetch(`${BASE_URL}/api/results?roomId=${roomARecord?.id}`, {
      headers: { Cookie: ecoPulseLeaderCookie },
    });
    const snoopingData = await snoopingResultsRes.json();
    assert(
      snoopingResultsRes.status === 403 && snoopingData.code === 'CROSS_ROOM_RESULTS_FORBIDDEN',
      'Participant attempting to view another room results is rejected with HTTP 403 CROSS_ROOM_RESULTS_FORBIDDEN',
      `Got status ${snoopingResultsRes.status}: ${JSON.stringify(snoopingData)}`
    );

    // TEST 11: Admin Global Event Settings Modification & Immediate Propagation
    console.log('\n--- 6. Testing Event-Global Settings Propagation ---');
    const origEvent = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
    const origTotalCoins = origEvent?.totalCoins ?? 1000;
    const origMin = origEvent?.minInvestment ?? 50;
    const origMax = origEvent?.maxInvestment ?? 500;

    // Admin updates event settings
    const updateRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        totalCoins: 1250,
        minInvestment: 75,
        maxInvestment: 600,
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.ok && updateData.success, 'Admin updates global event settings successfully');

    // Participant in Pitch immediately gets updated bounds without room reset
    const updatedContextRes = await fetch(`${BASE_URL}/api/me/context`, {
      headers: { Cookie: abcLeaderCookie },
    });
    const updatedContext = await updatedContextRes.json();
    assert(
      updatedContext.context?.event?.totalCoins === 1250 &&
      updatedContext.context?.event?.minInvestment === 75 &&
      updatedContext.context?.event?.maxInvestment === 600,
      'Participant context instantly reflects new event-global coin bounds (1250/75/600)'
    );

    // Restore original event settings
    await fetch(`${BASE_URL}/api/admin/event/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        totalCoins: origTotalCoins,
        minInvestment: origMin,
        maxInvestment: origMax,
      }),
    });
    console.log('Restored original event configuration.');

    // TEST 12: Admin Results Overview API
    console.log('\n--- 7. Testing Admin Results Overview & Room Diagnostics ---');
    const adminResultsRes = await fetch(`${BASE_URL}/api/admin/results`, {
      headers: { Cookie: adminCookie },
    });
    const adminResultsData = await adminResultsRes.json();
    assert(
      adminResultsData.success &&
      adminResultsData.overview &&
      adminResultsData.overview.totalRooms >= 2 &&
      adminResultsData.overview.totalTeams >= 4 &&
      adminResultsData.overview.totalIdeas >= 4,
      'Admin results API returns global overview metrics (totalRooms, totalTeams, totalIdeas, totalCoinsInvested)',
      JSON.stringify(adminResultsData.overview)
    );

    assert(
      Array.isArray(adminResultsData.allRooms) &&
      adminResultsData.allRooms.some((r: any) => r.name === 'Pitch' && ['DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'REVEALED'].includes(r.status)),
      'Admin results API returns allRooms with live operational status'
    );

    // TEST 13: Room Detail Arena Readiness Diagnostics
    const pitchRoom = await prisma.room.findFirst({ where: { name: 'Pitch' } });
    if (pitchRoom) {
      const roomDetailRes = await fetch(`${BASE_URL}/api/admin/rooms/${pitchRoom.id}`, {
        headers: { Cookie: adminCookie },
      });
      const roomDetailData = await roomDetailRes.json();
      assert(
        roomDetailData.success &&
        roomDetailData.diagnostics &&
        roomDetailData.diagnostics.teamsCount === 2 &&
        roomDetailData.diagnostics.ideasCount === 2 &&
        roomDetailData.diagnostics.approvedIdeasCount === 2,
        'Admin Room Detail API returns Arena Readiness Diagnostics (teamsCount: 2, ideasCount: 2, approvedIdeasCount: 2)',
        JSON.stringify(roomDetailData.diagnostics)
      );
    }

  } catch (err: any) {
    console.error('Fatal error during test suite execution:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTestSuite();
