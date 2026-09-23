import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allTeams = await prisma.team.findMany({
    include: {
      roster: true,
      users: true,
      idea: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`=== TOTAL TEAMS: ${allTeams.length} ===\n`);
  for (const t of allTeams) {
    console.log(`TEAM: "${t.name}" | teamId: "${t.teamId}" | id: "${t.id}" | created: ${t.createdAt.toISOString()}`);
    console.log(`  Members (${t.roster.length}):`);
    for (const m of t.roster) {
      console.log(`    - ${m.name} <${m.email}> [${m.role}] (userId: ${m.userId})`);
    }
  }

  const allUsers = await prisma.user.findMany({
    include: { team: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n=== TOTAL USERS: ${allUsers.length} ===\n`);
  for (const u of allUsers) {
    console.log(`USER: "${u.name}" <${u.email}> [${u.role}] team: ${u.team?.name || 'NONE'} (id: ${u.id}, pw: ${!!u.passwordHash}, created: ${u.createdAt.toISOString()})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
