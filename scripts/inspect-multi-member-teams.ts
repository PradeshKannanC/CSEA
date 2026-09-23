import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    include: {
      roster: true,
      users: true,
      idea: true,
    }
  });

  console.log('--- ALL TEAMS WITH >= 2 MEMBERS ---');
  for (const t of teams) {
    if (t.roster.length >= 2) {
      console.log(`\nTeam: "${t.name}" (Code: ${t.teamId}, id: ${t.id})`);
      console.log(`  Created: ${t.createdAt.toISOString()}`);
      console.log(`  Submission ID: ${t.submissionId}`);
      for (const m of t.roster) {
        console.log(`  * ${m.name} <${m.email}> [${m.role}]`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
