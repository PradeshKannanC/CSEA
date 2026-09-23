import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const legitEmails = [
    'pradeshkannan64@gmail.com',
    'kavya.ecopulse@student.tce.edu',
    'siddharth.ecopulse@student.tce.edu',
    'ananya.ecopulse@student.tce.edu',
    'rohan.medibridge@student.tce.edu',
    'deepa.medibridge@student.tce.edu',
    'gautam.medibridge@student.tce.edu',
    'harish.transitiq@student.tce.edu',
    'sneha.transitiq@student.tce.edu',
    'varun.transitiq@student.tce.edu',
  ];

  const users = await prisma.user.findMany({
    where: { email: { in: legitEmails } },
    include: {
      wallet: {
        include: {
          transactions: true
        }
      },
      budgets: true,
      investments: true,
      sessions: true,
    }
  });

  for (const u of users) {
    console.log(`User: ${u.name} <${u.email}> (${u.role})`);
    console.log(`  Wallet:`, u.wallet ? { total: u.wallet.totalCoins, avail: u.wallet.availableCoins, invested: u.wallet.investedCoins, txs: u.wallet.transactions.length } : 'None');
    console.log(`  Budgets: ${u.budgets.length}, Investments: ${u.investments.length}, Sessions: ${u.sessions.length}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
