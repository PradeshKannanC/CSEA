import { prisma } from '../lib/prisma';

async function main() {
  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  console.log('Recent Audit Logs:');
  for (const a of auditLogs) {
    console.log(`[${a.createdAt.toISOString()}] action=${a.action}, entity=${a.entity}, entityId=${a.entityId}, metadata=${JSON.stringify(a.metadata)}`);
  }

  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: 'desc' },
  });
  console.log('\nAll Rooms:');
  for (const r of rooms) {
    console.log(`Room "${r.name}" (${r.code}, ${r.id}), status=${r.status}, createdAt=${r.createdAt.toISOString()}, updatedAt=${r.updatedAt.toISOString()}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
