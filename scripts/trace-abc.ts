import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== STEP 1: TRACE ABC IN LIVE DATABASE ===\n');

  // Find Team ABC
  const teamABC = await prisma.team.findFirst({
    where: {
      OR: [
        { name: 'ABC' },
        { teamId: 'CSEA-067' },
      ],
    },
    include: {
      room: true,
      leader: true,
      users: true,
      roster: true,
      idea: {
        include: {
          room: true,
        },
      },
    },
  });

  console.log('Team ABC:', {
    id: teamABC?.id,
    teamId: teamABC?.teamId,
    name: teamABC?.name,
    submissionId: teamABC?.submissionId,
    leaderId: teamABC?.leaderId,
    roomId: teamABC?.roomId,
    room: teamABC?.room
      ? {
          id: teamABC.room.id,
          code: teamABC.room.code,
          name: teamABC.room.name,
          status: teamABC.room.status,
        }
      : null,
  });

  console.log('\nUsers associated with Team ABC:');
  for (const u of teamABC?.users || []) {
    console.log({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      teamId: u.teamId,
      roomId: u.roomId,
    });
  }

  console.log('\nRoster associated with Team ABC:');
  for (const r of teamABC?.roster || []) {
    console.log({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      userId: r.userId,
      teamId: r.teamId,
    });
  }

  // Also query users where email or team matches
  const usersMatching = await prisma.user.findMany({
    where: {
      OR: [
        { teamId: teamABC?.id },
        { teamMemberships: { some: { teamId: teamABC?.id } } },
        { email: { in: ['pradesh@student.tce.edu', 'naveenkumarak@gmail.com'] } },
      ],
    },
    include: {
      team: { include: { room: true } },
      room: true,
      wallet: true,
    },
  });

  console.log('\nAll candidate users for ABC:');
  for (const u of usersMatching) {
    console.log({
      id: u.id,
      email: u.email,
      role: u.role,
      userTeamId: u.teamId,
      userRoomId: u.roomId,
      teamRelation: u.team ? { id: u.team.id, name: u.team.name, roomId: u.team.roomId, roomStatus: u.team.room?.status } : null,
      userRoomRelation: u.room ? { id: u.room.id, name: u.room.name, status: u.room.status } : null,
      wallet: u.wallet,
    });
  }

  // Check Idea ABC
  console.log('\nIdea for Team ABC:');
  console.log({
    id: teamABC?.idea?.id,
    anonymousId: teamABC?.idea?.anonymousId,
    title: teamABC?.idea?.title,
    status: teamABC?.idea?.status,
    teamId: teamABC?.idea?.teamId,
    roomId: teamABC?.idea?.roomId,
    ideaRoom: teamABC?.idea?.room ? { id: teamABC.idea.room.id, name: teamABC.idea.room.name, status: teamABC.idea.room.status } : null,
  });

  // Query all rooms and check where ABC is assigned
  const allRooms = await prisma.room.findMany({
    include: {
      teams: true,
      users: true,
    },
  });
  console.log('\nRooms containing ABC in teams relation:');
  for (const r of allRooms) {
    const hasABC = r.teams.some((t) => t.id === teamABC?.id || t.teamId === 'CSEA-067' || t.name === 'ABC');
    const hasABCUser = r.users.some((u) => usersMatching.some((mu) => mu.id === u.id));
    if (hasABC || hasABCUser) {
      console.log(`Room "${r.name}" (${r.code}, id=${r.id}, status=${r.status}) -> hasABC Team: ${hasABC}, hasABC User: ${hasABCUser}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
