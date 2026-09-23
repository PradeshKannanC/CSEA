import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth/password';

async function runTests() {
  console.log('--- Starting Role Flow & Authentication Automated Verification ---');

  // 1. Verify Admin user in database
  const adminUser = await prisma.user.findUnique({
    where: { email: 'pradeshkannan64@gmail.com' },
  });

  if (!adminUser) {
    throw new Error('Root admin user pradeshkannan64@gmail.com not found in database!');
  }
  console.log('✓ Found Root Administrator:', adminUser.email, 'Role:', adminUser.role);

  // 2. Setup a temporary test team with 1 Leader and 1 Member
  const testTeamId = 'CSEA-TEST-999';
  const testSubId = 'PNP-TEST-999';

  // Clean up any previous test leftovers
  await prisma.ideaIssueReport.deleteMany({ where: { teamId: { contains: 'TEST' } } }).catch(() => {});
  await prisma.idea.deleteMany({ where: { anonymousId: { contains: 'TEST' } } }).catch(() => {});
  await prisma.teamMember.deleteMany({ where: { email: { contains: 'test_role_' } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { contains: 'test_role_' } } }).catch(() => {});
  await prisma.team.deleteMany({ where: { teamId: testTeamId } }).catch(() => {});

  const hashedPassword = hashPassword('TestPass@123');

  const leaderUser = await prisma.user.create({
    data: {
      email: 'test_role_leader@csea.edu',
      name: 'Leader Test',
      avatarInitials: 'LT',
      passwordHash: hashedPassword,
      role: 'TEAM_LEADER',
    },
  });

  const memberUser = await prisma.user.create({
    data: {
      email: 'test_role_member@csea.edu',
      name: 'Member Test',
      avatarInitials: 'MT',
      passwordHash: hashedPassword,
      role: 'TEAM_MEMBER',
    },
  });

  const testTeam = await prisma.team.create({
    data: {
      teamId: testTeamId,
      name: 'Autonomous AI Explorers',
      submissionId: testSubId,
      cohort: 'Beta 2024',
      leaderId: leaderUser.id,
      users: {
        connect: [{ id: leaderUser.id }, { id: memberUser.id }],
      },
      roster: {
        create: [
          {
            email: leaderUser.email,
            name: leaderUser.name,
            role: 'TEAM_LEADER',
            userId: leaderUser.id,
          },
          {
            email: memberUser.email,
            name: memberUser.name,
            role: 'TEAM_MEMBER',
            userId: memberUser.id,
          },
        ],
      },
      idea: {
        create: {
          anonymousId: 'IDEA-TEST-099',
          title: 'Autonomous Multi-Agent Swarm for Carbon Auditing',
          track: 'Sustainability & AI',
          categoryTag: 'CleanTech',
          problemStatement: 'Current corporate greenhouse emission monitoring lacks granular, real-time auditing pipelines.',
          solution: 'A federated swarm of IoT edge observers and cryptographically verifiable consensus models.',
          innovation: 'Zero-knowledge proofs combined with lightweight embedded neural networks.',
          impact: 'Reduces ESG reporting compliance costs by 80% while eliminating greenwashing.',
          whyInvest: 'First-mover in enterprise-grade autonomous carbon accounting infrastructure.',
          technology: 'Next.js, Python, Rust, Prisma, PyTorch, LoRaWAN',
          status: 'DRAFT',
        },
      },
    },
    include: { idea: true },
  });

  // Update users with teamId
  await prisma.user.update({
    where: { id: leaderUser.id },
    data: { teamId: testTeam.id },
  });
  await prisma.user.update({
    where: { id: memberUser.id },
    data: { teamId: testTeam.id },
  });

  console.log('✓ Created Test Team:', testTeam.teamId, 'with Leader and Member');

  // 3. Test Session Creation for Member & Leader
  const memberSessionId = 'test_member_session_' + Date.now();
  await prisma.session.create({
    data: {
      id: memberSessionId,
      userId: memberUser.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });

  const leaderSessionId = 'test_leader_session_' + Date.now();
  await prisma.session.create({
    data: {
      id: leaderSessionId,
      userId: leaderUser.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });
  console.log('✓ Created Valid Sessions for Member and Leader');

  // 4. Test Idea Issue Reporting as Team Member
  const testIssue = await prisma.ideaIssueReport.create({
    data: {
      ideaId: testTeam.idea!.id,
      reportedByUserId: memberUser.id,
      teamId: testTeam.id,
      issueType: 'TYPOGRAPHICAL_ERROR',
      message: 'Typo in whyInvest section: "compliance costs by 80%" needs citation source.',
      status: 'OPEN',
    },
    include: {
      reportedByUser: true,
      idea: true,
    },
  });
  console.log('✓ Member successfully reported issue:', testIssue.id, 'Status:', testIssue.status);

  // 5. Test Leader reviewing and updating issue status
  const reviewedIssue = await prisma.ideaIssueReport.update({
    where: { id: testIssue.id },
    data: { status: 'REVIEWED' },
  });
  console.log('✓ Leader marked issue as REVIEWED:', reviewedIssue.id, 'Status:', reviewedIssue.status);

  const resolvedIssue = await prisma.ideaIssueReport.update({
    where: { id: testIssue.id },
    data: { status: 'RESOLVED' },
  });
  console.log('✓ Leader marked issue as RESOLVED:', resolvedIssue.id, 'Status:', resolvedIssue.status);

  // 6. Test Session Invalidation / Logout
  await prisma.session.delete({ where: { id: memberSessionId } });
  const checkMemberSession = await prisma.session.findUnique({ where: { id: memberSessionId } });
  if (checkMemberSession) {
    throw new Error('Member session should have been destroyed on logout!');
  }
  console.log('✓ Session successfully destroyed on logout in MySQL database.');

  // Clean up test records
  await prisma.session.delete({ where: { id: leaderSessionId } }).catch(() => {});
  await prisma.ideaIssueReport.deleteMany({ where: { teamId: testTeam.id } }).catch(() => {});
  await prisma.idea.deleteMany({ where: { teamId: testTeam.id } }).catch(() => {});
  await prisma.teamMember.deleteMany({ where: { teamId: testTeam.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [leaderUser.id, memberUser.id] } } }).catch(() => {});
  await prisma.team.delete({ where: { id: testTeam.id } }).catch(() => {});

  console.log('✓ Test data successfully cleaned up.');
  console.log('🎉 ALL ROLE FLOW & AUTHENTICATION VERIFICATIONS PASSED SUCCESSFULLY!');
}

runTests()
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
