import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    include: {
      roster: true,
      users: true,
    }
  });

  console.log(`Checking all ${teams.length} teams:`);
  for (const t of teams) {
    const leaders = t.roster.filter(m => m.role === 'TEAM_LEADER');
    const members = t.roster.filter(m => m.role === 'TEAM_MEMBER');
    if (t.roster.length > 0) {
      console.log(`Team: "${t.name}" (${t.teamId}) - Total: ${t.roster.length} (Leaders: ${leaders.length}, Members: ${members.length})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
