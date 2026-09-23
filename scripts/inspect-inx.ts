import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const team = await prisma.team.findFirst({
    where: { name: 'INX' },
    include: { roster: true, users: true, room: true },
  });
  console.log('Team INX:');
  console.log(JSON.stringify(team, null, 2));

  const allMembers = await prisma.teamMember.findMany({
    where: { teamId: team?.id },
  });
  console.log('Members count:', allMembers.length);
  for (const m of allMembers) {
    const user = await prisma.user.findUnique({ where: { email: m.email } });
    console.log(`Member: ${m.name} <${m.email}> (${m.role}) -> User in DB: ${user ? `${user.id} (pw: ${!!user.passwordHash})` : 'NONE'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
