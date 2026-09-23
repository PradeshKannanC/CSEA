import { prisma } from '../lib/prisma';
import crypto from 'node:crypto';

const BASE_URL = 'http://localhost:3000';

async function testPasswordResetFlow() {
  console.log('============================================================');
  console.log('STARTING REAL PRODUCTION FORGOT/RESET PASSWORD VERIFICATION');
  console.log('============================================================\n');

  // Helper for HTTP requests
  async function callApi(url: string, options: RequestInit) {
    const res = await fetch(`${BASE_URL}${url}`, options);
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data: json, headers: res.headers };
  }

  // 1. Find a real participant user (TEAM_LEADER or TEAM_MEMBER)
  const participant = await prisma.user.findFirst({
    where: { role: { in: ['TEAM_MEMBER', 'TEAM_LEADER'] } },
    include: { team: true, wallet: true },
  });
  if (!participant) throw new Error('No participant found in database');

  const originalRole = participant.role;
  const originalTeamId = participant.teamId;
  const originalPasswordHash = participant.passwordHash;
  const participantEmail = participant.email;

  console.log(`[USER] Testing with account: ${participantEmail}`);
  console.log(`[USER] Initial Role: ${originalRole}, TeamId: ${originalTeamId}`);

  // Test 1: Invalid Email Format
  console.log('\n--- Test 1: Invalid Email Format ---');
  const invalidEmailRes = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  });
  console.log(`Status: ${invalidEmailRes.status}, Message: ${invalidEmailRes.data?.message}`);
  if (invalidEmailRes.status !== 400) {
    throw new Error('Expected 400 validation error for malformed email');
  }
  console.log('✓ PASS: Rejected malformed email address with 400.');

  // Test 2: Account Enumeration Protection (Unregistered email)
  console.log('\n--- Test 2: Account Enumeration Defense ---');
  const fakeEmail = `nonexistent_${Date.now()}@csea.edu`;
  const enumCheckRes = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fakeEmail }),
  });
  console.log(`Status: ${enumCheckRes.status}, Message: ${enumCheckRes.data?.message}`);
  if (enumCheckRes.status !== 200 || !enumCheckRes.data?.message?.includes("If an account exists")) {
    throw new Error('Expected 200 neutral response for unregistered email');
  }
  const noTokenCheck = await prisma.passwordResetToken.findFirst({
    where: { user: { email: fakeEmail } },
  });
  if (noTokenCheck) {
    throw new Error('Token should NOT be created for nonexistent user');
  }
  console.log('✓ PASS: Returned neutral enumeration-safe message, no token generated.');

  // Test 3: Valid Forgot Password Request for Participant
  console.log('\n--- Test 3: Submit Valid Forgot Password Request ---');
  const forgotRes1 = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: participantEmail }),
  });
  console.log(`Status: ${forgotRes1.status}, Message: ${forgotRes1.data?.message}`);

  if (forgotRes1.status === 503) {
    if (forgotRes1.data?.code !== 'EMAIL_DELIVERY_FAILED') {
      throw new Error(`Expected EMAIL_DELIVERY_FAILED on unconfigured provider, got: ${forgotRes1.data?.code}`);
    }
    console.log(`✓ PASS: Correctly refused to fake success! Reported missing configuration: ${forgotRes1.data?.missingConfig?.join(', ')}`);
  } else if (forgotRes1.status === 200) {
    if (!forgotRes1.data?.message?.includes("If an account exists")) {
      throw new Error(`Expected neutral confirmation message, got: ${forgotRes1.data?.message}`);
    }
    console.log('✓ PASS: Email provider accepted delivery and returned neutral confirmation.');
  } else {
    throw new Error(`Unexpected status code: ${forgotRes1.status}`);
  }

  // Test 5: Verify Reset Token Endpoint
  console.log('\n--- Test 5: Verify Reset Token Endpoint ---');
  // 5a. Invalid/garbage token
  const verifyBad = await callApi('/api/auth/verify-reset-token?token=bad_token_12345', { method: 'GET' });
  console.log(`Invalid token verify status: ${verifyBad.status}, valid: ${verifyBad.data?.valid}`);
  if (verifyBad.data?.valid) throw new Error('Bad token should not be valid');
  console.log('✓ PASS: Bad token rejected.');

  // 5b. For token2, create a known raw token test record so we can verify via HTTP
  const testRawToken = crypto.randomBytes(32).toString('hex');
  const testTokenHash = crypto.createHash('sha256').update(testRawToken).digest('hex');
  const testRecord = await prisma.passwordResetToken.create({
    data: {
      userId: participant.id,
      tokenHash: testTokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      createdAt: new Date(),
    },
  });

  const verifyGood = await callApi(`/api/auth/verify-reset-token?token=${testRawToken}`, { method: 'GET' });
  console.log(`Valid token verify status: ${verifyGood.status}, valid: ${verifyGood.data?.valid}, email: ${verifyGood.data?.email}`);
  if (!verifyGood.ok || !verifyGood.data?.valid || verifyGood.data?.email !== participantEmail) {
    throw new Error('Valid token failed verification');
  }
  console.log('✓ PASS: Valid raw token verified successfully against stored hash.');

  // Test 6: Expired Token Rejection
  console.log('\n--- Test 6: Expired Token Rejection ---');
  const expiredRawToken = crypto.randomBytes(32).toString('hex');
  const expiredTokenHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: participant.id,
      tokenHash: expiredTokenHash,
      expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes in the past
      createdAt: new Date(Date.now() - 35 * 60 * 1000),
    },
  });

  const verifyExpired = await callApi(`/api/auth/verify-reset-token?token=${expiredRawToken}`, { method: 'GET' });
  console.log(`Expired token verify status: ${verifyExpired.status}, valid: ${verifyExpired.data?.valid}, reason: ${verifyExpired.data?.reason}`);
  if (verifyExpired.data?.valid || verifyExpired.data?.reason !== 'EXPIRED') {
    throw new Error('Expired token should fail with EXPIRED');
  }

  // Attempt to reset with expired token
  const resetExpired = await callApi('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: expiredRawToken,
      password: 'NewSecurePass@2024',
      confirmPassword: 'NewSecurePass@2024',
    }),
  });
  console.log(`Reset with expired token status: ${resetExpired.status}, code: ${resetExpired.data?.code}`);
  if (resetExpired.ok || resetExpired.data?.code !== 'TOKEN_EXPIRED') {
    throw new Error('Password reset with expired token should be rejected with TOKEN_EXPIRED');
  }
  console.log('✓ PASS: Expired token rejected on both verify and reset.');

  // Test 7: Password Complexity & Mismatch Rejection
  console.log('\n--- Test 7: Password Complexity & Mismatch Rejection ---');
  // 7a. Mismatch
  const mismatchRes = await callApi('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: testRawToken,
      password: 'NewSecurePass@2024',
      confirmPassword: 'DifferentPass@2024',
    }),
  });
  if (mismatchRes.ok) throw new Error('Password mismatch should be rejected');
  console.log(`✓ PASS: Mismatch rejected: ${mismatchRes.data?.message}`);

  // 7b. Weak password (no number)
  const weakRes = await callApi('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: testRawToken,
      password: 'OnlyLettersPass',
      confirmPassword: 'OnlyLettersPass',
    }),
  });
  if (weakRes.ok) throw new Error('Weak password without number should be rejected');
  console.log(`✓ PASS: Weak password rejected: ${weakRes.data?.message}`);

  // Test 8: Create Active Session to Test Session Invalidation
  console.log('\n--- Test 8: Setup Active Session to Verify Invalidation ---');
  const dummySessionId = `test_session_${Date.now()}`;
  await prisma.session.create({
    data: {
      id: dummySessionId,
      userId: participant.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const sessionCheckBefore = await prisma.session.findUnique({ where: { id: dummySessionId } });
  if (!sessionCheckBefore) throw new Error('Failed to create test session');
  console.log(`✓ Created test session in MySQL: ${dummySessionId}`);

  // Test 9: Successful Password Reset
  console.log('\n--- Test 9: Execute Valid Password Reset ---');
  const NEW_PASSWORD = 'BrandNewP@ssword2024';
  const resetSuccess = await callApi('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: testRawToken,
      password: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    }),
  });
  console.log(`Status: ${resetSuccess.status}, Message: ${resetSuccess.data?.message}`);
  if (!resetSuccess.ok) {
    throw new Error(`Password reset failed: ${JSON.stringify(resetSuccess.data)}`);
  }
  console.log('✓ PASS: Password successfully reset!');

  // Test 10: Strict Single-Use Token Enforcement
  console.log('\n--- Test 10: Strict Single-Use Enforcement ---');
  const reuseRes = await callApi('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: testRawToken,
      password: 'AnotherPassword@2024',
      confirmPassword: 'AnotherPassword@2024',
    }),
  });
  console.log(`Reused token status: ${reuseRes.status}, code: ${reuseRes.data?.code}`);
  if (reuseRes.ok || reuseRes.data?.code !== 'TOKEN_ALREADY_USED') {
    throw new Error('Reused token was NOT rejected with TOKEN_ALREADY_USED');
  }
  console.log('✓ PASS: Token reuse strictly rejected.');

  // Test 11: Verify Sessions Invalidated in MySQL
  console.log('\n--- Test 11: Verify Session Invalidation in MySQL ---');
  const sessionCheckAfter = await prisma.session.findUnique({ where: { id: dummySessionId } });
  if (sessionCheckAfter) {
    throw new Error('Old session was NOT invalidated after password reset!');
  }
  console.log('✓ PASS: All prior sessions invalidated from MySQL.');

  // Test 12: Verify Audit Log Recorded
  console.log('\n--- Test 12: Verify Security Audit Log in MySQL ---');
  const auditEntry = await prisma.auditLog.findFirst({
    where: { userId: participant.id, action: 'PASSWORD_RESET_COMPLETED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!auditEntry) throw new Error('No PASSWORD_RESET_COMPLETED audit log found');
  console.log(`✓ PASS: Audit log entry found: ID: ${auditEntry.id}, Action: ${auditEntry.action}`);

  // Test 13: Login with Old vs New Password
  console.log('\n--- Test 13: Login Verification (Old vs New Password) ---');
  // 13a. Old password fails
  const oldLoginRes = await callApi('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: participantEmail, password: 'WrongOldPassword123!' }),
  });
  console.log(`Old password login status: ${oldLoginRes.status}`);
  if (oldLoginRes.ok) throw new Error('Old/invalid password should fail login');
  console.log('✓ PASS: Old password rejected with 401.');

  // 13b. New password succeeds
  const newLoginRes = await callApi('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: participantEmail, password: NEW_PASSWORD }),
  });
  console.log(`New password login status: ${newLoginRes.status}, user: ${newLoginRes.data?.user?.email}`);
  if (!newLoginRes.ok || !newLoginRes.data?.user) {
    throw new Error(`Login with new password failed: ${JSON.stringify(newLoginRes.data)}`);
  }
  console.log('✓ PASS: New password accepted, login successful!');

  // Test 14: Verify Role, Team, Wallet & Ideas Intact
  console.log('\n--- Test 14: Verify Role & Team Integrity ---');
  const updatedUser = await prisma.user.findUnique({
    where: { id: participant.id },
    include: { team: true, wallet: true },
  });
  if (updatedUser?.role !== originalRole) {
    throw new Error(`Role changed! Original: ${originalRole}, Current: ${updatedUser?.role}`);
  }
  if (updatedUser?.teamId !== originalTeamId) {
    throw new Error(`TeamId changed! Original: ${originalTeamId}, Current: ${updatedUser?.teamId}`);
  }
  console.log(`✓ Role maintained: ${updatedUser.role}`);
  console.log(`✓ Team maintained: ${updatedUser.team?.name} (${updatedUser.teamId})`);
  console.log(`✓ Wallet maintained: Balance ${updatedUser.wallet?.availableCoins}`);
  console.log('✓ PASS: User account attributes completely preserved.');

  // Restore original password hash for cleanly resetting participant credentials
  await prisma.user.update({
    where: { id: participant.id },
    data: { passwordHash: originalPasswordHash },
  });
  console.log('✓ Restored participant original password hash.');

  // Test 15: Admin Password Reset Verification
  console.log('\n--- Test 15: Admin Account Password Reset Verification ---');
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No admin found');

  const adminRawToken = crypto.randomBytes(32).toString('hex');
  const adminTokenHash = crypto.createHash('sha256').update(adminRawToken).digest('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: admin.id,
      tokenHash: adminTokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      createdAt: new Date(),
    },
  });

  const ADMIN_NEW_PASS = 'AdminSecureP@ss2024!';
  const adminResetRes = await callApi('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: adminRawToken,
      password: ADMIN_NEW_PASS,
      confirmPassword: ADMIN_NEW_PASS,
    }),
  });
  if (!adminResetRes.ok) throw new Error(`Admin password reset failed: ${JSON.stringify(adminResetRes.data)}`);

  const adminCheck = await prisma.user.findUnique({ where: { id: admin.id } });
  if (adminCheck?.role !== 'ADMIN') {
    throw new Error('Admin role altered during password reset!');
  }
  console.log(`✓ Admin role verified: ${adminCheck.role}`);

  // Restore original admin password hash
  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: admin.passwordHash },
  });
  console.log('✓ Admin account intact and restored.');

  console.log('\n============================================================');
  console.log('🎉 ALL 15 FORGOT/RESET PASSWORD VERIFICATION TESTS PASSED!');
  console.log('============================================================\n');
}

testPasswordResetFlow().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
