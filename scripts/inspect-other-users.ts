import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const legitEmails = [
    'pradeshkannan64@gmail.com', // Admin
    // EcoPulse
    'kavya.ecopulse@student.tce.edu',
    'siddharth.ecopulse@student.tce.edu',
    'ananya.ecopulse@student.tce.edu',
    // MediBridge
    'rohan.medibridge@student.tce.edu',
    'deepa.medibridge@student.tce.edu',
    'gautam.medibridge@student.tce.edu',
    // TransitIQ
    'harish.transitiq@student.tce.edu',
    'sneha.transitiq@student.tce.edu',
    'varun.transitiq@student.tce.edu',
  ];

  const others = await prisma.user.findMany({
    where: {
      email: { notIn: legitEmails }
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      createdAt: true,
    }
  });

  console.log(`=== OTHER USERS COUNT: ${others.length} ===`);
  const roleCounts: Record<string, number> = {};
  for (const u of others) {
    roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
  }
  console.log('Roles breakdown:', roleCounts);
  console.log('\nSample of other users (first 25):', others.slice(0, 25));
}

main().catch(console.error).finally(() => prisma.$disconnect());
