import { prisma } from '../lib/prisma';

async function main() {
  const teams = await prisma.team.findMany({
    include: {
      leader: { select: { name: true, email: true } },
      roster: true,
      room: true,
      idea: { select: { id: true, title: true, anonymousId: true, status: true } },
    }
  });
  console.log('=== TOTAL TEAMS IN DB ===', teams.length);
  for (const t of teams) {
    console.log({
      id: t.id,
      teamId: t.teamId,
      name: t.name,
      leader: t.leader ? t.leader.email : null,
      memberCount: t.roster.length,
      roomId: t.roomId,
      roomName: t.room ? t.room.name : 'UNASSIGNED',
      hasIdea: Boolean(t.idea),
      ideaStatus: t.idea ? t.idea.status : null
    });
  }

  const rooms = await prisma.room.findMany({
    include: {
      teams: { select: { id: true, name: true } }
    }
  });
  console.log('\n=== ROOMS IN DB ===', rooms.length);
  for (const r of rooms) {
    console.log({
      id: r.id,
      name: r.name,
      code: r.code,
      status: r.status,
      eventId: r.eventId,
      teamCount: r.teams.length,
      teams: r.teams.map(t => t.name)
    });
  }

  const events = await prisma.event.findMany();
  console.log('\n=== EVENTS IN DB ===', events.length);
  for (const e of events) {
    console.log({
      id: e.id,
      name: e.name,
      status: e.status
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
