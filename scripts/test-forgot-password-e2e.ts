import { prisma } from '../lib/prisma';
import crypto from 'node:crypto';

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

async function main() {
  console.log('================================================================');
  console.log('STARTING AUTOMATED TEST: FORGOT PASSWORD END-TO-END SUITE');
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

  // 1. Locate primary administrator
  const admin = await prisma.user.findFirst({
    where: { email: 'pradeshkannan64@gmail.com' },
  });

  if (!admin) {
    throw new Error('User pradeshkannan64@gmail.com not found in database');
  }

  const originalPasswordHash = admin.passwordHash;
  const createdTokenIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // TEST 1: Anti-Enumeration with Non-Existent Email
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Anti-Enumeration for Non-Existent Account ---');
    const nonExistentEmail = 'nonexistent-user-1234567@example.com';
    const fakeRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: nonExistentEmail }),
    });

    const fakeData = await fakeRes.json();
    assert('Returns HTTP 200 for non-existent email (anti-enumeration)', fakeRes.status === 200);
    assert('Returns standard neutral message', fakeData.message.includes('If an account exists'));

    const fakeToken = await prisma.passwordResetToken.findFirst({
      where: { user: { email: nonExistentEmail } },
    });
    assert('No token created in database for non-existent user', fakeToken === null);

    // -------------------------------------------------------------
    // TEST 2: Validation of Malformed Input
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Input Validation ---');
    const badInputRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const badInputData = await badInputRes.json();
    assert('Returns HTTP 400 for malformed email', badInputRes.status === 400);
    assert('Code is VALIDATION_ERROR', badInputData.code === 'VALIDATION_ERROR');

    // -------------------------------------------------------------
    // TEST 3: Resend Dispatch Acceptance for Legitimate Account
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Real Dispatch to Verified / Owner Recipient ---');
    const startTime = new Date(Date.now() - 5000);

    const resetReqRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-host': 'pitchandprosper.csea.in',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ email: admin.email }),
    });

    const resetReqData = await resetReqRes.json();
    assert('Forgot password API returned HTTP 200', resetReqRes.status === 200, resetReqData);
    assert('Success flag is true', resetReqData.success === true);
    assert('Neutral message returned', resetReqData.message.includes('If an account exists'));

    // Check DB record
    const latestToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: admin.id,
        createdAt: { gte: startTime },
      },
      orderBy: { createdAt: 'desc' },
    });

    assert('PasswordResetToken record created in MySQL', latestToken !== null);
    if (latestToken) {
      createdTokenIds.push(latestToken.id);
      assert('Token hash is 64-char SHA-256', latestToken.tokenHash.length === 64);
      assert('Token is unconsumed (usedAt is null)', latestToken.usedAt === null);

      const diffMinutes = (latestToken.expiresAt.getTime() - latestToken.createdAt.getTime()) / (1000 * 60);
      assert('Token expiration is exactly 30 minutes', Math.round(diffMinutes) === 30);
    }

    // Check AuditLog
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        userId: admin.id,
        action: 'PASSWORD_RESET_REQUESTED',
        createdAt: { gte: startTime },
      },
      orderBy: { createdAt: 'desc' },
    });

    assert('AuditLog entry recorded for PASSWORD_RESET_REQUESTED', auditLog !== null);
    if (auditLog) {
      const meta = auditLog.metadata as any;
      assert('Audit log specifies Resend provider', meta?.provider === 'resend');
      assert('Audit log captures Resend messageId', Boolean(meta?.messageId));
      console.log(`[INFO] Resend Message ID: ${meta?.messageId}`);
    }

    // -------------------------------------------------------------
    // TEST 4: Token Invalidation & Reset Password Endpoint
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Reset Password Execution & Single-Use Invalidation ---');
    const testRawToken = crypto.randomBytes(32).toString('hex');
    const testTokenHash = crypto.createHash('sha256').update(testRawToken).digest('hex');
    const testExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const testTokenRecord = await prisma.passwordResetToken.create({
      data: {
        userId: admin.id,
        tokenHash: testTokenHash,
        expiresAt: testExpiresAt,
      },
    });
    createdTokenIds.push(testTokenRecord.id);

    // Test with invalid token
    const invalidTokenRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'completely-invalid-token-string',
        password: 'NewTempPassword123!',
      }),
    });
    const invalidTokenData = await invalidTokenRes.json();
    assert('Invalid token rejected with HTTP 400', invalidTokenRes.status === 400);

    // Test successful reset with testRawToken
    const newTestPassword = 'TempPasswordUpdated123!';
    const validResetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: testRawToken,
        password: newTestPassword,
        confirmPassword: newTestPassword,
      }),
    });
    const validResetData = await validResetRes.json();
    assert('Reset password succeeded with HTTP 200', validResetRes.status === 200, validResetData);
    assert('Response indicates success', validResetData.success === true);

    // Verify token consumed in DB
    const consumedToken = await prisma.passwordResetToken.findUnique({
      where: { id: testTokenRecord.id },
    });
    assert('Token marked as used (usedAt is set)', consumedToken?.usedAt !== null);

    // Verify replay attack fails
    const replayRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: testRawToken,
        password: 'AnotherPassword123!',
        confirmPassword: 'AnotherPassword123!',
      }),
    });
    assert('Replay of used token rejected with HTTP 400', replayRes.status === 400);

    // Verify login with new password works
    const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: admin.email,
        password: newTestPassword,
      }),
    });
    assert('Login with newly reset password succeeds (HTTP 200)', newLoginRes.status === 200);

    // Verify old password fails
    const oldLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: admin.email,
        password: 'pradesh@2006K',
      }),
    });
    assert('Login with old password fails (HTTP 401)', oldLoginRes.status === 401);

    console.log('\n================================================================');
    console.log(`FORGOT PASSWORD SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

  } finally {
    // RESTORE ORIGINAL ADMIN PASSWORD
    console.log('\nRestoring original administrator password...');
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: originalPasswordHash },
    });

    // Cleanup created tokens
    if (createdTokenIds.length > 0) {
      await prisma.passwordResetToken.deleteMany({
        where: { id: { in: createdTokenIds } },
      });
    }

    await prisma.$disconnect();
    console.log('Cleanup and password restoration complete.');
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error running forgot password test:', err);
  process.exit(1);
});
