import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== INSPECTING CURRENT DATABASE STATE ===\n');

  const events = await prisma.event.findMany();
  console.log(`Events (${events.length}):`, events.map(e => ({ id: e.id, name: e.name, status: e.status, version: e.version })));

  const rooms = await prisma.room.findMany({
    include: { teams: true }
  });
  console.log(`\nRooms (${rooms.length}):`, rooms.map(r => ({ id: r.id, name: r.name, code: r.code, status: r.status, teamsCount: r.teams.length })));

  const teams = await prisma.team.findMany({
    include: { roster: true, idea: true }
  });
  console.log(`\nTeams (${teams.length}):`);
  for (const t of teams) {
    console.log(`- Team: ${t.name} (${t.teamId}, id: ${t.id}, roomId: ${t.roomId}, leaderId: ${t.leaderId})`);
    console.log(`  Members (${t.roster.length}):`);
    for (const m of t.roster) {
      console.log(`    * ${m.name} <${m.email}> [${m.role}] (userId: ${m.userId})`);
    }
    console.log(`  Idea: ${t.idea ? `${t.idea.title} (anon: ${t.idea.anonymousId}, status: ${t.idea.status})` : 'None'}`);
  }

  const users = await prisma.user.findMany({
    include: { team: true }
  });
  console.log(`\nUsers (${users.length}):`);
  for (const u of users) {
    console.log(`- User: ${u.name} <${u.email}> [${u.role}] (id: ${u.id}, team: ${u.team?.name || 'None'}, pw: ${!!u.passwordHash})`);
  }

  const ideas = await prisma.idea.findMany();
  console.log(`\nIdeas (${ideas.length}):`, ideas.map(i => ({ id: i.id, title: i.title, teamId: i.teamId, status: i.status })));

  const investments = await prisma.investment.findMany();
  console.log(`\nInvestments (${investments.length})`);

  const results = await prisma.result.findMany();
  console.log(`\nResults (${results.length})`);

  const budgets = await prisma.participantBudget.findMany();
  console.log(`\nParticipant Budgets (${budgets.length})`);

  const wallets = await prisma.wallet.findMany();
  console.log(`\nWallets (${wallets.length})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
