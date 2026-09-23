import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const moveSchema = z
  .object({
    teamId: z.string().optional(),
    teamIds: z.array(z.string().min(1)).optional(),
  })
  .refine((data) => data.teamId || (data.teamIds && data.teamIds.length > 0), {
    message: 'Either teamId or teamIds is required',
  });

/**
 * POST /api/admin/rooms/[id]/teams/move
 * Moves one or more teams into room [id]. Both source and target room must be in DRAFT.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id: targetRoomId } = await params;
    const body = await req.json();
    const parsed = moveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid move request parameters.',
        },
        { status: 400 }
      );
    }

    const requestedIds: string[] = parsed.data.teamIds && parsed.data.teamIds.length > 0
      ? parsed.data.teamIds
      : [parsed.data.teamId!];

    const targetRoom = await prisma.room.findUnique({
      where: { id: targetRoomId },
    });

    if (!targetRoom) {
      return NextResponse.json(
        { success: false, code: 'ROOM_NOT_FOUND', message: 'Target room not found.' },
        { status: 404 }
      );
    }

    if (targetRoom.status === 'OPEN' || targetRoom.status === 'PAUSED') {
      return NextResponse.json(
        {
          success: false,
          code: 'TEAM_ASSIGNMENT_LOCKED',
          message: `Target room "${targetRoom.name}" is ${targetRoom.status}. Cannot move teams into rooms while investment is active.`,
        },
        { status: 403 }
      );
    }

    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { id: { in: requestedIds } },
          { teamId: { in: requestedIds } },
        ],
      },
      include: { room: true },
    });

    if (teams.length === 0) {
      return NextResponse.json(
        { success: false, code: 'TEAM_NOT_FOUND', message: 'No matching team records found.' },
        { status: 404 }
      );
    }

    for (const team of teams) {
      if (team.room && (team.room.status === 'OPEN' || team.room.status === 'PAUSED')) {
        return NextResponse.json(
          {
            success: false,
            code: 'TEAM_ASSIGNMENT_LOCKED',
            message: `Source room "${team.room.name}" is ${team.room.status}. Cannot move teams out of a room while investment is active.`,
          },
          { status: 403 }
        );
      }
    }

    const teamInternalIds = teams.map((t) => t.id);
    const affectedPreviousRoomIds = Array.from(
      new Set(teams.map((t) => t.roomId).filter(Boolean) as string[])
    );

    await prisma.$transaction(async (tx) => {
      await tx.team.updateMany({
        where: { id: { in: teamInternalIds } },
        data: { roomId: targetRoom.id },
      });

      await tx.idea.updateMany({
        where: { teamId: { in: teamInternalIds } },
        data: { roomId: targetRoom.id },
      });

      await tx.user.updateMany({
        where: { teamId: { in: teamInternalIds } },
        data: { roomId: targetRoom.id },
      });

      for (const team of teams) {
        await tx.auditLog.create({
          data: {
            userId: auth.user.id,
            action: 'TEAM_MOVED',
            entity: 'TEAM',
            entityId: team.id,
            metadata: {
              teamName: team.name,
              fromRoomId: team.roomId,
              fromRoomName: team.room?.name || 'Unassigned',
              toRoomId: targetRoom.id,
              toRoomName: targetRoom.name,
            },
          },
        });
      }
    });

    // Broadcast updates
    for (const prevId of affectedPreviousRoomIds) {
      realtimeHub.broadcastToRoom(prevId, 'ROOM_UPDATED', {
        action: 'TEAM_MOVED_OUT',
        toRoomId: targetRoom.id,
      });
    }

    realtimeHub.broadcastToRoom(targetRoom.id, 'ROOM_UPDATED', {
      action: 'TEAM_MOVED_IN',
      count: teams.length,
      toRoomId: targetRoom.id,
    });

    realtimeHub.broadcastToRole('ADMIN', 'ROOM_UPDATED', {
      action: 'TEAM_MOVED',
      count: teams.length,
      toRoomId: targetRoom.id,
    });

    realtimeHub.broadcast('TEAM_MOVED', {
      count: teams.length,
      toRoomId: targetRoom.id,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully moved ${teams.length} team(s) to "${targetRoom.name}".`,
      count: teams.length,
    });
  } catch (error) {
    console.error('Error moving team:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to move team.' },
      { status: 500 }
    );
  }
}
