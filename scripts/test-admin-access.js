const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body,
        });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function extractCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const rawList = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  for (const c of rawList) {
    const parts = c.split(';');
    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === name) return v;
    }
  }
  return null;
}

async function run() {
  console.log('====================================================');
  console.log('TESTING ACCESS RESTRICTION: INVESTOR -> /admin');
  console.log('====================================================\n');

  // 1. Authenticate as Elena Rostova (Role: INVESTOR)
  console.log('1. Authenticating as Elena Rostova (Role: INVESTOR)...');
  const loginPayload = JSON.stringify({
    email: 'elena.rostova@pnp.arena',
    password: 'password123',
  });

  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginPayload),
    },
  }, loginPayload);

  const loginJson = JSON.parse(loginRes.body);
  console.log('   Login response: ' + loginJson.user?.name + ' | Role: ' + loginJson.user?.role);
  const investorCookie = extractCookie(loginRes.headers['set-cookie'], 'pnp_session');

  // 2. Request /admin as INVESTOR
  console.log('\n2. Requesting GET /admin with INVESTOR cookie...');
  const investorAdminRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
    headers: {
      'Cookie': 'pnp_session=' + investorCookie,
    },
  });

  console.log('   Response HTTP Status: ' + investorAdminRes.statusCode);
  const body = investorAdminRes.body;
  
  const checks = [
    { label: 'Access Restricted header', pass: body.includes('Access Restricted') },
    { label: 'Red cross icon ❌', pass: body.includes('❌') },
    { label: 'Unauthorized corridor badge', pass: body.includes('UNAUTHORIZED CORRIDOR') },
    { label: 'Current account: Elena Rostova', pass: body.includes('Elena Rostova') },
    { label: 'Account Role: INVESTOR', pass: body.includes('INVESTOR') },
    { label: 'Target Resource: Arena Control Center', pass: body.includes('Arena Control Center') },
    { label: 'Required Clearance: ADMIN', pass: body.includes('ADMIN') },
  ];

  console.log('\nChecks for INVESTOR accessing /admin:');
  let allInvestorChecksPass = true;
  for (const c of checks) {
    console.log('   [' + (c.pass ? 'PASS' : 'FAIL') + '] ' + c.label);
    if (!c.pass) allInvestorChecksPass = false;
  }

  if (!allInvestorChecksPass) {
    console.error('\nBody preview (first 500 chars):', body.substring(0, 500));
    process.exit(1);
  }

  // 3. Authenticate as Sarah Chen (Role: ADMIN)
  console.log('\n3. Authenticating as Sarah Chen (Role: ADMIN)...');
  const adminLoginPayload = JSON.stringify({
    email: 'sarah.chen@pnp.arena',
    password: 'password123',
  });

  const adminLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(adminLoginPayload),
    },
  }, adminLoginPayload);

  const adminLoginJson = JSON.parse(adminLoginRes.body);
  console.log('   Login response: ' + adminLoginJson.user?.name + ' | Role: ' + adminLoginJson.user?.role);
  const adminCookie = extractCookie(adminLoginRes.headers['set-cookie'], 'pnp_session');

  // 4. Request /admin as ADMIN
  console.log('\n4. Requesting GET /admin with ADMIN cookie...');
  const adminAdminRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
    headers: {
      'Cookie': 'pnp_session=' + adminCookie,
    },
  });

  console.log('   Response HTTP Status: ' + adminAdminRes.statusCode);
  const adminBody = adminAdminRes.body;
  const adminAllowed = !adminBody.includes('Access Restricted') && !adminBody.includes('UNAUTHORIZED CORRIDOR');
  console.log('   [' + (adminAllowed ? 'PASS' : 'FAIL') + '] ADMIN is NOT blocked with Access Restricted');

  if (!adminAllowed) {
    console.error('Admin was unexpectedly blocked!');
    process.exit(1);
  }

  // 5. Request /admin with NO session (Anonymous)
  console.log('\n5. Requesting GET /admin with NO session (Anonymous)...');
  const anonRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
  });
  console.log('   Response HTTP Status: ' + anonRes.statusCode);
  const anonRedirectsToLogin = anonRes.statusCode === 307 && (anonRes.headers.location?.includes('/login') ?? false);
  console.log('   [' + (anonRedirectsToLogin ? 'PASS' : 'FAIL') + '] Anonymous redirected to /login?redirect=/admin');

  if (!anonRedirectsToLogin) {
    console.error('Anonymous user did not get redirected properly! Location: ' + anonRes.headers.location);
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('ALL TESTS PASSED! INVESTOR GATE CONFIRMED AUTHORITATIVE');
  console.log('====================================================');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
