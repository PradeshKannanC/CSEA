async function testHttpEndpoints() {
  console.log('--- Testing Live HTTP Endpoints on http://localhost:3000 ---');

  // 1. Test Login with Admin Credentials
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'pradeshkannan64@gmail.com',
      password: 'pradesh@2006K',
    }),
  });

  const loginData = await loginRes.json();
  console.log('Login Status:', loginRes.status);
  console.log('Login Response:', loginData);

  if (!loginData.success || loginData.user.role !== 'ADMIN') {
    throw new Error('Admin login failed or role is incorrect!');
  }
  console.log('✓ Admin login returned role ADMIN and redirectTo: ' + loginData.redirectTo);

  // Extract session cookie from Set-Cookie header
  const rawCookies = loginRes.headers.get('set-cookie');
  console.log('✓ Session Cookie Received:', rawCookies ? 'YES' : 'NO');

  const cookieHeader = rawCookies ? rawCookies.split(';')[0] : '';

  // 2. Query /api/auth/me with the session cookie
  const meRes = await fetch('http://localhost:3000/api/auth/me', {
    headers: {
      Cookie: cookieHeader,
    },
  });
  const meData = await meRes.json();
  console.log('✓ /api/auth/me response with session:', meData);

  if (!meData.authenticated || meData.user.role !== 'ADMIN') {
    throw new Error('/api/auth/me did not recognize authenticated ADMIN session!');
  }
  console.log('✓ /api/auth/me recognized authenticated ADMIN user:', meData.user.name);

  // 3. Test Logout
  const logoutRes = await fetch('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: {
      Cookie: cookieHeader,
    },
  });
  const logoutData = await logoutRes.json();
  console.log('✓ /api/auth/logout response:', logoutData);

  // 4. Query /api/auth/me after logout -> should be unauthenticated
  const meAfterLogoutRes = await fetch('http://localhost:3000/api/auth/me', {
    headers: {
      Cookie: cookieHeader,
    },
  });
  const meAfterLogout = await meAfterLogoutRes.json();
  console.log('✓ /api/auth/me after logout:', meAfterLogout);

  if (meAfterLogout.authenticated) {
    throw new Error('Session should have been invalidated after logout!');
  }
  console.log('✓ Session verified destroyed on server.');

  console.log('🎉 LIVE HTTP AUTHENTICATION & LOGOUT TESTS PASSED!');
}

testHttpEndpoints().catch((err) => {
  console.error('HTTP Test Failed:', err);
  process.exit(1);
});
