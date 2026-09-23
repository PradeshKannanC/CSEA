import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const candidateNames = ['EcoPulse', 'MediBridge', 'TransitIQ', 'ABC', 'INX', 'ADF'];
  const teams = await prisma.team.findMany({
    where: {
      name: { in: candidateNames }
    },
    include: {
      roster: {
        include: { user: true }
      },
      leader: true,
      users: true,
      idea: true,
      room: true
    }
  });

  console.log('=== CANDIDATE TEAMS ===');
  for (const t of teams) {
    console.log(`\nTeam: "${t.name}" | ID: ${t.id} | TeamCode: ${t.teamId} | SubmissionId: ${t.submissionId} | Room: ${t.room?.code || 'None'}`);
    console.log(`Leader: ${t.leader ? `${t.leader.name} <${t.leader.email}> (${t.leader.role})` : 'None'}`);
    console.log(`Roster (${t.roster.length}):`);
    for (const m of t.roster) {
      console.log(`  - ${m.name} <${m.email}> [${m.role}] (userId: ${m.userId}, userExists: ${!!m.user})`);
    }
    console.log(`Users linked to team (${t.users.length}):`);
    for (const u of t.users) {
      console.log(`  - ${u.name} <${u.email}> [${u.role}] (pw: ${!!u.passwordHash})`);
    }
    console.log(`Idea: ${t.idea ? `"${t.idea.title}" (anon: ${t.idea.anonymousId}, status: ${t.idea.status})` : 'None'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
