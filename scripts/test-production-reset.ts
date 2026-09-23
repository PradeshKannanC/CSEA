import http from 'http';

interface TestRecord {
  testId: string;
  name: string;
  passed: boolean;
  details?: string;
}

const testResults: TestRecord[] = [];

function request(options: http.RequestOptions, postData?: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
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

function extractCookie(cookieHeader: string[] | string | undefined, name: string): string | null {
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

async function runTests() {
  console.log('===================================================================');
  console.log(' PITCH AND PROSPER by CSEA — 16-POINT PRODUCTION AUTHORIZATION MATRIX');
  console.log('===================================================================\n');

  let adminCookie = '';
  let secondaryAdminCookie = '';
  let leaderCookie = '';
  let memberCookie = '';
  let investorCookie = '';

  // -----------------------------------------------------------------
  // TEST 1: Login as initial ADMIN: pradeshkannan64@gmail.com / pradesh@2006K
  // -----------------------------------------------------------------
  console.log('--- TEST 1: Login as Root Super Admin (pradeshkannan64@gmail.com) ---');
  const loginPayload = JSON.stringify({
    email: 'pradeshkannan64@gmail.com',
    password: 'pradesh@2006K',
  });

  const t1Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginPayload),
    },
  }, loginPayload);

  const t1Json = JSON.parse(t1Res.body);
  const t1Pass = t1Res.statusCode === 200 && t1Json.success && t1Json.user?.role === 'ADMIN';
  adminCookie = extractCookie(t1Res.headers['set-cookie'], 'pnp_session') || '';

  console.log(`  Status: ${t1Res.statusCode}, User: ${t1Json.user?.name}, Role: ${t1Json.user?.role}`);
  testResults.push({
    testId: 'TEST 1',
    name: 'Login as Root Administrator (pradeshkannan64@gmail.com)',
    passed: t1Pass,
    details: t1Pass ? `Authenticated as ADMIN (${t1Json.user?.name})` : `Failed: ${t1Res.body}`,
  });

  // -----------------------------------------------------------------
  // TEST 2: Admin creates another admin (secondary.admin@pnp.arena)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 2: Admin creates additional administrator ---');
  const createAdminPayload = JSON.stringify({
    name: 'Secondary Admin',
    email: 'secondary.admin@pnp.arena',
    password: 'secAdmin@2024Pass',
    confirmPassword: 'secAdmin@2024Pass',
    role: 'ADMIN',
    isActive: true,
  });

  const t2Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(createAdminPayload),
      'Cookie': `pnp_session=${adminCookie}`,
    },
  }, createAdminPayload);

  const t2Json = JSON.parse(t2Res.body);
  const t2Pass = t2Res.statusCode === 200 && t2Json.success && t2Json.user?.role === 'ADMIN';
  console.log(`  Status: ${t2Res.statusCode}, Message: ${t2Json.message}, Created Role: ${t2Json.user?.role}`);
  testResults.push({
    testId: 'TEST 2',
    name: 'Admin creates additional administrator in MySQL',
    passed: t2Pass,
    details: t2Pass ? `Created admin ${t2Json.user?.email} with role ADMIN` : `Failed: ${t2Res.body}`,
  });

  // Verify secondary admin can login
  const secLoginPayload = JSON.stringify({
    email: 'secondary.admin@pnp.arena',
    password: 'secAdmin@2024Pass',
  });
  const secLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(secLoginPayload),
    },
  }, secLoginPayload);
  const secLoginJson = JSON.parse(secLoginRes.body);
  secondaryAdminCookie = extractCookie(secLoginRes.headers['set-cookie'], 'pnp_session') || '';
  console.log(`  Secondary Admin Login: ${secLoginJson.user?.role === 'ADMIN' ? 'VERIFIED' : 'FAILED'}`);

  // -----------------------------------------------------------------
  // TEST 3: Admin creates team in MySQL (CSEA-001)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 3: Admin creates team in MySQL ---');
  const createTeamPayload = JSON.stringify({
    teamId: 'CSEA-001',
    teamName: 'Example Innovation Team',
    members: [],
  });

  const t3Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/teams',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(createTeamPayload),
      'Cookie': `pnp_session=${adminCookie}`,
    },
  }, createTeamPayload);

  const t3Json = JSON.parse(t3Res.body);
  const t3Pass = t3Res.statusCode === 200 && t3Json.success && t3Json.team?.id === 'CSEA-001';
  console.log(`  Status: ${t3Res.statusCode}, Team: ${t3Json.team?.name} (${t3Json.team?.id})`);
  testResults.push({
    testId: 'TEST 3',
    name: 'Admin creates team record in MySQL',
    passed: t3Pass,
    details: t3Pass ? `Team ${t3Json.team?.name} created` : `Failed: ${t3Res.body}`,
  });

  // -----------------------------------------------------------------
  // TEST 4: Add first Team Leader (Pradesh/Member 1)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 4: Add first Team Leader ---');
  const addLeaderPayload = JSON.stringify({
    teamId: 'CSEA-001',
    name: 'Member 1 Leader',
    email: 'leader.csea1@test.com',
    role: 'TEAM_LEADER',
  });

  const t4Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/teams/members',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(addLeaderPayload),
      'Cookie': `pnp_session=${adminCookie}`,
    },
  }, addLeaderPayload);

  const t4Json = JSON.parse(t4Res.body);
  const t4Pass = t4Res.statusCode === 200 && t4Json.success && t4Json.member?.role === 'TEAM_LEADER';
  console.log(`  Status: ${t4Res.statusCode}, Member: ${t4Json.member?.name}, Role: ${t4Json.member?.role}`);
  testResults.push({
    testId: 'TEST 4',
    name: 'Add first Team Leader to team roster',
    passed: t4Pass,
    details: t4Pass ? `Assigned TEAM_LEADER (${t4Json.member?.email})` : `Failed: ${t4Res.body}`,
  });

  // -----------------------------------------------------------------
  // TEST 5: Add two Team Members (Member 2 and Member 3)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 5: Add two Team Members ---');
  const m2Payload = JSON.stringify({
    teamId: 'CSEA-001',
    name: 'Member 2 Regular',
    email: 'member2.csea1@test.com',
    role: 'TEAM_MEMBER',
  });
  const t5aRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/teams/members',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(m2Payload),
      'Cookie': `pnp_session=${adminCookie}`,
    },
  }, m2Payload);

  const m3Payload = JSON.stringify({
    teamId: 'CSEA-001',
    name: 'Member 3 Regular',
    email: 'member3.csea1@test.com',
    role: 'TEAM_MEMBER',
  });
  const t5bRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/teams/members',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(m3Payload),
      'Cookie': `pnp_session=${adminCookie}`,
    },
  }, m3Payload);

  const t5Pass = t5aRes.statusCode === 200 && t5bRes.statusCode === 200;
  console.log(`  Status Member 2: ${t5aRes.statusCode}, Status Member 3: ${t5bRes.statusCode}`);
  testResults.push({
    testId: 'TEST 5',
    name: 'Add two Team Members to complete 3-member roster',
    passed: t5Pass,
    details: t5Pass ? 'Both team members added successfully' : 'Failed to add members',
  });

  // -----------------------------------------------------------------
  // TEST 6: Attempt fourth member -> Rejected with TEAM_FULL
  // -----------------------------------------------------------------
  console.log('\n--- TEST 6: Attempt fourth member (Capacity Constraint <= 3) ---');
  const m4Payload = JSON.stringify({
    teamId: 'CSEA-001',
    name: 'Member 4 Extra',
    email: 'member4.csea1@test.com',
    role: 'TEAM_MEMBER',
  });
  const t6Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/teams/members',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(m4Payload),
      'Cookie': `pnp_session=${adminCookie}`,
    },
  }, m4Payload);

  const t6Json = JSON.parse(t6Res.body);
  const t6Pass = t6Res.statusCode === 400 && t6Json.code === 'TEAM_FULL';
  console.log(`  Status: ${t6Res.statusCode}, Code: ${t6Json.code}, Message: ${t6Json.message}`);
  testResults.push({
    testId: 'TEST 6',
    name: 'Attempt fourth member rejected by team capacity limit',
    passed: t6Pass,
    details: t6Pass ? 'Correctly rejected with HTTP 400 TEAM_FULL' : `Failed: ${t6Res.body}`,
  });

  // -----------------------------------------------------------------
  // TEST 7: Attempt second Team Leader -> Rejected with SECOND_LEADER_REJECTED
  // -----------------------------------------------------------------
  console.log('\n--- TEST 7: Attempt second Team Leader on team ---');
  // First create another team with 1 leader to test single-leader rule
  const team2Payload = JSON.stringify({
    teamId: 'CSEA-002',
    teamName: 'Second Test Team',
    members: [{ name: 'First Leader', email: 'first.leader@csea2.test', role: 'TEAM_LEADER' }],
  });
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/teams',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(team2Payload),
      'Cookie': `pnp_session=${adminCookie}`,
    },
  }, team2Payload);

  // Attempt adding second leader
  const secondLeaderPayload = JSON.stringify({
    teamId: 'CSEA-002',
    name: 'Second Leader Attempt',
    email: 'second.leader@csea2.test',
    role: 'TEAM_LEADER',
  });
  const t7Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/teams/members',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(secondLeaderPayload),
      'Cookie': `pnp_session=${adminCookie}`,
    },
  }, secondLeaderPayload);

  const t7Json = JSON.parse(t7Res.body);
  const t7Pass = t7Res.statusCode === 400 && t7Json.code === 'SECOND_LEADER_REJECTED';
  console.log(`  Status: ${t7Res.statusCode}, Code: ${t7Json.code}, Message: ${t7Json.message}`);
  testResults.push({
    testId: 'TEST 7',
    name: 'Attempt second Team Leader rejected by composition rule',
    passed: t7Pass,
    details: t7Pass ? 'Correctly rejected with HTTP 400 SECOND_LEADER_REJECTED' : `Failed: ${t7Res.body}`,
  });

  // -----------------------------------------------------------------
  // TEST 8: Create real Team Leader account (register leader.csea1@test.com)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 8: Create real Team Leader account ---');
  const regLeaderPayload = JSON.stringify({
    name: 'Member 1 Leader',
    email: 'leader.csea1@test.com',
    teamId: 'CSEA-001',
    password: 'LeaderPassword123!',
    confirmPassword: 'LeaderPassword123!',
  });

  const t8Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(regLeaderPayload),
    },
  }, regLeaderPayload);

  const t8Json = JSON.parse(t8Res.body);
  const t8Pass = t8Res.statusCode === 200 && t8Json.success && t8Json.user?.role === 'TEAM_LEADER';
  leaderCookie = extractCookie(t8Res.headers['set-cookie'], 'pnp_session') || '';
  console.log(`  Status: ${t8Res.statusCode}, User: ${t8Json.user?.name}, Assigned Role: ${t8Json.user?.role}`);
  testResults.push({
    testId: 'TEST 8',
    name: 'Create real Team Leader account via registration',
    passed: t8Pass,
    details: t8Pass ? 'Authoritative role TEAM_LEADER assigned from roster' : `Failed: ${t8Res.body}`,
  });

  // -----------------------------------------------------------------
  // TEST 9: Create real Team Member account (register member2.csea1@test.com)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 9: Create real Team Member account ---');
  const regMemberPayload = JSON.stringify({
    name: 'Member 2 Regular',
    email: 'member2.csea1@test.com',
    teamId: 'CSEA-001',
    password: 'MemberPassword123!',
    confirmPassword: 'MemberPassword123!',
  });

  const t9Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(regMemberPayload),
    },
  }, regMemberPayload);

  const t9Json = JSON.parse(t9Res.body);
  const t9Pass = t9Res.statusCode === 200 && t9Json.success && t9Json.user?.role === 'TEAM_MEMBER';
  memberCookie = extractCookie(t9Res.headers['set-cookie'], 'pnp_session') || '';
  console.log(`  Status: ${t9Res.statusCode}, User: ${t9Json.user?.name}, Assigned Role: ${t9Json.user?.role}`);
  testResults.push({
    testId: 'TEST 9',
    name: 'Create real Team Member account via registration',
    passed: t9Pass,
    details: t9Pass ? 'Authoritative role TEAM_MEMBER assigned from roster' : `Failed: ${t9Res.body}`,
  });

  // -----------------------------------------------------------------
  // TEST 10: Attempt to submit role = ADMIN from participant registration
  // -----------------------------------------------------------------
  console.log('\n--- TEST 10: Attempt role injection during participant registration ---');
  const injectRolePayload = JSON.stringify({
    name: 'Member 3 Regular',
    email: 'member3.csea1@test.com',
    teamId: 'CSEA-001',
    password: 'MemberPassword123!',
    confirmPassword: 'MemberPassword123!',
    role: 'ADMIN', // Malicious attempt to self-promote to ADMIN
  });

  const t10Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(injectRolePayload),
    },
  }, injectRolePayload);

  const t10Json = JSON.parse(t10Res.body);
  // Role must be TEAM_MEMBER from roster, NEVER ADMIN
  const t10Pass = t10Res.statusCode === 200 && t10Json.success && t10Json.user?.role === 'TEAM_MEMBER';
  console.log(`  Client sent: role="ADMIN" | Server assigned: role="${t10Json.user?.role}"`);
  testResults.push({
    testId: 'TEST 10',
    name: 'Client-supplied role="ADMIN" ignored/rejected by registration protocol',
    passed: t10Pass,
    details: t10Pass ? 'Server strictly enforced TEAM_MEMBER from database roster' : `Failed: ${t10Res.body}`,
  });

  // -----------------------------------------------------------------
  // TEST 11: Attempt to change teamId from browser / API
  // -----------------------------------------------------------------
  console.log('\n--- TEST 11: Attempt registration with wrong/unauthorized Team ID ---');
  // Attempt to register with a valid email for CSEA-001, but submitting CSEA-002
  const wrongTeamPayload = JSON.stringify({
    name: 'Tamper Attempt',
    email: 'leader.csea1@test.com',
    teamId: 'CSEA-002', // Mismatched team ID
    password: 'Password123!',
    confirmPassword: 'Password123!',
  });

  const t11Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(wrongTeamPayload),
    },
  }, wrongTeamPayload);

  const t11Json = JSON.parse(t11Res.body);
  const t11Pass = t11Res.statusCode === 400 || t11Res.statusCode === 409;
  console.log(`  Status: ${t11Res.statusCode}, Code: ${t11Json.code}, Message: ${t11Json.message}`);
  testResults.push({
    testId: 'TEST 11',
    name: 'Tampered or unauthorized Team ID rejected during registration',
    passed: t11Pass,
    details: t11Pass ? `Rejected with code ${t11Json.code}` : `Failed: ${t11Res.body}`,
  });

  // -----------------------------------------------------------------
  // TEST 12: Attempt to access /admin as TEAM_MEMBER
  // -----------------------------------------------------------------
  console.log('\n--- TEST 12: Attempt to access /admin as TEAM_MEMBER ---');
  const t12Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
    headers: {
      'Cookie': `pnp_session=${memberCookie}`,
    },
  });

  const t12HasRestricted = t12Res.body.includes('Access Restricted') && t12Res.body.includes('TEAM_MEMBER');
  console.log(`  Status: ${t12Res.statusCode}, Access Restricted view rendered: ${t12HasRestricted}`);
  testResults.push({
    testId: 'TEST 12',
    name: 'Attempt to access /admin as TEAM_MEMBER blocked with Access Restricted',
    passed: t12HasRestricted,
    details: t12HasRestricted ? 'Diagnostic Access Restricted view displayed with TEAM_MEMBER role' : 'Restriction view not returned',
  });

  // -----------------------------------------------------------------
  // TEST 13: Attempt to access /admin as INVESTOR
  // -----------------------------------------------------------------
  console.log('\n--- TEST 13: Attempt to access /admin as INVESTOR ---');
  // Create an investor user via admin API
  const createInvestorPayload = JSON.stringify({
    name: 'Angel Investor',
    email: 'investor.test@pnp.arena',
    password: 'InvestorPass123!',
    confirmPassword: 'InvestorPass123!',
    role: 'INVESTOR',
    isActive: true,
  });
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(createInvestorPayload),
      'Cookie': `pnp_session=${adminCookie}`,
    },
  }, createInvestorPayload);

  // Login as investor
  const investorLoginPayload = JSON.stringify({
    email: 'investor.test@pnp.arena',
    password: 'InvestorPass123!',
  });
  const invLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(investorLoginPayload),
    },
  }, investorLoginPayload);
  investorCookie = extractCookie(invLoginRes.headers['set-cookie'], 'pnp_session') || '';

  // Access /admin as INVESTOR
  const t13Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
    headers: {
      'Cookie': `pnp_session=${investorCookie}`,
    },
  });

  const t13HasRestricted = t13Res.body.includes('Access Restricted') && t13Res.body.includes('INVESTOR');
  console.log(`  Status: ${t13Res.statusCode}, Access Restricted view rendered: ${t13HasRestricted}`);
  testResults.push({
    testId: 'TEST 13',
    name: 'Attempt to access /admin as INVESTOR blocked with Access Restricted',
    passed: t13HasRestricted,
    details: t13HasRestricted ? 'Diagnostic Access Restricted view displayed with INVESTOR role' : 'Restriction view not returned',
  });

  // -----------------------------------------------------------------
  // TEST 14: Login as initial ADMIN -> Full access to Arena Control Center
  // -----------------------------------------------------------------
  console.log('\n--- TEST 14: Full access to /admin as Root Super Administrator ---');
  const t14Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
    headers: {
      'Cookie': `pnp_session=${adminCookie}`,
    },
  });

  const t14NoRestriction = !t14Res.body.includes('Access Restricted') && !t14Res.body.includes('UNAUTHORIZED CORRIDOR');
  const t14HasControlCenter = t14Res.body.includes('ARENA CONTROLS') || t14Res.body.includes('Live Investment Tracking');
  const t14Pass = t14Res.statusCode === 200 && t14NoRestriction && t14HasControlCenter;
  console.log(`  Status: ${t14Res.statusCode}, Access Restricted bypassed: ${t14NoRestriction}, Arena Controls visible: ${t14HasControlCenter}`);
  testResults.push({
    testId: 'TEST 14',
    name: 'Initial Root Administrator granted full Arena Control Center access',
    passed: t14Pass,
    details: t14Pass ? 'Full administrative interface rendered cleanly' : 'Admin interface restricted or missing controls',
  });

  // -----------------------------------------------------------------
  // TEST 15: Protect root administrator pradeshkannan64@gmail.com from deactivation
  // -----------------------------------------------------------------
  console.log('\n--- TEST 15: Protect root administrator from accidental deactivation ---');
  // Look up root admin id
  const usersListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users',
    method: 'GET',
    headers: {
      'Cookie': `pnp_session=${adminCookie}`,
    },
  });
  const usersListJson = JSON.parse(usersListRes.body);
  const rootAdminUser = usersListJson.users?.find((u: any) => u.email === 'pradeshkannan64@gmail.com');

  const deactPayload = JSON.stringify({
    userId: rootAdminUser?.id,
    isActive: false,
  });
  const t15Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(deactPayload),
      'Cookie': `pnp_session=${secondaryAdminCookie}`, // Secondary admin tries to deactivate root admin
    },
  }, deactPayload);

  const t15Json = JSON.parse(t15Res.body);
  const t15Pass = t15Res.statusCode === 403 && t15Json.code === 'ROOT_ADMIN_PROTECTED';
  console.log(`  Status: ${t15Res.statusCode}, Code: ${t15Json.code}, Message: ${t15Json.message}`);
  testResults.push({
    testId: 'TEST 15',
    name: 'Root administrator pradeshkannan64@gmail.com permanently protected',
    passed: t15Pass,
    details: t15Pass ? 'Deactivation blocked with HTTP 403 ROOT_ADMIN_PROTECTED' : `Failed: ${t15Res.body}`,
  });

  // -----------------------------------------------------------------
  // TEST 16: Event API returns dynamic real-time stats (0 ideas, 0 investments)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 16: Event API real-time authoritative stats ---');
  const eventRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/event',
    method: 'GET',
  });
  const eventJson = JSON.parse(eventRes.body);
  const t16Pass = eventJson.success && eventJson.event?.status === 'DRAFT' && typeof eventJson.event?.submittedIdeasCount === 'number';
  console.log(`  Status: ${eventRes.statusCode}, Event Status: ${eventJson.event?.status}, Submitted Ideas: ${eventJson.event?.submittedIdeasCount}`);
  testResults.push({
    testId: 'TEST 16',
    name: 'Authoritative dynamic event counts from live MySQL database',
    passed: t16Pass,
    details: t16Pass ? `Event status is ${eventJson.event?.status}` : 'Event stats invalid',
  });

  // Print Summary
  console.log('\n===================================================================');
  console.log('SUMMARY OF 16-POINT AUTHORIZATION MATRIX:');
  console.log('===================================================================');
  let allPass = true;
  for (const r of testResults) {
    console.log(`[${r.passed ? '✅ PASS' : '❌ FAIL'}] ${r.testId}: ${r.name}`);
    if (!r.passed) {
      console.log(`   -> Details: ${r.details}`);
      allPass = false;
    }
  }

  if (allPass) {
    console.log('\n🎉 ALL 16 TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
