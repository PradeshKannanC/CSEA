import { PrismaClient, UserRole, EventStatus } from '@prisma/client';

const prisma = new PrismaClient();

const LEGITIMATE_ADMIN_EMAIL = 'pradeshkannan64@gmail.com';

const LEGITIMATE_TEAMS = [
  {
    name: 'EcoPulse',
    teamId: 'CSEA-101',
    submissionId: 'PNP-2024-101',
    cohort: 'Alpha 2024',
    leaderEmail: 'kavya.ecopulse@student.tce.edu',
    members: [
      {
        name: 'Kavya Raman',
        email: 'kavya.ecopulse@student.tce.edu',
        role: UserRole.TEAM_LEADER,
        title: 'Team Leader & Grid Systems Engineer',
      },
      {
        name: 'Siddharth Roy',
        email: 'siddharth.ecopulse@student.tce.edu',
        role: UserRole.TEAM_MEMBER,
        title: 'Embedded Firmware Specialist',
      },
      {
        name: 'Ananya Das',
        email: 'ananya.ecopulse@student.tce.edu',
        role: UserRole.TEAM_MEMBER,
        title: 'Energy Market Analyst',
      },
    ],
  },
  {
    name: 'MediBridge',
    teamId: 'CSEA-102',
    submissionId: 'PNP-2024-102',
    cohort: 'Alpha 2024',
    leaderEmail: 'rohan.medibridge@student.tce.edu',
    members: [
      {
        name: 'Rohan Verma',
        email: 'rohan.medibridge@student.tce.edu',
        role: UserRole.TEAM_LEADER,
        title: 'Team Leader & Biomedical AI Lead',
      },
      {
        name: 'Deepa Krishnan',
        email: 'deepa.medibridge@student.tce.edu',
        role: UserRole.TEAM_MEMBER,
        title: 'Clinical Workflow Architect',
      },
      {
        name: 'Gautam Nair',
        email: 'gautam.medibridge@student.tce.edu',
        role: UserRole.TEAM_MEMBER,
        title: 'Hardware Systems Engineer',
      },
    ],
  },
  {
    name: 'TransitIQ',
    teamId: 'CSEA-103',
    submissionId: 'PNP-2024-103',
    cohort: 'Alpha 2024',
    leaderEmail: 'harish.transitiq@student.tce.edu',
    members: [
      {
        name: 'Harish Kumar',
        email: 'harish.transitiq@student.tce.edu',
        role: UserRole.TEAM_LEADER,
        title: 'Team Leader & Distributed Systems Engineer',
      },
      {
        name: 'Sneha Patel',
        email: 'sneha.transitiq@student.tce.edu',
        role: UserRole.TEAM_MEMBER,
        title: 'Operations Research & Mobility Modeler',
      },
      {
        name: 'Varun Mehta',
        email: 'varun.transitiq@student.tce.edu',
        role: UserRole.TEAM_MEMBER,
        title: 'Full-Stack Fleet Telemetry Developer',
      },
    ],
  },
];

async function cleanProductionData() {
  console.log('============================================================');
  console.log('CLEANING PRODUCTION DATA — REMOVING DEMO / TEST RECORDS');
  console.log('============================================================\n');

  // Extract all legitimate emails and teamIds
  const legitimateEmails = new Set<string>();
  legitimateEmails.add(LEGITIMATE_ADMIN_EMAIL);
  const legitimateTeamCodes = new Set<string>();

  for (const t of LEGITIMATE_TEAMS) {
    legitimateTeamCodes.add(t.teamId);
    for (const m of t.members) {
      legitimateEmails.add(m.email.toLowerCase());
    }
  }

  console.log(`Legitimate emails to preserve (${legitimateEmails.size}):`, Array.from(legitimateEmails));
  console.log(`Legitimate team codes to preserve:`, Array.from(legitimateTeamCodes));

  // 1. Delete all Investments (0 demo/sample investments)
  const delInvestments = await prisma.investment.deleteMany();
  console.log(`\n1. Deleted ${delInvestments.count} Investments`);

  // 2. Delete all Results (0 demo/sample results)
  const delResults = await prisma.result.deleteMany();
  console.log(`2. Deleted ${delResults.count} Results`);

  // 3. Delete all Participant Budgets (0 demo budgets)
  const delBudgets = await prisma.participantBudget.deleteMany();
  console.log(`3. Deleted ${delBudgets.count} ParticipantBudgets`);

  // 4. Delete all Idea Issue Reports
  const delReports = await prisma.ideaIssueReport.deleteMany();
  console.log(`4. Deleted ${delReports.count} IdeaIssueReports`);

  // 5. Disassociate users from rooms
  await prisma.user.updateMany({
    data: { roomId: null }
  });
  console.log(`5. Disassociated all users from rooms`);

  // 6. Disassociate teams from rooms
  await prisma.team.updateMany({
    data: { roomId: null }
  });
  console.log(`6. Disassociated all teams from rooms`);

  // 7. Delete all Ideas (0 demo/sample ideas, 0 demo/sample submissions)
  const delIdeas = await prisma.idea.deleteMany();
  console.log(`7. Deleted ${delIdeas.count} Ideas`);

  // 8. Delete all Rooms (EXACTLY 0 rooms)
  const delRooms = await prisma.room.deleteMany();
  console.log(`8. Deleted ${delRooms.count} Rooms`);

  // 9. Find legitimate teams in DB
  const legitTeamsInDb = await prisma.team.findMany({
    where: { teamId: { in: Array.from(legitimateTeamCodes) } }
  });
  const legitTeamDbIds = legitTeamsInDb.map(t => t.id);
  console.log(`9. Found ${legitTeamsInDb.length} legitimate teams in DB`);

  // Clear leaderId on all demo teams so we can delete users and demo teams cleanly
  await prisma.team.updateMany({
    where: { id: { notIn: legitTeamDbIds } },
    data: { leaderId: null }
  });

  // Delete team members for demo teams
  const delDemoTeamMembers = await prisma.teamMember.deleteMany({
    where: { teamId: { notIn: legitTeamDbIds } }
  });
  console.log(`10. Deleted ${delDemoTeamMembers.count} TeamMember entries for demo teams`);

  // Delete all demo teams
  const delDemoTeams = await prisma.team.deleteMany({
    where: { id: { notIn: legitTeamDbIds } }
  });
  console.log(`11. Deleted ${delDemoTeams.count} Demo Teams`);

  // 12. Find all users not in legitimate list
  const demoUsers = await prisma.user.findMany({
    where: { email: { notIn: Array.from(legitimateEmails) } },
    select: { id: true, email: true }
  });
  const demoUserIds = demoUsers.map(u => u.id);
  console.log(`12. Identified ${demoUserIds.length} demo/test users to purge`);

  // Delete relations of demo users
  await prisma.session.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.notification.deleteMany({ where: { recipientUserId: { in: demoUserIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: demoUserIds } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.teamMember.deleteMany({ where: { userId: { in: demoUserIds } } });

  // Delete demo users
  const delUsers = await prisma.user.deleteMany({
    where: { id: { in: demoUserIds } }
  });
  console.log(`13. Purged ${delUsers.count} demo users`);

  // 14. Clean up remaining demo data on legitimate users
  // Delete all remaining wallet transactions (Demo wallet/budget data: 0)
  const delTx = await prisma.walletTransaction.deleteMany();
  console.log(`14. Deleted ${delTx.count} WalletTransactions`);

  // Delete notifications and sessions
  await prisma.notification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  console.log(`15. Cleared notifications, sessions, password reset tokens`);

  // 15. Ensure clean Event: exactly 1 production event in DRAFT status
  const delOtherEvents = await prisma.event.deleteMany({
    where: { id: { not: 'evt-pnp-production' } }
  });
  console.log(`16. Deleted ${delOtherEvents.count} non-production events`);

  // Ensure production event exists with status DRAFT
  await prisma.event.upsert({
    where: { id: 'evt-pnp-production' },
    create: {
      id: 'evt-pnp-production',
      name: 'PITCH AND PROSPER Arena 2024',
      status: EventStatus.DRAFT,
      round: 1,
      totalCoins: 100,
      minInvestment: 10,
      maxInvestment: 50,
      totalDistributedCoins: 0,
      targetTeamsCount: 50,
      investmentStartsAt: null,
      investmentEndsAt: null,
      revealedAt: null,
    },
    update: {
      name: 'PITCH AND PROSPER Arena 2024',
      status: EventStatus.DRAFT,
      round: 1,
      totalCoins: 100,
      minInvestment: 10,
      maxInvestment: 50,
      totalDistributedCoins: 0,
      targetTeamsCount: 50,
      investmentStartsAt: null,
      investmentEndsAt: null,
      revealedAt: null,
    },
  });
  console.log(`17. Verified production event 'evt-pnp-production' [DRAFT, Round 1]`);

  // 16. Verify Root Administrator
  const rootAdmin = await prisma.user.findUnique({
    where: { email: LEGITIMATE_ADMIN_EMAIL },
  });
  if (!rootAdmin) {
    throw new Error(`Root administrator ${LEGITIMATE_ADMIN_EMAIL} was not found!`);
  }
  await prisma.user.update({
    where: { id: rootAdmin.id },
    data: {
      role: UserRole.ADMIN,
      isActive: true,
      emailVerified: true,
      teamId: null,
      roomId: null,
    },
  });
  console.log(`18. Verified Root Administrator: ${rootAdmin.name} (${rootAdmin.email}) [ADMIN]`);

  // 17. Verify and align the 3 legitimate teams and their rosters
  for (const teamDef of LEGITIMATE_TEAMS) {
    let team = await prisma.team.findUnique({
      where: { teamId: teamDef.teamId },
    });

    if (!team) {
      team = await prisma.team.create({
        data: {
          teamId: teamDef.teamId,
          name: teamDef.name,
          submissionId: teamDef.submissionId,
          cohort: teamDef.cohort,
        },
      });
    } else {
      team = await prisma.team.update({
        where: { id: team.id },
        data: {
          name: teamDef.name,
          submissionId: teamDef.submissionId,
          cohort: teamDef.cohort,
          roomId: null,
        },
      });
    }

    let leaderUserId: string | null = null;

    // Remove any unexpected roster members for this team
    const validEmails = teamDef.members.map(m => m.email.toLowerCase());
    await prisma.teamMember.deleteMany({
      where: {
        teamId: team.id,
        email: { notIn: validEmails },
      },
    });

    for (const memberDef of teamDef.members) {
      const email = memberDef.email.toLowerCase();
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error(`Expected participant user ${email} not found!`);
      }

      // Ensure proper role, teamId, active
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: memberDef.name,
          role: memberDef.role,
          teamId: team.id,
          roomId: null,
          isActive: true,
          emailVerified: true,
        },
      });

      if (memberDef.role === UserRole.TEAM_LEADER) {
        leaderUserId = user.id;
      }

      // Ensure TeamMember roster entry
      await prisma.teamMember.upsert({
        where: {
          teamId_email: {
            teamId: team.id,
            email,
          },
        },
        create: {
          teamId: team.id,
          userId: user.id,
          email,
          name: memberDef.name,
          role: memberDef.role,
        },
        update: {
          userId: user.id,
          name: memberDef.name,
          role: memberDef.role,
        },
      });

      // Reset Wallet to 100 available, 0 invested
      await prisma.wallet.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          totalCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
        update: {
          totalCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
      });
    }

    // Set leaderId on team
    if (leaderUserId) {
      await prisma.team.update({
        where: { id: team.id },
        data: { leaderId: leaderUserId },
      });
    }
    console.log(`19. Verified Team "${team.name}" (${team.teamId}) with 1 Leader + 2 Members`);
  }

  // 18. Audit log initial state
  await prisma.auditLog.deleteMany();
  await prisma.auditLog.create({
    data: {
      userId: rootAdmin.id,
      action: 'PRODUCTION_VERIFIED_CLEAN',
      entity: 'SYSTEM',
      entityId: 'evt-pnp-production',
      metadata: {
        timestamp: new Date().toISOString(),
        verifiedBy: rootAdmin.email,
        teams: LEGITIMATE_TEAMS.map(t => t.name),
      },
    },
  });

  console.log('\n============================================================');
  console.log('PRODUCTION DATABASE CLEANUP COMPLETE');
  console.log('============================================================\n');
}

cleanProductionData()
  .catch((err) => {
    console.error('Fatal cleanup error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
