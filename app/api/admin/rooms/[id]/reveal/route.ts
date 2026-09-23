import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/rooms/[id]/reveal
 * Legacy reveal endpoint with strict two-stage security:
 * - target === 'PARTICIPANTS': triggers participant reveal (requires resultsRevealedToAdmins)
 * - target === 'ADMIN' or no target: triggers Admin reveal ONLY (does NOT automatically expose results to participants)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const target = body?.target?.toUpperCase();

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            roster: true,
            idea: {
              include: {
                investments: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
        { status: 404 }
      );
    }

    const now = new Date();

    // -------------------------------------------------------------
    // Target: PARTICIPANTS
    // -------------------------------------------------------------
    if (target === 'PARTICIPANTS') {
      if (!room.resultsRevealedToAdmins) {
        return NextResponse.json(
          {
            success: false,
            code: 'ADMIN_REVEAL_REQUIRED',
            message: `Results for room "${room.name}" must be revealed to Admins before revealing to participants.`,
          },
          { status: 400 }
        );
      }

      const { updatedRoom, results } = await prisma.$transaction(async (tx) => {
        await tx.result.updateMany({
          where: { roomId: id },
          data: { revealedAt: now },
        });

        const finalResults = await tx.result.findMany({
          where: { roomId: id },
          orderBy: { rank: 'asc' },
        });

        const r = await tx.room.update({
          where: { id },
          data: {
            status: 'REVEALED',
            resultsRevealedToParticipants: true,
            participantRevealedAt: now,
            revealedAt: now,
          },
        });

        await tx.idea.updateMany({
          where: { roomId: id },
          data: { isLocked: true },
        });

        await tx.auditLog.create({
          data: {
            userId: auth.user.id,
            action: 'ROOM_PARTICIPANT_RESULTS_REVEALED',
            entity: 'ROOM',
            entityId: id,
            metadata: {
              roomName: r.name,
              roomCode: r.code,
              resultsCount: finalResults.length,
            },
          },
        });

        return { updatedRoom: r, results: finalResults };
      });

      realtimeHub.broadcastToRoom(id, 'ROOM_STATUS_CHANGED', {
        roomId: id,
        roomName: updatedRoom.name,
        roomCode: updatedRoom.code,
        status: 'REVEALED',
        timestamp: Date.now(),
      });
      realtimeHub.broadcastToRoom(id, 'RESULTS_REVEALED', {
        roomId: id,
        roomName: updatedRoom.name,
        roomCode: updatedRoom.code,
        timestamp: Date.now(),
      });
      realtimeHub.broadcastToRole('ADMIN', 'ROOM_STATUS_CHANGED', {
        roomId: id,
        roomName: updatedRoom.name,
        roomCode: updatedRoom.code,
        status: 'REVEALED',
        timestamp: Date.now(),
      });
      realtimeHub.broadcastToRole('ADMIN', 'RESULTS_REVEALED', {
        roomId: id,
        roomName: updatedRoom.name,
        roomCode: updatedRoom.code,
        timestamp: Date.now(),
      });

      return NextResponse.json({
        success: true,
        message: `Results for Room "${updatedRoom.name}" (${updatedRoom.code}) revealed to participants.`,
        room: updatedRoom,
        results,
      });
    }

    // -------------------------------------------------------------
    // Target: ADMIN (or default when called without target)
    // CRITICAL: NEVER automatically expose results to participants!
    // -------------------------------------------------------------
    if (room.status !== 'CLOSED' && room.status !== 'REVEALED') {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_TRANSITION',
          message: `Cannot reveal results for room "${room.name}" while status is ${room.status}. Room must be CLOSED first.`,
        },
        { status: 400 }
      );
    }

    const event = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const existingSnapshots = await prisma.result.findMany({
      where: { roomId: id },
      orderBy: { rank: 'asc' },
    });

    const { updatedRoom, results } = await prisma.$transaction(async (tx) => {
      let finalResults = [];

      if (existingSnapshots.length > 0) {
        finalResults = existingSnapshots.map((s) => ({
          id: s.id,
          rank: s.rank,
          teamId: s.teamId,
          teamCode: s.teamCode,
          teamName: s.teamName,
          ideaTitle: s.ideaTitle,
          anonymousId: s.anonymousId,
          track: s.track,
          totalCoins: s.totalCoins,
          investorCount: s.investorCount,
          trophy: s.trophy,
          members: s.members,
        }));
      } else {
        const approvedTeamIdeas = room.teams
          .filter((t) => t.idea && t.idea.status === 'APPROVED')
          .map((t) => {
            const idea = t.idea!;
            const validInvestments = idea.investments.filter(
              (inv) => !event || inv.eventId === event.id || inv.eventId === null
            );

            const totalCoins = validInvestments.reduce((sum, inv) => sum + inv.amount, 0);
            const investorCount = new Set(validInvestments.map((inv) => inv.investorId)).size;

            return {
              idea,
              team: t,
              totalCoins,
              investorCount,
              createdAt: idea.createdAt.getTime(),
            };
          });

        approvedTeamIdeas.sort((a, b) => {
          if (b.totalCoins !== a.totalCoins) return b.totalCoins - a.totalCoins;
          if (b.investorCount !== a.investorCount) return b.investorCount - a.investorCount;
          return a.createdAt - b.createdAt;
        });

        for (let i = 0; i < approvedTeamIdeas.length; i++) {
          const item = approvedTeamIdeas[i];
          const rank = i + 1;
          const trophy =
            rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'finalist';
          const memberNames = item.team.roster.map((m) => m.name);

          const res = await tx.result.create({
            data: {
              eventId: event?.id || room.eventId || null,
              roomId: id,
              teamId: item.team.id,
              teamCode: item.team.teamId,
              teamName: item.team.name,
              ideaId: item.idea.id,
              ideaTitle: item.idea.title,
              anonymousId: item.idea.anonymousId,
              rank,
              totalCoins: item.totalCoins,
              investorCount: item.investorCount,
              members: memberNames,
              track: item.idea.track,
              trophy,
            },
          });

          await tx.idea.update({
            where: { id: item.idea.id },
            data: { rank },
          });

          finalResults.push({
            id: res.id,
            rank,
            teamId: item.team.id,
            teamCode: item.team.teamId,
            teamName: item.team.name,
            ideaTitle: item.idea.title,
            anonymousId: item.idea.anonymousId,
            track: item.idea.track,
            totalCoins: item.totalCoins,
            investorCount: item.investorCount,
            trophy,
            members: memberNames,
          });
        }
      }

      // Mark results revealed to Admins ONLY; room status remains CLOSED
      const r = await tx.room.update({
        where: { id },
        data: {
          resultsRevealedToAdmins: true,
          adminRevealedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'ROOM_ADMIN_RESULTS_REVEALED',
          entity: 'ROOM',
          entityId: id,
          metadata: {
            roomName: r.name,
            roomCode: r.code,
            resultsCount: finalResults.length,
          },
        },
      });

      return { updatedRoom: r, results: finalResults };
    });

    realtimeHub.broadcastToRole('ADMIN', 'ADMIN_RESULTS_REVEALED', {
      roomId: id,
      roomName: updatedRoom.name,
      roomCode: updatedRoom.code,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      message: `Results for Room "${updatedRoom.name}" (${updatedRoom.code}) have been calculated and revealed to Admins.`,
      room: updatedRoom,
      results,
    });
  } catch (error) {
    console.error('Error in reveal endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process reveal request.' },
      { status: 500 }
    );
  }
}
