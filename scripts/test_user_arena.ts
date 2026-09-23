import { prisma } from '../lib/prisma';
import { getServerUser } from '../lib/auth/server';

async function testUserArena() {
  console.log('=== TEST ALL USERS ARENA FLOW ===\n');

  const users = await prisma.user.findMany();

  for (const u of users) {
    console.log(`\n--------------------------------------------------`);
    console.log(`User: ${u.name} (${u.email}) [${u.role}]`);

    // 1. Trace user -> team
    let team = null;
    if (u.teamId) {
      team = await prisma.team.findUnique({ where: { id: u.teamId }, include: { room: true, idea: true } });
    }
    if (!team) {
      team = await prisma.team.findFirst({
        where: {
          OR: [
            { leaderId: u.id },
            { users: { some: { id: u.id } } },
            { roster: { some: { OR: [{ userId: u.id }, { email: u.email }] } } },
          ],
        },
        include: { room: true, idea: true },
      });
    }

    console.log(`  Resolved Team: ${team ? `${team.name} (id: ${team.id})` : 'NONE'}`);
    console.log(`  Team.roomId: ${team?.roomId || 'NONE'}`);
    console.log(`  Team.room: ${team?.room ? `${team.room.name} (${team.room.status})` : 'NONE'}`);
    console.log(`  User.roomId: ${u.roomId || 'NONE'}`);

    const targetRoomId = team?.roomId || u.roomId;
    if (!targetRoomId) {
      console.log(`  [EMPTY ARENA] No room assigned`);
      continue;
    }

    // 2. Query ideas in that room
    const allRoomIdeas = await prisma.idea.findMany({
      where: {
        OR: [
          { team: { roomId: targetRoomId } },
          { roomId: targetRoomId },
        ],
      },
      include: { team: true },
    });

    const approvedRoomIdeas = allRoomIdeas.filter((i) => i.status === 'APPROVED');
    const ownTeamIdeas = team ? allRoomIdeas.filter((i) => i.teamId === team.id || i.teamId === team.teamId) : [];
    const investableIdeas = approvedRoomIdeas.filter((i) => !team || (i.teamId !== team.id && i.teamId !== team.teamId));

    console.log(`  Room Metrics for this participant:`);
    console.log(`    Room ID: ${targetRoomId}`);
    console.log(`    All Room Ideas: ${allRoomIdeas.length}`);
    console.log(`    Approved Ideas: ${approvedRoomIdeas.length}`);
    console.log(`    Own Team Ideas: ${ownTeamIdeas.length} (${ownTeamIdeas.map(i => i.title).join(', ')})`);
    console.log(`    INVESTABLE Ideas: ${investableIdeas.length} (${investableIdeas.map(i => i.title).join(', ')})`);

    if (investableIdeas.length === 0) {
      console.log(`  ⚠️ ARENA IS EMPTY FOR THIS USER! Reason:`);
      if (allRoomIdeas.length === 0) {
        console.log(`     -> Room has 0 ideas assigned to it.`);
      } else if (approvedRoomIdeas.length === 0) {
        console.log(`     -> Ideas in room are not APPROVED.`);
      } else if (allRoomIdeas.length === 1 && ownTeamIdeas.length === 1) {
        console.log(`     -> ONE-TEAM ROOM: Only the user's own team idea is in this room!`);
      } else {
        console.log(`     -> Other reason.`);
      }
    } else {
      console.log(`  ✅ Investable ideas present: ${investableIdeas.map(i => i.title).join(', ')}`);
    }
  }
}

testUserArena()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
