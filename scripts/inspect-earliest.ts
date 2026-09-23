import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    take: 15,
    orderBy: { createdAt: 'asc' },
    include: { roster: true, users: true }
  });

  console.log('Earliest teams:');
  for (const t of teams) {
    console.log(`- ${t.name} (${t.teamId}, created: ${t.createdAt})`);
    for (const m of t.roster) {
      console.log(`    ${m.name} <${m.email}> [${m.role}]`);
    }
  }

  const users = await prisma.user.findMany({
    take: 20,
    orderBy: { createdAt: 'asc' },
    include: { team: true }
  });

  console.log('\nEarliest users:');
  for (const u of users) {
    console.log(`- ${u.name} <${u.email}> [${u.role}] (team: ${u.team?.name})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
