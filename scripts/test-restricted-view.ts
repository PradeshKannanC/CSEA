async function testAccessRestricted() {
  console.log('--- Testing /admin Access Restriction Output ---');

  const res = await fetch('http://localhost:3000/admin', { redirect: 'manual' });
  console.log('HTTP Status:', res.status);
  console.log('Location header:', res.headers.get('location'));

  if (res.status === 307 || res.status === 302) {
    const loc = res.headers.get('location') || '';
    if (loc.includes('/login')) {
      console.log('✓ Edge middleware correctly redirected unauthenticated request to /login?redirect=/admin');
    }
  } else {
    const text = await res.text();
    if (text.includes('Tournament Participant')) {
      throw new Error('FAIL: "Tournament Participant" found in /admin access restricted view!');
    }
  }

  console.log('🎉 ACCESS RESTRICTION VERIFICATION PASSED!');
}

testAccessRestricted().catch((err) => {
  console.error(err);
  process.exit(1);
});
