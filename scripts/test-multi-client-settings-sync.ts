import { prisma } from '../lib/prisma';
import { createDatabaseSession } from '../lib/auth/session';

const BASE_URL = 'http://127.0.0.1:3000';

async function main() {
  console.log('============================================================');
  console.log('MULTI-CLIENT HTTP SETTINGS & WALLET PROPAGATION TEST');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  [✅ PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [❌ FAIL] ${description}`);
      failed++;
    }
  }

  // 1. Get or create sessions for Admin, Participant 1 (EcoPulse), and Participant 2 (MediBridge)
  const adminUser = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
  const participant1 = await prisma.user.findFirstOrThrow({ where: { email: 'kavya.ecopulse@student.tce.edu' } });
  const participant2 = await prisma.user.findFirstOrThrow({ where: { email: 'rohan.medibridge@student.tce.edu' } });

  const adminSessionId = await createDatabaseSession(adminUser.id);
  const p1SessionId = await createDatabaseSession(participant1.id);
  const p2SessionId = await createDatabaseSession(participant2.id);

  const adminCookie = `pnp_session=${adminSessionId}`;
  const p1Cookie = `pnp_session=${p1SessionId}`;
  const p2Cookie = `pnp_session=${p2SessionId}`;

  // Reset event to baseline
  const activeEvt = await prisma.event.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
  await prisma.event.update({
    where: { id: activeEvt.id },
    data: {
      status: 'OPEN',
      totalCoins: 100,
      minInvestment: 10,
      maxInvestment: 50,
    },
  });

  // Reset wallets to baseline
  await prisma.investment.deleteMany({ where: { investorId: participant1.id } });
  await prisma.investment.deleteMany({ where: { investorId: participant2.id } });
  await prisma.wallet.update({ where: { userId: participant1.id }, data: { totalCoins: 100, availableCoins: 100, investedCoins: 0 } });
  await prisma.wallet.update({ where: { userId: participant2.id }, data: { totalCoins: 100, availableCoins: 100, investedCoins: 0 } });

  console.log('--- 1. VERIFY PARTICIPANTS INITIAL HTTP STATE ---');
  const me1Res = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: p1Cookie } });
  const me1Data = await me1Res.json();
  assert(me1Data.authenticated && me1Data.user.wallet.totalBudget === 100, 'Participant 1 /api/auth/me returns totalBudget: 100');
  assert(me1Data.user.wallet.remaining === 100, 'Participant 1 /api/auth/me returns remaining: 100');

  const me2Res = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: p2Cookie } });
  const me2Data = await me2Res.json();
  assert(me2Data.authenticated && me2Data.user.wallet.totalBudget === 100, 'Participant 2 /api/auth/me returns totalBudget: 100');
  assert(me2Data.user.wallet.remaining === 100, 'Participant 2 /api/auth/me returns remaining: 100');

  console.log('\n--- 2. PARTICIPANT 1 INVESTS 25 COINS AT BASELINE ---');
  const targetIdea = await prisma.idea.findFirstOrThrow({
    where: { team: { teamId: 'CSEA-102' }, status: 'APPROVED' },
  });

  const invRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: p1Cookie },
    body: JSON.stringify({ ideaId: targetIdea.id, amount: 25 }),
  });
  const invData = await invRes.json();
  assert(invData.success, 'Participant 1 investment of 25 coins succeeded');
  assert(invData.wallet.remaining === 75, 'Participant 1 remaining balance is 75 (100 - 25)');
  assert(invData.wallet.allocated === 25, 'Participant 1 allocated balance is 25');

  console.log('\n--- 3. ADMIN PATCHES SETTINGS: 100 -> 200 (MIN: 20, MAX: 100) ---');
  const patchRes = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      totalCoins: 200,
      minInvestment: 20,
      maxInvestment: 100,
    }),
  });
  const patchData = await patchRes.json();
  assert(patchData.success, 'Admin PATCH /api/admin/event/settings returned 200 OK');
  assert(patchData.settings.totalCoins === 200, 'Settings API response totalCoins is 200');

  // Verify /api/event reflects new parameters immediately
  const eventRes = await fetch(`${BASE_URL}/api/event`);
  const eventData = await eventRes.json();
  assert(eventData.event.totalBudget === 200, '/api/event returns updated totalBudget: 200');
  assert(eventData.event.minPerIdea === 20, '/api/event returns updated minPerIdea: 20');
  assert(eventData.event.maxPerIdea === 100, '/api/event returns updated maxPerIdea: 100');

  // Verify Participant 1 wallet via HTTP
  const p1UpdatedRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: p1Cookie } });
  const p1UpdatedData = await p1UpdatedRes.json();
  assert(p1UpdatedData.user.wallet.totalBudget === 200, 'Participant 1 /api/auth/me totalBudget is 200');
  assert(p1UpdatedData.user.wallet.allocated === 25, 'Participant 1 /api/auth/me allocated remains 25');
  assert(p1UpdatedData.user.wallet.remaining === 175, 'Participant 1 /api/auth/me remaining is 175 (200 - 25)');

  // Verify Participant 2 wallet via HTTP
  const p2UpdatedRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: p2Cookie } });
  const p2UpdatedData = await p2UpdatedRes.json();
  assert(p2UpdatedData.user.wallet.totalBudget === 200, 'Participant 2 /api/auth/me totalBudget is 200');
  assert(p2UpdatedData.user.wallet.remaining === 200, 'Participant 2 /api/auth/me remaining is 200');

  console.log('\n--- 4. ADMIN PATCHES SETTINGS AGAIN: 200 -> 300 (MIN: 30, MAX: 150) ---');
  const patch2Res = await fetch(`${BASE_URL}/api/admin/event/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      totalCoins: 300,
      minInvestment: 30,
      maxInvestment: 150,
    }),
  });
  const patch2Data = await patch2Res.json();
  assert(patch2Data.success, 'Second Admin PATCH returned 200 OK');

  const p1FinalRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: p1Cookie } });
  const p1FinalData = await p1FinalRes.json();
  assert(p1FinalData.user.wallet.totalBudget === 300, 'Participant 1 totalBudget is 300');
  assert(p1FinalData.user.wallet.remaining === 275, 'Participant 1 remaining is 275 (300 - 25)');

  console.log('\n--- 5. SERVER INVESTMENT VALIDATION AGAINST NEW LIMITS (30..150) ---');
  // Attempt below min (20 < 30)
  const rejMinRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: p1Cookie },
    body: JSON.stringify({ ideaId: targetIdea.id, amount: 20 }),
  });
  const rejMinData = await rejMinRes.json();
  assert(!rejMinRes.ok && rejMinData.code === 'BELOW_MINIMUM', 'Server rejected 20 coins with BELOW_MINIMUM (min is 30)');

  // Attempt above max (170 > 150)
  const rejMaxRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: p1Cookie },
    body: JSON.stringify({ ideaId: targetIdea.id, amount: 170 }),
  });
  const rejMaxData = await rejMaxRes.json();
  assert(!rejMaxRes.ok && rejMaxData.code === 'EXCEEDS_MAXIMUM', 'Server rejected 170 coins with EXCEEDS_MAXIMUM (max is 150)');

  // Valid investment (60 coins)
  const validRes = await fetch(`${BASE_URL}/api/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: p1Cookie },
    body: JSON.stringify({ ideaId: targetIdea.id, amount: 60 }),
  });
  const validData = await validRes.json();
  assert(validRes.ok && validData.success, 'Server accepted 60 coins deployment within active bounds');
  assert(validData.wallet.remaining === 215, 'Participant 1 wallet remaining is 215 (275 - 60)');
  assert(validData.wallet.allocated === 85, 'Participant 1 wallet allocated is 85 (25 + 60)');

  console.log('\n============================================================');
  console.log(`MULTI-CLIENT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().finally(() => prisma.$disconnect());
