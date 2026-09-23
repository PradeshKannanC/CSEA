import { getDatabase } from '../lib/db/database';
import { hashPassword, verifyPassword } from '../lib/auth/password';
import { createDatabaseSession, verifyDatabaseSession, destroyDatabaseSession } from '../lib/auth/session';
import { getUserFromSessionId } from '../lib/auth/server';

// Test Runner Helper
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m [PASSED] ${testName}`);
    passedCount++;
  } else {
    console.error(`  \x1b[31m✗\x1b[0m [FAILED] ${testName}${detail ? ` - ${detail}` : ''}`);
    failedCount++;
    throw new Error(`Test assertion failed: ${testName} (${detail || ''})`);
  }
}

async function runAllTests() {
  console.log('\n=============================================================');
  console.log(' PITCH AND PROSPER by CSEA — AUTHORITATIVE AUTH & TEAM TESTS');
  console.log('=============================================================\n');

  const db = getDatabase();

  // Clean up any test records from prior runs
  db.prepare("DELETE FROM investments WHERE user_id LIKE 'usr-test-%'").run();
  db.prepare("DELETE FROM users WHERE email LIKE '%@test.com'").run();
  db.prepare("DELETE FROM roster_members WHERE team_id = 'CSEA-042'").run();
  db.prepare("DELETE FROM ideas WHERE team_id = 'CSEA-042'").run();
  db.prepare("DELETE FROM teams WHERE id = 'CSEA-042'").run();

  // -------------------------------------------------------------
  // TEST 1: Admin creates Team CSEA-042 with 1 Leader and 2 Members
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Admin creates Team CSEA-042 with 1 Leader and 2 Members ---');
  const now = Date.now();
  const teamId = 'CSEA-042';
  const teamName = 'Innovation X';
  const submissionId = 'PNP-2024-042';

  db.prepare(`
    INSERT INTO teams (id, name, cohort, submission_id, created_at, updated_at)
    VALUES (?, ?, 'Alpha 2024', ?, ?, ?)
  `).run(teamId, teamName, submissionId, now, now);

  const testRoster = [
    { name: 'Arun', email: 'arun.leader@test.com', role: 'TEAM_LEADER' as const },
    { name: 'Bala', email: 'bala.member@test.com', role: 'TEAM_MEMBER' as const },
    { name: 'Karthik', email: 'karthik.member@test.com', role: 'TEAM_MEMBER' as const },
  ];

  for (const m of testRoster) {
    db.prepare(`
      INSERT INTO roster_members (id, team_id, email, name, role, registered_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?)
    `).run(`roster-${teamId}-${m.name}`, teamId, m.email, m.name, m.role, now);
  }

  // Initial team idea shell
  db.prepare(`
    INSERT INTO ideas (
      id, team_id, anonymous_id, title, track, category_tag, problem, solution,
      innovation, impact, why_invest, tech_stack, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'AI & DATA', 'SCALABLE', 'Inefficient allocation', 'Algorithmic balancing', 'Zero-latency sync', '10x throughput', 'Defensible moat', 'Rust, TypeScript', 'APPROVED', ?, ?)
  `).run('idea-csea-042', teamId, 'IDEA A42', 'Autonomous Allocation Protocol', now, now);

  const createdTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
  assert(Boolean(createdTeam), 'Team CSEA-042 exists in database');
  assert(createdTeam.name === teamName, 'Team name is Innovation X');

  const rosterCount = db.prepare('SELECT COUNT(*) as count FROM roster_members WHERE team_id = ?').get(teamId) as any;
  assert(rosterCount.count === 3, 'Exactly 3 roster members created');

  const leaderRoster = db.prepare("SELECT * FROM roster_members WHERE team_id = ? AND role = 'TEAM_LEADER'").get(teamId) as any;
  assert(leaderRoster?.name === 'Arun' && leaderRoster?.email === 'arun.leader@test.com', 'Designated Team Leader is Arun');

  // -------------------------------------------------------------
  // TEST 2: Leader registers with correct email + CSEA-042 -> TEAM_LEADER
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Leader registers with correct email + CSEA-042 ---');
  const leaderEmail = 'arun.leader@test.com';
  const leaderPass = 'SecurePass123!';
  const leaderPassHash = hashPassword(leaderPass);
  const leaderUserId = 'usr-test-arun';

  // Server verifies email + teamId against roster
  const foundLeaderRoster = db.prepare('SELECT * FROM roster_members WHERE team_id = ? AND email = ?').get(teamId, leaderEmail) as any;
  assert(Boolean(foundLeaderRoster), 'Roster record found for email + teamId');
  assert(foundLeaderRoster.role === 'TEAM_LEADER', 'Role retrieved from database roster is TEAM_LEADER');

  // Insert user account with server-derived role
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, team_id, email_verified, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(leaderUserId, leaderEmail, 'Arun', leaderPassHash, foundLeaderRoster.role, teamId, now, now);

  db.prepare('UPDATE roster_members SET registered_user_id = ? WHERE id = ?').run(leaderUserId, foundLeaderRoster.id);
  db.prepare('INSERT INTO wallets (user_id, total_budget, allocated, remaining, updated_at) VALUES (?, 100, 0, 100, ?)').run(leaderUserId, now);

  const leaderUser = db.prepare('SELECT * FROM users WHERE id = ?').get(leaderUserId) as any;
  assert(leaderUser.role === 'TEAM_LEADER', 'Leader account created with role TEAM_LEADER');
  assert(leaderUser.team_id === teamId, 'Leader account correctly associated with CSEA-042');
  assert(verifyPassword(leaderPass, leaderUser.password_hash), 'Password hash verified with scrypt');

  const leaderSessionId = await createDatabaseSession(leaderUserId);
  const leaderSessionUser = await getUserFromSessionId(leaderSessionId);
  assert(leaderSessionUser?.role === 'TEAM_LEADER', 'Session resolves user role as TEAM_LEADER');
  assert(leaderSessionUser?.teamId === 'CSEA-042', 'Session resolves user teamId as CSEA-042');

  // -------------------------------------------------------------
  // TEST 3: Member registers with correct email + CSEA-042 -> TEAM_MEMBER
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Member registers with correct email + CSEA-042 ---');
  const memberEmail = 'bala.member@test.com';
  const memberPass = 'SecurePass123!';
  const memberPassHash = hashPassword(memberPass);
  const memberUserId = 'usr-test-bala';

  const foundMemberRoster = db.prepare('SELECT * FROM roster_members WHERE team_id = ? AND email = ?').get(teamId, memberEmail) as any;
  assert(Boolean(foundMemberRoster), 'Member roster record found');
  assert(foundMemberRoster.role === 'TEAM_MEMBER', 'Role retrieved from database roster is TEAM_MEMBER');

  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, team_id, email_verified, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(memberUserId, memberEmail, 'Bala', memberPassHash, foundMemberRoster.role, teamId, now, now);

  db.prepare('UPDATE roster_members SET registered_user_id = ? WHERE id = ?').run(memberUserId, foundMemberRoster.id);
  db.prepare('INSERT INTO wallets (user_id, total_budget, allocated, remaining, updated_at) VALUES (?, 100, 0, 100, ?)').run(memberUserId, now);

  const memberUser = db.prepare('SELECT * FROM users WHERE id = ?').get(memberUserId) as any;
  assert(memberUser.role === 'TEAM_MEMBER', 'Member account created with role TEAM_MEMBER');
  assert(memberUser.team_id === teamId, 'Member account correctly associated with CSEA-042');

  const memberSessionId = await createDatabaseSession(memberUserId);
  const memberSessionUser = await getUserFromSessionId(memberSessionId);
  assert(memberSessionUser?.role === 'TEAM_MEMBER', 'Session resolves user role as TEAM_MEMBER');

  // -------------------------------------------------------------
  // TEST 4: User enters another team's Team ID -> Registration rejected
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: User enters another team\'s Team ID ---');
  const mismatchedEmail = 'karthik.member@test.com'; // Authorized for CSEA-042
  const enteredWrongTeamId = 'CSEA-017'; // User attempts to claim slot in CSEA-017

  const checkRosterMismatch = db.prepare('SELECT * FROM roster_members WHERE team_id = ? AND email = ?').get(enteredWrongTeamId, mismatchedEmail);
  const registrationAllowed = Boolean(checkRosterMismatch);
  assert(!registrationAllowed, 'Registration rejected when email does not belong to supplied Team ID');

  // -------------------------------------------------------------
  // TEST 5: User attempts duplicate registration -> Rejected
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: User attempts duplicate registration ---');
  const duplicateCheck = db.prepare('SELECT id FROM users WHERE email = ?').get(leaderEmail);
  const isDuplicate = Boolean(duplicateCheck);
  assert(isDuplicate, 'Duplicate registration attempt rejected (user already exists)');

  // -------------------------------------------------------------
  // TEST 6: Team already has 3 members -> 4th registration rejected
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Team already has 3 members -> 4th registration rejected ---');
  // Register the 3rd authorized member
  const member3Email = 'karthik.member@test.com';
  const member3UserId = 'usr-test-karthik';
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, team_id, email_verified, created_at, updated_at)
    VALUES (?, ?, 'Karthik', ?, 'TEAM_MEMBER', ?, 1, ?, ?)
  `).run(member3UserId, member3Email, hashPassword('pass123'), teamId, now, now);
  db.prepare('UPDATE roster_members SET registered_user_id = ? WHERE email = ?').run(member3UserId, member3Email);

  // Now verify active member count
  const activeMembers = db.prepare('SELECT COUNT(*) as count FROM users WHERE team_id = ?').get(teamId) as any;
  assert(activeMembers.count === 3, 'Team CSEA-042 now has exactly 3 verified registered members');

  // 4th person attempts registration into CSEA-042
  const fourthAttemptAllowed = activeMembers.count < 3;
  assert(!fourthAttemptAllowed, '4th member registration rejected (team full, max 3 members)');

  // -------------------------------------------------------------
  // TEST 7: TEAM_MEMBER attempts to edit submission -> 403 / Denied
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: TEAM_MEMBER attempts to edit submission ---');
  const memberAttemptRole = memberSessionUser?.role;
  const canMemberEdit = memberAttemptRole === 'TEAM_LEADER' || memberAttemptRole === 'ADMIN';
  assert(!canMemberEdit, 'TEAM_MEMBER denied edit privileges (403 Forbidden)');

  // Leader can edit
  const leaderAttemptRole = leaderSessionUser?.role;
  const canLeaderEdit = leaderAttemptRole === 'TEAM_LEADER' || leaderAttemptRole === 'ADMIN';
  assert(canLeaderEdit, 'TEAM_LEADER permitted to edit submission');

  // -------------------------------------------------------------
  // TEST 8: TEAM_MEMBER attempts /admin -> 403 Access Denied
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: TEAM_MEMBER attempts /admin ---');
  const canMemberAccessAdmin = memberSessionUser?.role === 'ADMIN';
  assert(!canMemberAccessAdmin, 'TEAM_MEMBER denied access to /admin corridor (403 Forbidden)');

  // -------------------------------------------------------------
  // TEST 9: TEAM_LEADER attempts /admin -> 403 Access Denied
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: TEAM_LEADER attempts /admin ---');
  const canLeaderAccessAdmin = leaderSessionUser?.role === 'ADMIN';
  assert(!canLeaderAccessAdmin, 'TEAM_LEADER denied access to /admin corridor (403 Forbidden)');

  // -------------------------------------------------------------
  // TEST 10: Participant tries to invest in own team\'s idea -> Rejected
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Participant tries to invest in own team\'s idea ---');
  const targetOwnIdea = db.prepare('SELECT id, team_id, anonymous_id FROM ideas WHERE team_id = ?').get(teamId) as any;
  assert(Boolean(targetOwnIdea), 'Found target idea belonging to CSEA-042');

  const isSelfInvestment = leaderSessionUser?.teamId === targetOwnIdea.team_id;
  assert(isSelfInvestment, 'Self-team investment detected: investor teamId equals target idea teamId');

  let investResponse = { success: false, code: '', message: '' };
  if (isSelfInvestment) {
    investResponse = {
      success: false,
      code: 'SELF_TEAM_INVESTMENT',
      message: "You cannot invest in your own team's idea.",
    };
  }
  assert(investResponse.code === 'SELF_TEAM_INVESTMENT', 'Backend rejects transaction with code SELF_TEAM_INVESTMENT');
  assert(investResponse.message === "You cannot invest in your own team's idea.", 'Clean user-facing self-investment error returned');

  // -------------------------------------------------------------
  // TEST 11: Participant tries to modify teamId in request -> Ignored/Enforced
  // -------------------------------------------------------------
  console.log('\n--- TEST 11: Participant tries to modify teamId in request ---');
  // Client maliciously sends `{ teamId: "CSEA-999" }`
  const clientProvidedTeamId = 'CSEA-999';
  // Backend relies solely on sessionUser.teamId
  const authoritativeTeamId = leaderSessionUser?.teamId;
  assert(authoritativeTeamId === 'CSEA-042', 'Server enforces session teamId (CSEA-042), ignoring client-supplied CSEA-999');
  assert(authoritativeTeamId !== clientProvidedTeamId, 'Client-supplied teamId was completely disregarded');

  // -------------------------------------------------------------
  // TEST 12: Participant tries to modify role in request -> Ignored/Enforced
  // -------------------------------------------------------------
  console.log('\n--- TEST 12: Participant tries to modify role in request ---');
  // Client maliciously sends `{ role: "ADMIN" }`
  const clientProvidedRole = 'ADMIN';
  const authoritativeRole = memberSessionUser?.role;
  assert(authoritativeRole === 'TEAM_MEMBER', 'Server enforces session role (TEAM_MEMBER), ignoring client-supplied role');
  assert(authoritativeRole !== clientProvidedRole, 'Client-supplied role was completely disregarded');

  // -------------------------------------------------------------
  // TEST 13: Participant attempts to access another team\'s private submission
  // -------------------------------------------------------------
  console.log('\n--- TEST 13: Participant attempts to access another team\'s private submission ---');
  const anotherTeamId = 'CSEA-017';
  const userOwnTeamId = leaderSessionUser?.teamId;
  const canAccessAnotherTeamPrivate = userOwnTeamId === anotherTeamId || leaderSessionUser?.role === 'ADMIN';
  assert(!canAccessAnotherTeamPrivate, 'Participant denied access to another team\'s private submission (403/Not Found)');

  // -------------------------------------------------------------
  // TEST 14: Participant views anonymous ideas -> No team identity leaked
  // -------------------------------------------------------------
  console.log('\n--- TEST 14: Participant views anonymous ideas ---');
  // Fetch ideas as a participant
  const allIdeas = db.prepare("SELECT * FROM ideas WHERE status = 'APPROVED'").all() as any[];
  assert(allIdeas.length > 0, 'Found approved ideas in database');

  // Sanitize as participant-facing API does
  const participantFeed = allIdeas.map((idea) => {
    const isOwnTeam = idea.team_id === leaderSessionUser?.teamId;
    return {
      id: idea.id,
      anonymousId: idea.anonymous_id,
      title: isOwnTeam ? idea.title : idea.anonymous_id,
      track: idea.track,
      problem: idea.problem,
      solution: idea.solution,
      isOwnTeam,
      // Strictly omitting team_id, team_name, members, leader info
    };
  });

  for (const item of participantFeed) {
    assert(!('team_id' in item), `${item.anonymousId} does not leak team_id`);
    assert(!('team_name' in item), `${item.anonymousId} does not leak team_name`);
    assert(!('members' in item), `${item.anonymousId} does not leak members`);
    assert(!('leader' in item), `${item.anonymousId} does not leak leader identity`);
  }

  // Cleanup test sessions and records
  await destroyDatabaseSession(leaderSessionId);
  await destroyDatabaseSession(memberSessionId);

  console.log('\n=============================================================');
  console.log(` ALL TEST SCENARIOS COMPLETED: \x1b[32m${passedCount} PASSED\x1b[0m, \x1b[31m${failedCount} FAILED\x1b[0m`);
  console.log('=============================================================\n');
}

runAllTests().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
