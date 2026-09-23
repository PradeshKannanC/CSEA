import { PrismaClient, UserRole, EventStatus } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();

export async function resetDatabaseToProduction() {
  console.log('============================================================');
  console.log('PITCH AND PROSPER by CSEA — PRODUCTION DATABASE RESET');
  console.log('============================================================\n');

  console.log('1. Purging all existing records from MySQL database...');

  // Delete in foreign key dependency order
  await prisma.session.deleteMany();
  console.log('   ✓ Sessions deleted');

  await prisma.walletTransaction.deleteMany();
  console.log('   ✓ Wallet transactions deleted');

  await prisma.investment.deleteMany();
  console.log('   ✓ Investments deleted');

  await prisma.result.deleteMany();
  console.log('   ✓ Results deleted');

  await prisma.auditLog.deleteMany();
  console.log('   ✓ Audit logs deleted');

  await prisma.wallet.deleteMany();
  console.log('   ✓ Wallets deleted');

  await prisma.idea.deleteMany();
  console.log('   ✓ Ideas deleted');

  await prisma.teamMember.deleteMany();
  console.log('   ✓ Team members deleted');

  await prisma.team.deleteMany();
  console.log('   ✓ Teams deleted');

  await prisma.user.deleteMany();
  console.log('   ✓ Users deleted');

  await prisma.event.deleteMany();
  console.log('   ✓ Events deleted\n');

  console.log('2. Initializing Root Super Administrator (Pradesh Kannan C)...');
  const rootEmail = 'pradeshkannan64@gmail.com';
  const rootPasswordPlain = 'pradesh@2006K';
  const rootPasswordHash = hashPassword(rootPasswordPlain);

  const rootAdmin = await prisma.user.create({
    data: {
      name: 'Pradesh Kannan C',
      email: rootEmail,
      passwordHash: rootPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
      emailVerified: true,
      avatarInitials: 'PK',
      title: 'Root Platform Administrator',
    },
  });
  console.log(`   ✓ Root Administrator created: ${rootAdmin.name} (${rootAdmin.email}) [ID: ${rootAdmin.id}]`);

  console.log('3. Initializing clean DRAFT Event configuration...');
  const initialEvent = await prisma.event.create({
    data: {
      id: 'evt-pnp-production',
      name: 'PITCH AND PROSPER Arena 2024',
      status: EventStatus.DRAFT,
      totalCoins: 100,
      minInvestment: 10,
      maxInvestment: 50,
      totalDistributedCoins: 0,
      targetTeamsCount: 50,
      investmentStartsAt: null,
      investmentEndsAt: null,
      revealedAt: null,
    },
  });
  console.log(`   ✓ Clean Event created: ${initialEvent.name} [Status: ${initialEvent.status}]`);

  console.log('4. Recording initial system audit record...');
  await prisma.auditLog.create({
    data: {
      userId: rootAdmin.id,
      action: 'SYSTEM_INITIALIZED',
      entity: 'SYSTEM',
      entityId: initialEvent.id,
      metadata: {
        initializedBy: rootAdmin.name,
        email: rootAdmin.email,
        timestamp: new Date().toISOString(),
      },
    },
  });
  console.log('   ✓ Audit ledger initialized with root administrator action\n');

  // Verify final database counts
  const userCount = await prisma.user.count();
  const teamCount = await prisma.team.count();
  const memberCount = await prisma.teamMember.count();
  const ideaCount = await prisma.idea.count();
  const investmentCount = await prisma.investment.count();
  const walletCount = await prisma.wallet.count();
  const resultCount = await prisma.result.count();
  const sessionCount = await prisma.session.count();

  console.log('============================================================');
  console.log('FINAL PRODUCTION DATABASE STATE:');
  console.log('============================================================');
  console.log(`Users:         ${userCount} (Root Admin: ${rootAdmin.email})`);
  console.log(`Teams:         ${teamCount}`);
  console.log(`Team Members:  ${memberCount}`);
  console.log(`Ideas:         ${ideaCount}`);
  console.log(`Investments:   ${investmentCount}`);
  console.log(`Wallets:       ${walletCount}`);
  console.log(`Results:       ${resultCount}`);
  console.log(`Sessions:      ${sessionCount}`);
  console.log(`Active Event:  ${initialEvent.name} (${initialEvent.status})`);
  console.log('============================================================\n');
}

if (require.main === module) {
  resetDatabaseToProduction()
    .then(async () => {
      await prisma.$disconnect();
      console.log('🎉 Production database reset completed successfully!');
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('Error during production database reset:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
