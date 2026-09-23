import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

interface SecResult {
  num: number;
  test: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const results: SecResult[] = [];

function record(num: number, test: string, expected: string, actual: string, passed: boolean) {
  results.push({ num, test, expected, actual, passed });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] TEST ${num}: ${test}`);
  console.log(`       Expected: ${expected}`);
  console.log(`       Actual:   ${actual}\n`);
}

async function main() {
  console.log('============================================================');
  console.log('PHASE 24: 15-POINT CRITICAL SECURITY REGRESSION AUDIT');
  console.log('============================================================\n');

  const ts = Date.now();
  const cleanupUserIds: string[] = [];
  const cleanupTeamIds: string[] = [];
  const cleanupRoomIds: string[] = [];
  const cleanupSessionIds: string[] = [];

  try {
    // 1. Setup isolated test environment
    const roomA = await prisma.room.create({
      data: { name: `Sec Room A ${ts}`, code: `SRA${ts}`.slice(0, 10).toUpperCase(), status: 'OPEN' },
    });
    cleanupRoomIds.push(roomA.id);

    const roomB = await prisma.room.create({
      data: { name: `Sec Room B ${ts}`, code: `SRB${ts}`.slice(0, 10).toUpperCase(), status: 'OPEN' },
    });
    cleanupRoomIds.push(roomB.id);

    const team1 = await prisma.team.create({
      data: { teamId: `ST1${ts}`.slice(0, 10), name: `Sec Team 1 ${ts}`, submissionId: `SUB1-${ts}`, roomId: roomA.id },
    });
    cleanupTeamIds.push(team1.id);

    const team2 = await prisma.team.create({
      data: { teamId: `ST2${ts}`.slice(0, 10), name: `Sec Team 2 ${ts}`, submissionId: `SUB2-${ts}`, roomId: roomA.id },
    });
    cleanupTeamIds.push(team2.id);

    const team3 = await prisma.team.create({
      data: { teamId: `ST3${ts}`.slice(0, 10), name: `Sec Team 3 ${ts}`, submissionId: `SUB3-${ts}`, roomId: roomB.id },
    });
    cleanupTeamIds.push(team3.id);

    const idea1 = await prisma.idea.create({
      data: {
        anonymousId: `IDA1-${ts}`.slice(0, 10),
        teamId: team1.id,
        roomId: roomA.id,
        title: 'Idea Team 1',
        track: 'Tech',
        categoryTag: 'AI',
        problemStatement: 'Problem 1',
        solution: 'Solution 1',
        innovation: 'Inno 1',
        impact: 'Impact 1',
        whyInvest: 'Why 1',
        technology: 'Tech 1',
        status: 'APPROVED',
      },
    });

    const idea2 = await prisma.idea.create({
      data: {
        anonymousId: `IDA2-${ts}`.slice(0, 10),
        teamId: team2.id,
        roomId: roomA.id,
        title: 'Idea Team 2',
        track: 'Tech',
        categoryTag: 'AI',
        problemStatement: 'Problem 2',
        solution: 'Solution 2',
        innovation: 'Inno 2',
        impact: 'Impact 2',
        whyInvest: 'Why 2',
        technology: 'Tech 2',
        status: 'APPROVED',
      },
    });

    const idea3 = await prisma.idea.create({
      data: {
        anonymousId: `IDA3-${ts}`.slice(0, 10),
        teamId: team3.id,
        roomId: roomB.id,
        title: 'Idea Team 3',
        track: 'Tech',
        categoryTag: 'AI',
        problemStatement: 'Problem 3',
        solution: 'Solution 3',
        innovation: 'Inno 3',
        impact: 'Impact 3',
        whyInvest: 'Why 3',
        technology: 'Tech 3',
        status: 'APPROVED',
      },
    });

    // Create participant user on Team 1 (Room A)
    const user1Email = `sec.user1.${ts}@csea.edu`;
    const user1 = await prisma.user.create({
      data: {
        name: 'Sec User 1',
        email: user1Email,
        role: 'TEAM_MEMBER',
        teamId: team1.id,
        roomId: roomA.id,
        avatarInitials: 'SU',
        emailVerified: true,
        isActive: true,
      },
    });
    cleanupUserIds.push(user1.id);

    const wallet1 = await prisma.wallet.create({
      data: { userId: user1.id, totalCoins: 100, availableCoins: 100, investedCoins: 0 },
    });

    const session1Id = `sec-sess1-${ts}`;
    await prisma.session.create({
      data: { id: session1Id, userId: user1.id, expiresAt: new Date(Date.now() + 3600000) },
    });
    cleanupSessionIds.push(session1Id);
    const user1Headers = { Cookie: `pnp_session=${session1Id}`, 'Content-Type': 'application/json' };

    // --- TEST 1: Unknown user registration rejected ---
    const res1 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacker', email: `unknown.${ts}@test.com`, password: 'Password123!', confirmPassword: 'Password123!' }),
    });
    record(1, 'Unknown user registration', 'HTTP 400 with code NOT_PRE_REGISTERED', `HTTP ${res1.status}`, res1.status === 400);

    // --- TEST 2: Duplicate registration rejected ---
    const preRegEmail = `prereg.${ts}@csea.edu`;
    const preRegUser = await prisma.user.create({
      data: { name: 'PreReg User', email: preRegEmail, role: 'TEAM_MEMBER', teamId: team1.id, roomId: roomA.id, avatarInitials: 'PU', emailVerified: false },
    });
    cleanupUserIds.push(preRegUser.id);

    // First registration succeeds
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'PreReg User', email: preRegEmail, password: 'Password123!', confirmPassword: 'Password123!' }),
    });

    // Duplicate attempt
    const res2 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'PreReg User', email: preRegEmail, password: 'Password999!', confirmPassword: 'Password999!' }),
    });
    record(2, 'Duplicate registration attempt', 'HTTP 409 with code ALREADY_REGISTERED', `HTTP ${res2.status}`, res2.status === 409);

    // --- TEST 3: Role escalation attack blocked ---
    const attackEmail = `attack.${ts}@csea.edu`;
    const attackPre = await prisma.user.create({
      data: { name: 'Attacker', email: attackEmail, role: 'INVESTOR', avatarInitials: 'AT', emailVerified: false },
    });
    cleanupUserIds.push(attackPre.id);

    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Attacker', email: attackEmail, password: 'Password123!', confirmPassword: 'Password123!', role: 'ADMIN' }),
    });
    const dbAttack = await prisma.user.findUnique({ where: { email: attackEmail } });
    record(3, 'Role escalation attack', 'DB role remains INVESTOR (never elevated to ADMIN)', `DB Role: ${dbAttack?.role}`, dbAttack?.role === 'INVESTOR');

    // --- TEST 4: Team manipulation attack blocked ---
    const teamTamperEmail = `tamper.${ts}@csea.edu`;
    const teamTamperPre = await prisma.user.create({
      data: { name: 'Team Tamperer', email: teamTamperEmail, role: 'TEAM_MEMBER', teamId: team1.id, roomId: roomA.id, avatarInitials: 'TT', emailVerified: false },
    });
    cleanupUserIds.push(teamTamperPre.id);

    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team Tamperer', email: teamTamperEmail, password: 'Password123!', confirmPassword: 'Password123!', teamId: team3.id }),
    });
    const dbTamper = await prisma.user.findUnique({ where: { email: teamTamperEmail } });
    record(4, 'Team manipulation attack', `DB teamId remains team1.id (${team1.id})`, `DB teamId: ${dbTamper?.teamId}`, dbTamper?.teamId === team1.id);

    // --- TEST 5: Room manipulation attack blocked in investment ---
    const res5 = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: user1Headers,
      body: JSON.stringify({ ideaId: idea2.id, amount: 25, roomId: roomB.id }), // sending fake roomB.id
    });
    const data5 = await res5.json();
    const inv5 = await prisma.investment.findFirst({ where: { investorId: user1.id }, orderBy: { createdAt: 'desc' } });
    record(5, 'Room manipulation attack in investment', `Investment roomId derives from context (${roomA.id}) not client input`, `Investment roomId: ${inv5?.roomId}`, inv5?.roomId === roomA.id);

    // --- TEST 6: Admin API access as participant blocked ---
    const res6 = await fetch(`${BASE_URL}/api/admin/overview`, { headers: user1Headers });
    record(6, 'Admin API access as participant', 'HTTP 401 or 403 Forbidden', `HTTP ${res6.status}`, res6.status === 401 || res6.status === 403);

    // --- TEST 7: Own-team investment rejected ---
    const res7 = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: user1Headers,
      body: JSON.stringify({ ideaId: idea1.id, amount: 20 }),
    });
    record(7, 'Own-team investment rejected', 'HTTP 403 OWN_TEAM_INVESTMENT_FORBIDDEN', `HTTP ${res7.status}`, res7.status === 403);

    // --- TEST 8: Cross-room investment rejected ---
    const res8 = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: user1Headers,
      body: JSON.stringify({ ideaId: idea3.id, amount: 20 }), // idea3 is in Room B
    });
    record(8, 'Cross-room investment rejected', 'HTTP 403 CROSS_ROOM_INVESTMENT_FORBIDDEN', `HTTP ${res8.status}`, res8.status === 403);

    // --- TEST 9: Paused-room investment rejected ---
    await prisma.room.update({ where: { id: roomA.id }, data: { status: 'PAUSED' } });
    const res9 = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: user1Headers,
      body: JSON.stringify({ ideaId: idea2.id, amount: 20 }),
    });
    record(9, 'Paused-room investment rejected', 'HTTP 403 ROOM_PAUSED', `HTTP ${res9.status}`, res9.status === 403);

    // --- TEST 10: Closed-room investment rejected ---
    await prisma.room.update({ where: { id: roomA.id }, data: { status: 'CLOSED' } });
    const res10 = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: user1Headers,
      body: JSON.stringify({ ideaId: idea2.id, amount: 20 }),
    });
    record(10, 'Closed-room investment rejected', 'HTTP 403 ROOM_CLOSED', `HTTP ${res10.status}`, res10.status === 403);

    // Reopen room for wallet overdraw and concurrency tests
    await prisma.room.update({ where: { id: roomA.id }, data: { status: 'OPEN' } });

    // --- TEST 11: Wallet overdraw rejected ---
    const currentW = await prisma.wallet.findUnique({ where: { userId: user1.id } });
    const overdrawAmount = (currentW?.availableCoins || 100) + 50;
    const res11 = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers: user1Headers,
      body: JSON.stringify({ ideaId: idea2.id, amount: overdrawAmount }),
    });
    record(11, 'Wallet overdraw rejected', 'HTTP 400 (Insufficient coins / Exceeds cap)', `HTTP ${res11.status}`, res11.status === 400);

    // --- TEST 12: Concurrent investment atomicity ---
    await prisma.wallet.update({ where: { userId: user1.id }, data: { totalCoins: 60, availableCoins: 60, investedCoins: 0 } });
    const [cRes1, cRes2] = await Promise.all([
      fetch(`${BASE_URL}/api/invest`, { method: 'POST', headers: user1Headers, body: JSON.stringify({ ideaId: idea2.id, amount: 50 }) }),
      fetch(`${BASE_URL}/api/invest`, { method: 'POST', headers: user1Headers, body: JSON.stringify({ ideaId: idea2.id, amount: 50 }) }),
    ]);
    const cStatuses = [cRes1.status, cRes2.status];
    const postW = await prisma.wallet.findUnique({ where: { userId: user1.id } });
    const concPass = cStatuses.includes(200) && cStatuses.some((s) => s >= 400) && postW?.availableCoins === 10;
    record(12, 'Concurrent investment atomicity', 'Exactly 1 succeeds, 1 fails, balance=10 (never negative)', `Statuses: ${cStatuses.join(', ')}, Balance: ${postW?.availableCoins}`, concPass);

    // --- TEST 13: Post-logout API access rejected ---
    const tempSessionId = `sec-temp-sess-${ts}`;
    await prisma.session.create({ data: { id: tempSessionId, userId: user1.id, expiresAt: new Date(Date.now() + 3600000) } });
    const tempHeaders = { Cookie: `pnp_session=${tempSessionId}`, 'Content-Type': 'application/json' };

    // Logout
    await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', headers: tempHeaders });

    // Try accessing protected endpoint
    const res13 = await fetch(`${BASE_URL}/api/teams/mine`, { headers: tempHeaders });
    record(13, 'Post-logout API access rejected', 'HTTP 401 Unauthenticated', `HTTP ${res13.status}`, res13.status === 401);

    // --- TEST 14: Invalid session rejected ---
    const res14 = await fetch(`${BASE_URL}/api/teams/mine`, {
      headers: { Cookie: 'pnp_session=totally_fake_nonexistent_session_token_123', 'Content-Type': 'application/json' },
    });
    record(14, 'Invalid/forged session rejected', 'HTTP 401 Unauthenticated', `HTTP ${res14.status}`, res14.status === 401);

    // --- TEST 15: Password reset token reuse blocked ---
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetTokenRecord = await prisma.passwordResetToken.create({
      data: {
        userId: user1.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 1800000), // 30 min
      },
    });

    // First use: reset password
    const resReset1 = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, password: 'NewSecurePassword123!', confirmPassword: 'NewSecurePassword123!' }),
    });

    // Second use: attempt reuse
    const resReset2 = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, password: 'ReusedTokenPassword123!', confirmPassword: 'ReusedTokenPassword123!' }),
    });
    const dataReset2 = await resReset2.json();
    record(15, 'Password reset token reuse blocked', 'HTTP 400 with TOKEN_ALREADY_USED', `HTTP ${resReset2.status} code: ${dataReset2.code}`, resReset2.status === 400 && dataReset2.code === 'TOKEN_ALREADY_USED');

  } finally {
    // Clean up test data
    console.log('>>> CLEANING UP SECURITY REGRESSION TEST DATA...');
    for (const id of cleanupSessionIds) {
      await prisma.session.delete({ where: { id } }).catch(() => {});
    }
    for (const uid of cleanupUserIds) {
      await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: uid } } }).catch(() => {});
      await prisma.wallet.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.investment.deleteMany({ where: { investorId: uid } }).catch(() => {});
      await prisma.passwordResetToken.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.session.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    for (const tid of cleanupTeamIds) {
      await prisma.investment.deleteMany({ where: { idea: { teamId: tid } } }).catch(() => {});
      await prisma.idea.deleteMany({ where: { teamId: tid } }).catch(() => {});
      await prisma.team.delete({ where: { id: tid } }).catch(() => {});
    }
    for (const rid of cleanupRoomIds) {
      await prisma.room.delete({ where: { id: rid } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log('Security regression cleanup completed.\n');
  }

  console.log('============================================================');
  console.log('              SECURITY REGRESSION SUMMARY                   ');
  console.log('============================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Attacks Tested: ${total}`);
  console.log(`Defended (Passed):   ${passed}`);
  console.log(`Vulnerabilities:     ${failed}`);

  if (failed > 0) {
    console.error('❌ SECURITY REGRESSION FAILED');
    process.exit(1);
  } else {
    console.log('✅ ALL 15 CRITICAL SECURITY ATTACKS STRICTLY DEFENDED!');
  }
}

main().catch((err) => {
  console.error('Fatal security test error:', err);
  process.exit(1);
});
