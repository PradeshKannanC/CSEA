import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tables: any = await prisma.$queryRawUnsafe('SHOW TABLES');
  console.log('Tables in DB:');
  console.log(tables);
}

main().catch(console.error).finally(() => prisma.$disconnect());
