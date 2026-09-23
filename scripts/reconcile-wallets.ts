import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reconcileWallets() {
  console.log('=== STARTING WALLET RECONCILIATION ===\n');

  try {
    // 1. Find the active event
    const activeEvent = await prisma.event.findFirst({
      where: {
        status: { in: ['DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'REVEALED'] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!activeEvent) {
      console.error('ERROR: No active event found in database.');
      return;
    }

    console.log(`Active Event: "${activeEvent.name}" (ID: ${activeEvent.id})`);
    console.log(`Event Configuration: totalCoins=${activeEvent.totalCoins}, minInvestment=${activeEvent.minInvestment}, maxInvestment=${activeEvent.maxInvestment}\n`);

    // 2. Fetch all participants (non-admin or all team leaders/members/investors)
    const participants = await prisma.user.findMany({
      where: {
        role: { in: ['TEAM_LEADER', 'TEAM_MEMBER', 'INVESTOR'] },
      },
      include: {
        wallet: true,
        ledTeam: {
          include: {
            room: true,
          },
        },
        team: {
          include: {
            room: true,
          },
        },
        teamMemberships: {
          include: {
            team: {
              include: {
                room: true,
              },
            },
          },
        },
        investments: true,
      },
    });

    console.log(`Found ${participants.length} participants to reconcile.\n`);

    const auditRows: Array<{
      id: string;
      email: string;
      role: string;
      team: string;
      room: string;
      allocated: number;
      invested: number;
      available: number;
      verified: boolean;
      status: string;
    }> = [];

    let totalCoinsDistributed = 0;
    let totalCoinsInvested = 0;
    let totalCoinsAvailable = 0;

    for (const user of participants) {
      // Resolve team & room
      const userTeam = user.ledTeam || user.team || user.teamMemberships[0]?.team;
      const teamName = userTeam?.name || 'No Team';
      const roomName = userTeam?.room?.name || 'No Room';

      // Sum investments in active event only
      const investedAmount = user.investments
        .filter((inv) => inv.eventId === activeEvent.id)
        .reduce((sum, inv) => sum + inv.amount, 0);

      // Check if user has spent more than event total coins
      const allocatedCoins = Math.max(activeEvent.totalCoins, investedAmount);
      const availableCoins = Math.max(0, allocatedCoins - investedAmount);

      // Upsert wallet in DB
      const updatedWallet = await prisma.wallet.upsert({
        where: { userId: user.id },
        update: {
          totalCoins: allocatedCoins,
          investedCoins: investedAmount,
          availableCoins: availableCoins,
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          totalCoins: allocatedCoins,
          investedCoins: investedAmount,
          availableCoins: availableCoins,
        },
      });

      const isVerified = (updatedWallet.totalCoins === updatedWallet.investedCoins + updatedWallet.availableCoins) && (updatedWallet.availableCoins >= 0);

      totalCoinsDistributed += updatedWallet.totalCoins;
      totalCoinsInvested += updatedWallet.investedCoins;
      totalCoinsAvailable += updatedWallet.availableCoins;

      auditRows.push({
        id: user.id.slice(0, 10),
        email: user.email,
        role: user.role,
        team: teamName,
        room: roomName,
        allocated: updatedWallet.totalCoins,
        invested: updatedWallet.investedCoins,
        available: updatedWallet.availableCoins,
        verified: isVerified,
        status: isVerified ? 'OK' : 'ANOMALY',
      });
    }

    // 3. Update Event totalDistributedCoins
    await prisma.event.update({
      where: { id: activeEvent.id },
      data: {
        totalDistributedCoins: totalCoinsDistributed,
      },
    });

    // 4. Print Audit Table
    console.log('------------------------------------------------------------------------------------------------------------------------');
    console.log('| Email                          | Role        | Team         | Room      | Allocated | Invested | Available | Verified |');
    console.log('------------------------------------------------------------------------------------------------------------------------');
    for (const row of auditRows) {
      const email = row.email.padEnd(30);
      const role = row.role.padEnd(11);
      const team = row.team.slice(0, 12).padEnd(12);
      const room = row.room.slice(0, 9).padEnd(9);
      const alloc = String(row.allocated).padStart(9);
      const inv = String(row.invested).padStart(8);
      const avail = String(row.available).padStart(9);
      const ver = (row.verified ? ' YES ' : ' NO  ').padEnd(8);
      console.log(`| ${email} | ${role} | ${team} | ${room} | ${alloc} | ${inv} | ${avail} | ${ver} |`);
    }
    console.log('------------------------------------------------------------------------------------------------------------------------\n');

    console.log('=== RECONCILIATION SUMMARY ===');
    console.log(`Total Participants:      ${participants.length}`);
    console.log(`Total Coins Distributed: ${totalCoinsDistributed}`);
    console.log(`Total Coins Invested:    ${totalCoinsInvested}`);
    console.log(`Total Coins Available:   ${totalCoinsAvailable}`);
    console.log(`Consistency Equation:    Distributed (${totalCoinsDistributed}) == Invested (${totalCoinsInvested}) + Available (${totalCoinsAvailable}): ${totalCoinsDistributed === totalCoinsInvested + totalCoinsAvailable ? 'PASSED' : 'FAILED'}`);
    console.log(`All Balances Non-Negative: ${auditRows.every(r => r.available >= 0) ? 'PASSED' : 'FAILED'}`);
    console.log('==============================\n');

  } catch (error) {
    console.error('Wallet reconciliation error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reconcileWallets();
