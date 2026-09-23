import { prisma } from '../lib/prisma';
async function main() {
  const events = await prisma.event.findMany();
  console.log('All events count:', events.length);
  events.forEach(e => console.log('Event:', e.id, e.name, e.status, e.createdAt));
}
main().finally(() => prisma.$disconnect());
