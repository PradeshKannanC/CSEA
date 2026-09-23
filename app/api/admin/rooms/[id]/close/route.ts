import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/rooms/[id]/close
 * Transitions a room from OPEN or PAUSED to CLOSED.
 * Permanently locks investment allocations for this room.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id } = await params;

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

    if (room.status === 'CLOSED') {
      return NextResponse.json({
        success: true,
        message: `Room "${room.name}" is already closed.`,
        room,
        idempotent: true,
      });
    }

    if (room.status !== 'OPEN' && room.status !== 'PAUSED') {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_TRANSITION',
          message: `Cannot close room "${room.name}" from status ${room.status}. Only OPEN or PAUSED rooms can be closed.`,
        },
        { status: 400 }
      );
    }

    const event = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    // 1. Gather all approved ideas for teams currently in this room
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

    // 2. Deterministic sort: totalCoins DESC -> investorCount DESC -> createdAt ASC
    approvedTeamIdeas.sort((a, b) => {
      if (b.totalCoins !== a.totalCoins) return b.totalCoins - a.totalCoins;
      if (b.investorCount !== a.investorCount) return b.investorCount - a.investorCount;
      return a.createdAt - b.createdAt;
    });

    // 3. Atomically persist snapshot and update room to CLOSED
    const { updatedRoom, snapshots } = await prisma.$transaction(async (tx) => {
      // Clear previous unfinalized results for this room if any
      await tx.result.deleteMany({
        where: { roomId: id },
      });

      const createdSnapshots = [];

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
            revealedAt: null, // null until revealed
          },
        });

        // Update rank on Idea
        await tx.idea.update({
          where: { id: item.idea.id },
          data: { rank },
        });

        createdSnapshots.push({
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
        });
      }

      const updated = await tx.room.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: now,
        },
      });

      // Re-enable submission editing for teams in this closed room
      await tx.idea.updateMany({
        where: { roomId: id },
        data: { isLocked: false },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'ROOM_CLOSED',
          entity: 'ROOM',
          entityId: id,
          metadata: {
            roomName: room.name,
            code: room.code,
            snapshotCount: createdSnapshots.length,
          },
        },
      });

      return { updatedRoom: updated, snapshots: createdSnapshots };
    });

    // Real-Time Broadcasts: Scoped strictly to target room and admin
    realtimeHub.broadcastToRoom(id, 'ROOM_STATUS_CHANGED', {
      roomId: id,
      roomName: updatedRoom.name,
      roomCode: updatedRoom.code,
      status: 'CLOSED',
      timestamp: Date.now(),
    });

    realtimeHub.broadcastToRole('ADMIN', 'ROOM_STATUS_CHANGED', {
      roomId: id,
      roomName: updatedRoom.name,
      roomCode: updatedRoom.code,
      status: 'CLOSED',
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      message: `Room "${updatedRoom.name}" has been closed. Historical round snapshot finalized. Teams can now be reassigned for subsequent rounds.`,
      room: updatedRoom,
      snapshots,
    });
  } catch (error) {
    console.error('Error closing room:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to close room.' },
      { status: 500 }
    );
  }
}
