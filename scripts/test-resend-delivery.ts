import { verifyEmailConfig, sendPasswordResetEmail } from '../lib/email';
import { prisma } from '../lib/prisma';

async function runResendTests() {
  console.log('====================================================');
  console.log('TESTING RESEND EMAIL CONFIGURATION & ERROR HANDLING');
  console.log('====================================================\n');

  // Test 1: Configuration check without RESEND_API_KEY
  console.log('[TEST 1] verifyEmailConfig() without real RESEND_API_KEY');
  const config = verifyEmailConfig();
  console.log('Config result:', config);

  if (config.configured) {
    throw new Error('Expected configured to be false when placeholder/no key is set');
  }

  if (!config.missing.includes('RESEND_API_KEY')) {
    throw new Error('Expected RESEND_API_KEY to be in missing list');
  }

  // Ensure NO SMTP variables are reported as missing
  const smtpVars = ['EMAIL_USER', 'SMTP_USER', 'EMAIL_PASSWORD', 'SMTP_PASSWORD'];
  for (const sVar of smtpVars) {
    if (config.missing.some(m => m.includes(sVar))) {
      throw new Error(`FAIL: Unexpectedly reported SMTP variable as missing: ${sVar}`);
    }
  }
  console.log('✅ PASS: Only RESEND_API_KEY reported as missing; zero SMTP variables required.');

  // Test 2: sendPasswordResetEmail returns clean diagnostics when unconfigured
  console.log('\n[TEST 2] sendPasswordResetEmail() refusal when unconfigured');
  const sendRes = await sendPasswordResetEmail({
    to: 'test@student.tce.edu',
    rawToken: 'test_token_hex_12345',
  });
  console.log('Send result:', sendRes);

  if (sendRes.success) {
    throw new Error('Expected delivery to fail when unconfigured');
  }
  if (!sendRes.error?.includes('RESEND_API_KEY')) {
    throw new Error(`Expected error to mention RESEND_API_KEY, got: ${sendRes.error}`);
  }
  console.log('✅ PASS: Refused to fake success; reported RESEND_API_KEY is not configured.');

  // Test 3: API Endpoint verification via HTTP
  console.log('\n[TEST 3] HTTP POST /api/auth/forgot-password');
  const participant = await prisma.user.findFirst({
    where: { role: { in: ['TEAM_MEMBER', 'TEAM_LEADER'] } },
  });
  if (!participant) throw new Error('No participant in DB');

  const httpRes = await fetch('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: participant.email }),
  });

  const httpJson = await httpRes.json();
  console.log(`Status: ${httpRes.status}`);
  console.log('Payload:', httpJson);

  if (httpRes.status !== 503) {
    throw new Error(`Expected 503 status for unconfigured RESEND_API_KEY, got ${httpRes.status}`);
  }
  if (httpJson.code !== 'EMAIL_DELIVERY_FAILED') {
    throw new Error(`Expected EMAIL_DELIVERY_FAILED code, got ${httpJson.code}`);
  }
  if (!httpJson.missingConfig?.includes('RESEND_API_KEY')) {
    throw new Error('Expected missingConfig to include RESEND_API_KEY');
  }
  if (httpJson.missingConfig?.some((m: string) => m.toLowerCase().includes('smtp') || m.toLowerCase().includes('user'))) {
    throw new Error('FAIL: HTTP response contained SMTP missingConfig items!');
  }
  if (httpJson.message !== 'RESEND_API_KEY is not configured.') {
    throw new Error(`Expected message to be "RESEND_API_KEY is not configured.", got: "${httpJson.message}"`);
  }

  console.log('✅ PASS: HTTP API accurately returned 503 with clean RESEND_API_KEY diagnostic and zero SMTP leaks.');

  console.log('\n====================================================');
  console.log('🎉 ALL RESEND EMAIL TESTS PASSED!');
  console.log('====================================================');
}

runResendTests()
  .catch((err) => {
    console.error('\n❌ RESEND TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
