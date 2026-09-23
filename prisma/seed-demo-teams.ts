import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();

const DEMO_TEAMS = [
  {
    teamId: 'CSEA-101',
    name: 'EcoPulse',
    submissionId: 'PNP-2024-101',
    cohort: 'Alpha 2024',
    idea: {
      anonymousId: 'IDEA A101',
      title: 'EcoPulse: Decentralized Microgrid Optimization',
      track: 'SUSTAINABILITY & CLEAN TECH',
      categoryTag: 'ENERGY',
      problemStatement:
        'Traditional grid infrastructure suffers from peak-load inefficiencies and transmission losses exceeding 15%, causing frequent brownouts and elevated carbon emissions during peak periods.',
      solution:
        'A peer-to-peer decentralized microgrid energy balancing platform utilizing algorithmic battery storage orchestration and distributed telemetry.',
      innovation:
        'Dynamic localized tariff adjustments driven by predictive edge solar analytics and machine learning dispatch routines.',
      impact:
        'Reduces neighborhood carbon intensity by 28% and cuts industrial consumer utility spend by 22% during peak transmission hours.',
      whyInvest:
        'Addresses critical renewable integration bottlenecks with patent-pending localized power management hardware and software integration.',
      technology:
        'Edge IoT telemetry sensors, Rust-based local microgrid controllers, Zero-knowledge smart contracts, TimescaleDB.',
      status: 'APPROVED' as const,
      totalInvested: 40,
      investorCount: 2,
    },
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
    teamId: 'CSEA-102',
    name: 'MediBridge',
    submissionId: 'PNP-2024-102',
    cohort: 'Alpha 2024',
    idea: {
      anonymousId: 'IDEA A102',
      title: 'MediBridge: Autonomous Rural Diagnostic Telemetry',
      track: 'HEALTHCARE ACCESSIBILITY',
      categoryTag: 'MEDTECH',
      problemStatement:
        'Rural primary care clinics lack on-site specialist diagnostic tools, resulting in delayed triage for critical cardiovascular and respiratory conditions.',
      solution:
        'A ruggedized portable point-of-care diagnostic station that operates entirely offline with automated clinical feature extraction and priority telemetry relay.',
      innovation:
        'Edge-native optical and acoustic inference algorithms capable of screening 14 biometric indicators in under 90 seconds without cloud connectivity.',
      impact:
        'Brings specialist-grade preliminary triage to underserved primary healthcare centers with zero latency, reducing referral delays by 70%.',
      whyInvest:
        'Scalable deployment model backed by regional health outreach programs, addressing urgent diagnostic deserts across developing markets.',
      technology:
        'Embedded Computer Vision, Edge ML acceleration on custom NPU, Bluetooth Low Energy biosensors, LoRaWAN telemetry.',
      status: 'APPROVED' as const,
      totalInvested: 60,
      investorCount: 3,
    },
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
    teamId: 'CSEA-103',
    name: 'TransitIQ',
    submissionId: 'PNP-2024-103',
    cohort: 'Alpha 2024',
    idea: {
      anonymousId: 'IDEA A103',
      title: 'TransitIQ: Predictive Urban Fleet Synchronization',
      track: 'SMART CITIES & MOBILITY',
      categoryTag: 'TRANSPORTATION',
      problemStatement:
        'Municipal bus and transit fleets experience compounding vehicle bunching and irregular headway, leading to excessive commuter wait times and fleet idle emissions.',
      solution:
        'An adaptive real-time scheduling coordination engine that dynamically regulates vehicle speed and traffic signal priority to maintain equidistant service headway.',
      innovation:
        'Continuous reinforcement learning coordination model executing on localized edge dispatch nodes with real-time transit telemetry.',
      impact:
        'Decreases commuter wait times by 34% while lowering municipal bus fleet idle fuel consumption and emissions by 18%.',
      whyInvest:
        'High-demand software-only municipal mobility technology scalable across tier-2 and tier-3 urban transit authorities.',
      technology:
        'Distributed event-stream processing, Kalman filter telemetry fusion, WebSockets, OpenTripPlanner API, Golang dispatch engine.',
      status: 'APPROVED' as const,
      totalInvested: 25,
      investorCount: 1,
    },
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

async function seedDemoTeams() {
  console.log('--- SEEDING 3 REALISTIC DEMO TEAMS IN MYSQL ---');

  const defaultPasswordHash = hashPassword('Demo@2024');

  for (const teamData of DEMO_TEAMS) {
    console.log(`\nProcessing Team: ${teamData.name} (${teamData.teamId})...`);

    // 1. Create or update Team
    let team = await prisma.team.findUnique({
      where: { teamId: teamData.teamId },
    });

    if (!team) {
      team = await prisma.team.create({
        data: {
          teamId: teamData.teamId,
          name: teamData.name,
          submissionId: teamData.submissionId,
          cohort: teamData.cohort,
        },
      });
      console.log(`  ✓ Created Team record: ${team.name}`);
    } else {
      console.log(`  ✓ Existing Team found: ${team.name}`);
    }

    // 2. Create or update Idea
    const existingIdea = await prisma.idea.findUnique({
      where: { anonymousId: teamData.idea.anonymousId },
    });

    if (!existingIdea) {
      await prisma.idea.create({
        data: {
          ...teamData.idea,
          teamId: team.id,
          status: 'APPROVED',
          isLocked: true,
          lockedAt: new Date(),
          submittedAt: new Date(),
          approvedAt: new Date(),
        },
      });
      console.log(`  ✓ Created Approved Idea: ${teamData.idea.anonymousId} - ${teamData.idea.title}`);
    } else {
      await prisma.idea.update({
        where: { id: existingIdea.id },
        data: {
          teamId: team.id,
          status: 'APPROVED',
          isLocked: true,
        },
      });
      console.log(`  ✓ Updated Idea status: ${teamData.idea.anonymousId}`);
    }

    // 3. Create 3 Members (1 Leader + 2 Members)
    let leaderUserId: string | null = null;

    for (const member of teamData.members) {
      let user = await prisma.user.findUnique({
        where: { email: member.email },
      });

      const avatarInitials = member.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      if (!user) {
        user = await prisma.user.create({
          data: {
            name: member.name,
            email: member.email,
            passwordHash: defaultPasswordHash,
            role: member.role,
            isActive: true,
            emailVerified: true,
            avatarInitials,
            title: member.title,
            teamId: team.id,
          },
        });
        console.log(`  ✓ Created User: ${member.name} (${member.role})`);
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            teamId: team.id,
            role: member.role,
          },
        });
        console.log(`  ✓ Updated User: ${member.name} (${member.role})`);
      }

      if (member.role === UserRole.TEAM_LEADER) {
        leaderUserId = user.id;
      }

      // Upsert TeamMember roster record
      await prisma.teamMember.upsert({
        where: {
          teamId_email: {
            teamId: team.id,
            email: member.email,
          },
        },
        create: {
          teamId: team.id,
          userId: user.id,
          email: member.email,
          name: member.name,
          role: member.role,
        },
        update: {
          userId: user.id,
          name: member.name,
          role: member.role,
        },
      });

      // Ensure Wallet with 100 coins
      await prisma.wallet.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          totalCoins: 100,
          availableCoins: 100,
          investedCoins: 0,
        },
        update: {},
      });
    }

    // Update leaderId on Team
    if (leaderUserId) {
      await prisma.team.update({
        where: { id: team.id },
        data: { leaderId: leaderUserId },
      });
      console.log(`  ✓ Assigned Team Leader: ${leaderUserId}`);
    }
  }

  // Update Event configuration with active counts
  const event = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (event) {
    await prisma.event.update({
      where: { id: event.id },
      data: {
        status: 'OPEN',
        minInvestment: 10,
        maxInvestment: 50,
        totalCoins: 100,
      },
    });
    console.log(`\n✓ Event "${event.name}" set to OPEN for testing.`);
  }

  const userCount = await prisma.user.count();
  const teamCount = await prisma.team.count();
  const ideaCount = await prisma.idea.count();

  console.log('\n============================================================');
  console.log('DEMO DATABASE SEED COMPLETE:');
  console.log(`Total Users: ${userCount} (including Root Admin)`);
  console.log(`Total Teams: ${teamCount} (EcoPulse, MediBridge, TransitIQ)`);
  console.log(`Approved Ideas: ${ideaCount}`);
  console.log('============================================================\n');
}

seedDemoTeams()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
