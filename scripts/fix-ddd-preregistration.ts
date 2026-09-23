import { PrismaClient } from '@prisma/client';
import { normalizeEmail } from '../lib/auth/email';

const prisma = new PrismaClient();

async function main() {
  const teamInx = await prisma.team.findFirst({
    where: { name: 'INX' },
  });

  if (!teamInx) {
    console.error('Team INX not found!');
    return;
  }

  console.log(`Found Team INX: ${teamInx.id} (${teamInx.teamId})`);

  // 1. Ensure DDD (dd123@gmail.com, TEAM_MEMBER, Team INX)
  const normEmailMember = normalizeEmail('dd123@gmail.com');
  let userMember = await prisma.user.findUnique({
    where: { email: normEmailMember },
  });

  if (!userMember) {
    userMember = await prisma.user.create({
      data: {
        name: 'DDD',
        email: normEmailMember,
        passwordHash: null,
        role: 'TEAM_MEMBER',
        isActive: true,
        emailVerified: false,
        avatarInitials: 'DD',
        teamId: teamInx.id,
        title: 'Team Member',
      },
    });
    console.log(`Created pre-registration User shell for DDD (${normEmailMember}):`, userMember.id);
  } else {
    userMember = await prisma.user.update({
      where: { id: userMember.id },
      data: {
        name: 'DDD',
        role: 'TEAM_MEMBER',
        teamId: teamInx.id,
        title: 'Team Member',
      },
    });
    console.log(`Updated pre-registration User shell for DDD (${normEmailMember}):`, userMember.id);
  }

  // Ensure wallet exists for DDD
  const memberWallet = await prisma.wallet.findUnique({ where: { userId: userMember.id } });
  if (!memberWallet) {
    await prisma.wallet.create({
      data: {
        userId: userMember.id,
        totalCoins: 500,
        availableCoins: 500,
        investedCoins: 0,
      },
    });
    console.log('Created wallet for DDD');
  }

  // Ensure TeamMember entry exists for dd123@gmail.com
  let tmMember = await prisma.teamMember.findFirst({
    where: { email: normEmailMember },
  });

  if (!tmMember) {
    tmMember = await prisma.teamMember.create({
      data: {
        teamId: teamInx.id,
        userId: userMember.id,
        name: 'DDD',
        email: normEmailMember,
        role: 'TEAM_MEMBER',
      },
    });
    console.log(`Created TeamMember for DDD (${normEmailMember}):`, tmMember.id);
  } else {
    tmMember = await prisma.teamMember.update({
      where: { id: tmMember.id },
      data: {
        teamId: teamInx.id,
        userId: userMember.id,
        name: 'DDD',
        role: 'TEAM_MEMBER',
      },
    });
    console.log(`Updated TeamMember for DDD (${normEmailMember}):`, tmMember.id);
  }

  // 2. Preserve existing legitimate TEAM_LEADER account (ddd123@gmail.com)
  const normEmailLeader = normalizeEmail('ddd123@gmail.com');
  let userLeader = await prisma.user.findUnique({
    where: { email: normEmailLeader },
  });

  if (!userLeader) {
    userLeader = await prisma.user.create({
      data: {
        name: 'ddd',
        email: normEmailLeader,
        passwordHash: null,
        role: 'TEAM_LEADER',
        isActive: true,
        emailVerified: false,
        avatarInitials: 'DD',
        teamId: teamInx.id,
        title: 'Team Leader',
      },
    });
    console.log(`Created pre-registration User shell for legitimate TEAM_LEADER ddd (${normEmailLeader}):`, userLeader.id);
  }

  // Ensure wallet exists for ddd
  const leaderWallet = await prisma.wallet.findUnique({ where: { userId: userLeader.id } });
  if (!leaderWallet) {
    await prisma.wallet.create({
      data: {
        userId: userLeader.id,
        totalCoins: 500,
        availableCoins: 500,
        investedCoins: 0,
      },
    });
  }

  // Link TeamMember and Team leaderId
  let tmLeader = await prisma.teamMember.findFirst({
    where: { email: normEmailLeader },
  });

  if (tmLeader) {
    await prisma.teamMember.update({
      where: { id: tmLeader.id },
      data: { userId: userLeader.id },
    });
  }

  await prisma.team.update({
    where: { id: teamInx.id },
    data: { leaderId: userLeader.id },
  });

  console.log('Linked legitimate TEAM_LEADER to Team INX');
  console.log('Verification completed successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
