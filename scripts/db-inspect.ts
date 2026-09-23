import { prisma } from '../lib/prisma';

async function inspect() {
  console.log('--- DATABASE INSPECTION ---');
  const userCount = await prisma.user.count();
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, teamId: true }
  });
  console.log(`Users (${userCount}):`, users);

  const teamCount = await prisma.team.count();
  const teams = await prisma.team.findMany({
    select: { id: true, teamId: true, name: true, leaderId: true }
  });
  console.log(`\nTeams (${teamCount}):`, teams);

  const ideaCount = await prisma.idea.count();
  const ideas = await prisma.idea.findMany({
    select: { id: true, anonymousId: true, title: true, teamId: true, status: true, isLocked: true }
  });
  console.log(`\nIdeas (${ideaCount}):`, ideas);

  const events = await prisma.event.findMany();
  console.log(`\nEvents (${events.length}):`, events);

  console.log('\nInvestments count:', await prisma.investment.count());
  console.log('Wallets count:', await prisma.wallet.count());
  console.log('WalletTransactions count:', await prisma.walletTransaction.count());
  console.log('Results count:', await prisma.result.count());
  console.log('IssueReports count:', await prisma.ideaIssueReport.count());
  console.log('Notifications count:', await prisma.notification.count());
  console.log('PasswordResetTokens count:', await prisma.passwordResetToken.count());
}

inspect()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
