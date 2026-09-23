import { prisma } from '../lib/prisma';

async function main() {
  const event = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!event) {
    console.error('No event found!');
    return;
  }

  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'DRAFT' },
  });

  console.log('Event status successfully reset to [DRAFT]');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
