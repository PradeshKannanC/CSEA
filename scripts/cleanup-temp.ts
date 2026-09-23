import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.session.deleteMany({
    where: { user: { email: { in: ['leader@test.local', 'member@test.local', 'nav_leader@test.local', 'nav_member@test.local', 'investor_rt@test.local', 'isolated_rt@test.local'] } } },
  });
  await prisma.wallet.deleteMany({
    where: { user: { email: { in: ['leader@test.local', 'member@test.local', 'nav_leader@test.local', 'nav_member@test.local', 'investor_rt@test.local', 'isolated_rt@test.local'] } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: ['leader@test.local', 'member@test.local', 'nav_leader@test.local', 'nav_member@test.local', 'investor_rt@test.local', 'isolated_rt@test.local'] } },
  });
  await prisma.room.deleteMany({
    where: { code: { in: ['NAV-RM', 'RT-RM-A', 'RT-RM-B'] } },
  });
  await prisma.team.deleteMany({
    where: { teamId: { in: ['TEAM-NAV-01', 'RT-TEAM-A1', 'RT-TEAM-A2', 'RT-TEAM-B1'] } },
  });
  console.log('✅ Temporary test users and entities cleaned up successfully.');
  await prisma.$disconnect();
}

main().catch(console.error);
