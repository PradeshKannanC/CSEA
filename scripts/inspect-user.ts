import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { contains: '123' }
    },
    include: {
      team: true,
      room: true,
    }
  });

  console.log('--- ALL USERS WITH 123 ---');
  console.log(JSON.stringify(users.map(u => ({ email: u.email, name: u.name, role: u.role, teamId: u.teamId })), null, 2));

  const teamMembers = await prisma.teamMember.findMany({
    where: {
      email: { contains: '123' }
    },
    include: {
      team: true,
    }
  });

  console.log('--- ALL TEAM MEMBERS WITH 123 ---');
  console.log(JSON.stringify(teamMembers.map(tm => ({ email: tm.email, name: tm.name, role: tm.role, teamId: tm.teamId, teamName: tm.team.name })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
