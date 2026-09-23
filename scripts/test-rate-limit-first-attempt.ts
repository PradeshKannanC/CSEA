async function main() {
  console.log('==================================================');
  console.log('TESTING FORGOT PASSWORD RATE LIMIT BEHAVIOR');
  console.log('==================================================');

  // Test 1: Page GET does not consume quota
  const pageRes = await fetch('http://localhost:3000/forgot-password');
  console.log(`[TEST 1] GET /forgot-password status: ${pageRes.status}`);
  if (pageRes.status !== 200) {
    throw new Error(`GET /forgot-password failed with status ${pageRes.status}`);
  }

  const testEmailA = `test_user_${Date.now()}@example.com`;
  console.log(`\n[TEST 2] Testing first password reset attempt for: ${testEmailA}`);
  
  const firstReq = await fetch('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmailA }),
  });

  const firstReqJson = await firstReq.json().catch(() => ({}));
  console.log(`[TEST 2] First attempt response status: ${firstReq.status}`);
  console.log(`[TEST 2] First attempt response body:`, firstReqJson);

  if (firstReq.status === 429) {
    throw new Error('FAIL: First attempt was blocked with 429 Too Many Requests!');
  }

  // It should either be 200 (if SMTP sent / unregistered generic message) or 503 (if SMTP failed), but NOT 429
  console.log('✅ PASS: First attempt was NOT rate-limited.');

  // Test 3: An independent user making their first request is not affected
  const testEmailB = `test_independent_${Date.now()}@example.com`;
  console.log(`\n[TEST 3] Testing independent first attempt for: ${testEmailB}`);
  const independentReq = await fetch('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmailB }),
  });
  console.log(`[TEST 3] Independent attempt status: ${independentReq.status}`);
  if (independentReq.status === 429) {
    throw new Error('FAIL: Independent email was blocked with 429!');
  }
  console.log('✅ PASS: Independent email was NOT affected.');

  // Test 4: Exceeding the threshold for an email triggers 429 on subsequent attempts
  const testEmailSpam = `spam_test_${Date.now()}@example.com`;
  console.log(`\n[TEST 4] Testing threshold exhaustion on: ${testEmailSpam}`);
  
  let rateLimitHit = false;
  let retryAfterHeader = null;

  for (let i = 1; i <= 7; i++) {
    const res = await fetch('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmailSpam }),
    });

    console.log(`Request #${i}: status ${res.status}`);

    if (res.status === 429) {
      rateLimitHit = true;
      retryAfterHeader = res.headers.get('Retry-After');
      const body = await res.json();
      console.log(`429 Body:`, body);
      console.log(`Retry-After Header:`, retryAfterHeader);
      if (body.code !== 'RATE_LIMITED') {
        throw new Error(`Expected code to be RATE_LIMITED, got ${body.code}`);
      }
      break;
    }
  }

  if (!rateLimitHit) {
    throw new Error('FAIL: Expected rate limiting to trigger when limit exceeded, but it did not!');
  }
  console.log('✅ PASS: Rate limiting correctly triggers after limit is exceeded.');

  // Test 5: Verify another fresh email is STILL allowed after testEmailSpam was rate limited
  const testEmailFresh = `fresh_after_spam_${Date.now()}@example.com`;
  console.log(`\n[TEST 5] Verifying fresh email after spammer: ${testEmailFresh}`);
  const freshReq = await fetch('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmailFresh }),
  });
  console.log(`[TEST 5] Fresh email status: ${freshReq.status}`);
  if (freshReq.status === 429) {
    throw new Error('FAIL: Fresh email was falsely blocked by another email quota!');
  }
  console.log('✅ PASS: Fresh email was NOT blocked by previous email limit.');

  console.log('\n==================================================');
  console.log('🎉 ALL RATE LIMITING TESTS PASSED PERFECTLY!');
  console.log('==================================================');
}

main().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
