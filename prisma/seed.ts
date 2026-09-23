import { PrismaClient, UserRole, EventStatus } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  console.log('============================================================');
  console.log('PITCH AND PROSPER by CSEA — CLEAN PRODUCTION INITIALIZER');
  console.log('============================================================\n');

  const rootEmail = 'pradeshkannan64@gmail.com';
  const rootPasswordPlain = 'pradesh@2006K';

  // 1. Idempotent check for Root Administrator
  const existingAdmin = await prisma.user.findUnique({
    where: { email: rootEmail },
  });

  if (!existingAdmin) {
    console.log(`1. Root Administrator (${rootEmail}) not found. Creating...`);
    const rootPasswordHash = hashPassword(rootPasswordPlain);
    const newAdmin = await prisma.user.create({
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
    console.log(`   ✓ Root Administrator created: ${newAdmin.name} (${newAdmin.email})`);
  } else {
    console.log(`1. Root Administrator (${rootEmail}) already exists. Ensuring ADMIN role & active status...`);
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    console.log(`   ✓ Root Administrator confirmed active with ADMIN role.`);
  }

  // 2. Idempotent check for Clean Event Configuration
  const existingEvent = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!existingEvent) {
    console.log('\n2. Initializing clean DRAFT Event configuration...');
    const event = await prisma.event.create({
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
    console.log(`   ✓ Clean Event created: ${event.name} [Status: ${event.status}]`);
  } else {
    console.log(`\n2. Event configuration present: ${existingEvent.name} [Status: ${existingEvent.status}]`);
  }

  // Final status
  const userCount = await prisma.user.count();
  const teamCount = await prisma.team.count();
  const ideaCount = await prisma.idea.count();
  const investmentCount = await prisma.investment.count();

  console.log('\n============================================================');
  console.log('CURRENT PRODUCTION DATABASE SUMMARY:');
  console.log('============================================================');
  console.log(`Total Users:        ${userCount}`);
  console.log(`Total Teams:        ${teamCount}`);
  console.log(`Submitted Ideas:    ${ideaCount}`);
  console.log(`Total Investments:  ${investmentCount}`);
  console.log('============================================================\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Production initialization complete.');
  })
  .catch(async (e) => {
    console.error('Error during production initialization:', e);
    await prisma.$disconnect();
    process.exit(1);
  });