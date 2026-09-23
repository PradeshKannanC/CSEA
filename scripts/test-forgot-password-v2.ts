import { prisma } from '../lib/prisma';
import crypto from 'node:crypto';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('============================================================');
  console.log('STARTING ENHANCED FORGOT/RESET PASSWORD VERIFICATION V2');
  console.log('============================================================\n');

  async function callApi(url: string, options: RequestInit) {
    const res = await fetch(`${BASE_URL}${url}`, options);
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data: json };
  }

  // 1. Verify Login -> Forgot Password URL prefill contract
  console.log('--- Step 1: Login to Forgot Password Email URL Prefill ---');
  const testEmail = 'pradeshkannan64@gmail.com';
  const encodedEmail = encodeURIComponent(testEmail);
  const pageRes = await fetch(`${BASE_URL}/forgot-password?email=${encodedEmail}`);
  console.log(`GET /forgot-password?email=${encodedEmail} HTTP Status: ${pageRes.status}`);
  if (pageRes.status !== 200) {
    throw new Error('Failed to load /forgot-password with email query parameter');
  }
  const pageText = await pageRes.text();
  if (!pageText.includes('PITCH AND PROSPER') && !pageText.includes('Loading security portal')) {
    throw new Error('Forgot password page brand markup missing');
  }
  console.log('✓ PASS: Forgot password page renders with 200 OK and accepts email parameter.');

  // 2. Test Account Enumeration Defense
  console.log('\n--- Step 2: Account Enumeration Defense for Unknown Account ---');
  const fakeEmail = `nonexistent_user_${Date.now()}@csea.edu`;
  const enumRes = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fakeEmail }),
  });
  console.log(`Unknown email status: ${enumRes.status}, message: "${enumRes.data?.message}"`);
  if (enumRes.status !== 200 || !enumRes.data?.message?.includes('If an account exists')) {
    throw new Error('Enumeration defense failed! Expected neutral 200 response.');
  }
  console.log('✓ PASS: Anti-enumeration neutral response confirmed.');

  // 3. Test Real Email Delivery Behavior (DO NOT FAKE SUCCESS)
  console.log('\n--- Step 3: Real Email Delivery Status & Diagnostics (DO NOT FAKE SUCCESS) ---');
  const admin = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!admin) throw new Error(`User ${testEmail} not found`);

  const forgotRes = await callApi('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  console.log(`Submit forgot-password status: ${forgotRes.status}`);
  console.log(`Response payload:`, forgotRes.data);

  if (forgotRes.status === 503) {
    // Correct behavior when SMTP credentials are not yet populated in .env!
    if (forgotRes.data?.code !== 'EMAIL_DELIVERY_FAILED') {
      throw new Error(`Expected EMAIL_DELIVERY_FAILED, got: ${forgotRes.data?.code}`);
    }
    console.log(`✓ PASS: Correctly refused to fake success! Reported missing/unconfigured credentials: ${forgotRes.data?.missingConfig?.join(', ')}`);
  } else if (forgotRes.status === 200) {
    // If SMTP credentials were configured and email was accepted by provider
    console.log('✓ PASS: Email provider accepted the message and dispatched email!');
  } else {
    throw new Error(`Unexpected status code: ${forgotRes.status}`);
  }

  // 4. Test Token Validation Distinct Reasons
  console.log('\n--- Step 4: Token Validation Distinct Reasons (Invalid, Expired, Already Used) ---');
  // 4a. Bad/Invalid token
  const badTokenRes = await callApi('/api/auth/verify-reset-token?token=completely_fake_token', { method: 'GET' });
  console.log(`Invalid token verify: status ${badTokenRes.status}, reason: ${badTokenRes.data?.reason}`);
  if (badTokenRes.data?.reason !== 'INVALID') throw new Error('Expected reason: INVALID');
  console.log('✓ PASS: Invalid token returns reason: INVALID');

  // 4b. Expired token
  const expRaw = crypto.randomBytes(32).toString('hex');
  const expHash = crypto.createHash('sha256').update(expRaw).digest('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: admin.id,
      tokenHash: expHash,
      expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 min ago
      createdAt: new Date(Date.now() - 31 * 60 * 1000),
    },
  });
  const expRes = await callApi(`/api/auth/verify-reset-token?token=${expRaw}`, { method: 'GET' });
  console.log(`Expired token verify: status ${expRes.status}, reason: ${expRes.data?.reason}`);
  if (expRes.data?.reason !== 'EXPIRED') throw new Error('Expected reason: EXPIRED');
  console.log('✓ PASS: Expired token returns reason: EXPIRED');

  // 4c. Already used token
  const usedRaw = crypto.randomBytes(32).toString('hex');
  const usedHash = crypto.createHash('sha256').update(usedRaw).digest('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: admin.id,
      tokenHash: usedHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      usedAt: new Date(),
      createdAt: new Date(),
    },
  });
  const usedRes = await callApi(`/api/auth/verify-reset-token?token=${usedRaw}`, { method: 'GET' });
  console.log(`Used token verify: status ${usedRes.status}, reason: ${usedRes.data?.reason}`);
  if (usedRes.data?.reason !== 'ALREADY_USED') throw new Error('Expected reason: ALREADY_USED');
  console.log('✓ PASS: Already used token returns reason: ALREADY_USED');

  // 4d. Valid active token
  const validRaw = crypto.randomBytes(32).toString('hex');
  const validHash = crypto.createHash('sha256').update(validRaw).digest('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: admin.id,
      tokenHash: validHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      createdAt: new Date(),
    },
  });
  const validRes = await callApi(`/api/auth/verify-reset-token?token=${validRaw}`, { method: 'GET' });
  console.log(`Valid token verify: status ${validRes.status}, valid: ${validRes.data?.valid}, email: ${validRes.data?.email}`);
  if (!validRes.ok || !validRes.data?.valid || validRes.data?.email !== testEmail) {
    throw new Error('Valid token check failed');
  }
  console.log('✓ PASS: Valid token approved.');

  // 5. Test Password Reset Execution & Single-Use Invalidation
  console.log('\n--- Step 5: Password Reset Execution & Single-Use Invalidation ---');
  const originalAdminHash = admin.passwordHash;
  const NEW_ADMIN_PASS = 'SuperAdminSecure@2024!';

  // Reset password
  const resetRes = await callApi('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: validRaw,
      password: NEW_ADMIN_PASS,
      confirmPassword: NEW_ADMIN_PASS,
    }),
  });
  console.log(`Reset status: ${resetRes.status}, message: "${resetRes.data?.message}"`);
  if (!resetRes.ok) throw new Error(`Password reset failed: ${JSON.stringify(resetRes.data)}`);
  console.log('✓ PASS: Password successfully reset in MySQL.');

  // Verify single-use rejection
  const reuseRes = await callApi('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: validRaw,
      password: 'AnotherPassword@123',
      confirmPassword: 'AnotherPassword@123',
    }),
  });
  console.log(`Reuse status: ${reuseRes.status}, code: ${reuseRes.data?.code}`);
  if (reuseRes.ok || reuseRes.data?.code !== 'TOKEN_ALREADY_USED') {
    throw new Error('Single-use token re-use was NOT rejected!');
  }
  console.log('✓ PASS: Token cannot be used twice.');

  // 6. Test Login with New Password & Role Integrity
  console.log('\n--- Step 6: Login with New Password & Role Verification ---');
  const loginRes = await callApi('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: NEW_ADMIN_PASS,
    }),
  });
  console.log(`Login status: ${loginRes.status}, role: ${loginRes.data?.user?.role}`);
  if (!loginRes.ok || loginRes.data?.user?.role !== 'ADMIN') {
    throw new Error('Login with new password failed or role altered!');
  }
  console.log('✓ PASS: Login successful with new password! Role remains strictly ADMIN.');

  // Restore original password hash
  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: originalAdminHash },
  });
  console.log('✓ Restored original admin password hash.');

  // Cleanup test tokens
  await prisma.passwordResetToken.deleteMany({
    where: { tokenHash: { in: [expHash, usedHash, validHash] } },
  });

  console.log('\n============================================================');
  console.log('🎉 ALL V2 FORGOT/RESET PASSWORD VERIFICATION TESTS PASSED!');
  console.log('============================================================\n');
}

runTests().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
