import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const investors = await prisma.user.findMany({
    where: { role: 'INVESTOR' }
  });
  console.log(`=== INVESTORS (${investors.length}) ===`);
  for (const inv of investors) {
    console.log(`- ${inv.name} <${inv.email}> (id: ${inv.id}, created: ${inv.createdAt.toISOString()})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
