import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    include: { roster: true, idea: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('Total teams in DB:', teams.length);
  for (const t of teams) {
    const isTestName = t.name.includes('AutoTeam') ||
      t.name.includes('17900') ||
      t.name.includes('Bulk') ||
      t.name.includes('TEST') ||
      t.name.includes('Team Alpha') ||
      t.name.includes('Team Beta') ||
      t.name.includes('Team Gamma') ||
      t.name.includes('Target Draft') ||
      t.name.includes('Empty Draft') ||
      t.name.includes('Auth Squad');

    if (!isTestName) {
      console.log(`\nTEAM: "${t.name}" (${t.teamId}, id: ${t.id}) created: ${t.createdAt.toISOString()}`);
      for (const m of t.roster) {
        console.log(`    ${m.name} <${m.email}> [${m.role}]`);
      }
      if (t.idea) {
        console.log(`    Idea: "${t.idea.title}" (status: ${t.idea.status})`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
