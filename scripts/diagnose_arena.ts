import { prisma } from '../lib/prisma';

async function diagnose() {
  console.log('=== DATABASE DIAGNOSTIC: ROOMS, TEAMS, USERS, IDEAS ===\n');

  const rooms = await prisma.room.findMany({
    include: {
      teams: {
        include: {
          idea: true,
          leader: true,
          users: true,
          roster: true,
        },
      },
      ideas: true,
      users: true,
    },
  });

  console.log(`Total Rooms: ${rooms.length}`);
  for (const r of rooms) {
    console.log(`\nRoom: "${r.name}" (${r.code}) [${r.status}] (id: ${r.id})`);
    console.log(`  Room.teams count: ${r.teams.length}`);
    console.log(`  Room.ideas count: ${r.ideas.length}`);
    console.log(`  Room.users count: ${r.users.length}`);
    for (const t of r.teams) {
      console.log(`    Team: "${t.name}" (id: ${t.id}, teamId: ${t.teamId})`);
      console.log(`      Leader: ${t.leader ? `${t.leader.name} (${t.leader.email}, role: ${t.leader.role}, teamId: ${t.leader.teamId}, roomId: ${t.leader.roomId})` : 'NONE'}`);
      console.log(`      Users count: ${t.users.length}`);
      console.log(`      Roster count: ${t.roster.length}`);
      if (t.idea) {
        console.log(`      Idea: "${t.idea.title}" (status: ${t.idea.status}, idea.roomId: ${t.idea.roomId})`);
      } else {
        console.log(`      Idea: NONE`);
      }
    }
  }

  const unassignedTeams = await prisma.team.findMany({
    where: { roomId: null },
    include: { leader: true, idea: true },
  });
  console.log(`\nUnassigned Teams count: ${unassignedTeams.length}`);
  for (const t of unassignedTeams) {
    console.log(`  Team "${t.name}" (id: ${t.id})`);
  }

  const allIdeas = await prisma.idea.findMany({
    include: { team: true, room: true },
  });
  console.log(`\nTotal Ideas in DB: ${allIdeas.length}`);
  for (const idea of allIdeas) {
    console.log(`  Idea "${idea.title}" (status: ${idea.status}, idea.teamId: ${idea.teamId}, team.name: ${idea.team?.name}, team.roomId: ${idea.team?.roomId}, idea.roomId: ${idea.roomId})`);
  }

  const allUsers = await prisma.user.findMany({
    include: { team: true, ledTeam: true, room: true },
  });
  console.log(`\nTotal Users in DB: ${allUsers.length}`);
  for (const u of allUsers) {
    console.log(`  User "${u.name}" (${u.email}, role: ${u.role}) -> user.teamId: ${u.teamId}, ledTeamId: ${u.ledTeam?.id}, user.roomId: ${u.roomId}`);
  }
}

diagnose()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
