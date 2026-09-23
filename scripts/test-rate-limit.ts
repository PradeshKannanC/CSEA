async function testRateLimit() {
  console.log('--- Testing Rate Limiter on /api/auth/forgot-password ---');
  let rateLimited = false;
  for (let i = 0; i < 7; i++) {
    const res = await fetch('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rate_limit_probe@csea.edu' }),
    });
    console.log(`Request #${i + 1} Status: ${res.status}`);
    if (res.status === 429) {
      rateLimited = true;
      const json = await res.json();
      console.log('429 Payload:', json);
      break;
    }
  }
  if (!rateLimited) {
    throw new Error('Rate limiting did not trigger within 7 attempts!');
  }
  console.log('🎉 RATE LIMITING VERIFICATION PASSED!');
}

testRateLimit().catch((e) => {
  console.error(e);
  process.exit(1);
});
