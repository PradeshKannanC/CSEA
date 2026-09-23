import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DATABASE COUNTS AUDIT ===');
  const events = await prisma.event.count();
  const rooms = await prisma.room.count();
  const teams = await prisma.team.count();
  const users = await prisma.user.count();
  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  const teamLeaders = await prisma.user.count({ where: { role: 'TEAM_LEADER' } });
  const teamMembers = await prisma.user.count({ where: { role: 'TEAM_MEMBER' } });
  const investors = await prisma.user.count({ where: { role: 'INVESTOR' } });
  const rosters = await prisma.teamMember.count();
  const ideas = await prisma.idea.count();
  const investments = await prisma.investment.count();
  const results = await prisma.result.count();
  const budgets = await prisma.participantBudget.count();
  const wallets = await prisma.wallet.count();
  const walletTx = await prisma.walletTransaction.count();
  const sessions = await prisma.session.count();
  const issueReports = await prisma.ideaIssueReport.count();

  console.log({
    events,
    rooms,
    teams,
    users,
    admins,
    teamLeaders,
    teamMembers,
    investors,
    rosters,
    ideas,
    investments,
    results,
    budgets,
    wallets,
    walletTx,
    sessions,
    issueReports,
  });

  console.log('\n=== ALL ROOMS ===');
  const allRooms = await prisma.room.findMany();
  console.log(allRooms.map(r => ({ id: r.id, name: r.name, code: r.code, status: r.status })));

  console.log('\n=== ALL TEAMS (Top 20 + non-auto) ===');
  const allTeams = await prisma.team.findMany({
    include: {
      roster: true,
      leader: true,
      idea: true,
    }
  });
  console.log(`Total teams: ${allTeams.length}`);
  const nonAutoTeams = allTeams.filter(t => !t.name.startsWith('AutoTeam') && !t.name.startsWith('BulkAutoTeam') && !t.name.startsWith('T1_'));
  for (const t of nonAutoTeams) {
    console.log(`\nTeam: ${t.name} (Code: ${t.teamId}, Submission: ${t.submissionId}, Room: ${t.roomId})`);
    console.log(`Leader: ${t.leader ? `${t.leader.name} <${t.leader.email}>` : 'None'}`);
    console.log(`Roster (${t.roster.length}):`);
    for (const m of t.roster) {
      console.log(`  * ${m.name} <${m.email}> [${m.role}] userId: ${m.userId}`);
    }
    if (t.idea) {
      console.log(`Idea: ${t.idea.title} (anon: ${t.idea.anonymousId}, status: ${t.idea.status})`);
    }
  }

  console.log('\n=== ADMIN USERS ===');
  const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  for (const a of adminUsers) {
    console.log(`Admin: ${a.name} <${a.email}> id: ${a.id} isActive: ${a.isActive}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
