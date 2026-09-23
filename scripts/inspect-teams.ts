import { prisma } from '../lib/prisma';

async function main() {
  const teams = await prisma.team.findMany({
    include: {
      room: true,
      leader: true,
      users: true,
      roster: true,
    },
  });

  console.log('Total teams in DB:', teams.length);
  for (const t of teams) {
    console.log(`Team: "${t.name}" (id: ${t.id}, teamId: ${t.teamId}, roomId: ${t.roomId})`);
    console.log(`  Room: ${t.room ? `"${t.room.name}" (${t.room.code}, ${t.room.id}, status=${t.room.status})` : 'NULL'}`);
    console.log(`  Leader: ${t.leader ? `${t.leader.name} (${t.leader.email}, id=${t.leader.id})` : 'NULL'}`);
    console.log(`  Users: ${t.users.map((u) => `${u.email} (${u.id})`).join(', ')}`);
    console.log(`  Roster: ${t.roster.map((r) => `${r.name} (${r.email}, userId=${r.userId})`).join(', ')}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
