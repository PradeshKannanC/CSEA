import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/admin/rooms/[id]/teams/[teamId]
 * RESTful endpoint to unassign teamId from room [id].
 * Allowed when room status is DRAFT, CLOSED, or REVEALED.
 * Locked when OPEN or PAUSED.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id: roomId, teamId } = await params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json(
        { success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
        { status: 404 }
      );
    }

    if (room.status === 'OPEN' || room.status === 'PAUSED') {
      return NextResponse.json(
        {
          success: false,
          code: 'TEAM_ASSIGNMENT_LOCKED',
          message: `Cannot unassign teams from room "${room.name}" while investment is active (${room.status}).`,
        },
        { status: 403 }
      );
    }

    const team = await prisma.team.findFirst({
      where: {
        OR: [{ id: teamId }, { teamId }],
      },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, code: 'TEAM_NOT_FOUND', message: 'Team record not found.' },
        { status: 404 }
      );
    }

    if (team.roomId !== roomId) {
      return NextResponse.json(
        {
          success: false,
          code: 'TEAM_NOT_IN_ROOM',
          message: `Team "${team.name}" is not currently in room "${room.name}".`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id: team.id },
        data: { roomId: null },
      });

      await tx.idea.updateMany({
        where: { teamId: team.id },
        data: { roomId: null },
      });

      await tx.user.updateMany({
        where: { teamId: team.id },
        data: { roomId: null },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'TEAM_UNASSIGNED',
          entity: 'TEAM',
          entityId: team.id,
          metadata: {
            teamName: team.name,
            unassignedFromRoomId: room.id,
            roomName: room.name,
          },
        },
      });
    });

    realtimeHub.broadcastToRoom(room.id, 'ROOM_UPDATED', {
      action: 'TEAM_UNASSIGNED',
      teamId: team.id,
      teamName: team.name,
      roomId: room.id,
    });

    realtimeHub.broadcastToRole('ADMIN', 'ROOM_UPDATED', {
      action: 'TEAM_UNASSIGNED',
      teamId: team.id,
      teamName: team.name,
      roomId: room.id,
    });

    return NextResponse.json({
      success: true,
      message: `Team "${team.name}" successfully unassigned from "${room.name}". Completed round history preserved.`,
      teamId: team.id,
      roomId: room.id,
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/rooms/[id]/teams/[teamId]:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to unassign team from room.' },
      { status: 500 }
    );
  }
}
