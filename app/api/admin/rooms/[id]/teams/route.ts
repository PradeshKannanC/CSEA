import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const assignSchema = z
  .object({
    teamId: z.string().optional(),
    teamIds: z.array(z.string().min(1)).optional(),
  })
  .refine((data) => data.teamId || (data.teamIds && data.teamIds.length > 0), {
    message: 'Either teamId or teamIds is required',
  });

/**
 * POST /api/admin/rooms/[id]/teams
 * Assigns one or more teams to room [id]. Both source and target room must be DRAFT.
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
    const parsed = assignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid team assignment payload.',
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
          message: `Room "${targetRoom.name}" is ${targetRoom.status}. Cannot assign teams while investment is active.`,
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

    // Check if any team is locked in an active room
    for (const team of teams) {
      if (team.room && (team.room.status === 'OPEN' || team.room.status === 'PAUSED')) {
        return NextResponse.json(
          {
            success: false,
            code: 'TEAM_ASSIGNMENT_LOCKED',
            message: `Team "${team.name}" is currently in room "${team.room.name}" which is ${team.room.status}. Cannot move teams while investment is active.`,
          },
          { status: 403 }
        );
      }
    }

    const teamInternalIds = teams.map((t) => t.id);

    await prisma.$transaction(async (tx) => {
      await tx.team.updateMany({
        where: { id: { in: teamInternalIds } },
        data: { roomId: targetRoom.id },
      });

      await tx.idea.updateMany({
        where: { teamId: { in: teamInternalIds } },
        data: {
          roomId: targetRoom.id,
          isLocked: ['OPEN', 'PAUSED', 'REVEALED'].includes(targetRoom.status),
        },
      });

      await tx.user.updateMany({
        where: { teamId: { in: teamInternalIds } },
        data: { roomId: targetRoom.id },
      });

      for (const t of teams) {
        await tx.auditLog.create({
          data: {
            userId: auth.user.id,
            action: 'TEAM_ASSIGNED',
            entity: 'TEAM',
            entityId: t.id,
            metadata: {
              teamName: t.name,
              previousRoomId: t.roomId,
              newRoomId: targetRoom.id,
              newRoomName: targetRoom.name,
            },
          },
        });
      }
    });

    for (const t of teams) {
      realtimeHub.broadcastToRoom(targetRoom.id, 'ROOM_UPDATED', {
        action: 'TEAM_ASSIGNED',
        teamId: t.id,
        teamName: t.name,
        roomId: targetRoom.id,
      });
    }

    realtimeHub.broadcastToRole('ADMIN', 'ROOM_UPDATED', {
      action: 'TEAM_ASSIGNED',
      count: teams.length,
      roomId: targetRoom.id,
    });

    realtimeHub.broadcast('TEAM_ASSIGNED', {
      count: teams.length,
      roomId: targetRoom.id,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${teams.length} team(s) to "${targetRoom.name}".`,
      count: teams.length,
    });
  } catch (error) {
    console.error('Error assigning team:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to assign team to room.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/rooms/[id]/teams
 * Unassigns a team from room [id]. Target room must be DRAFT.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id: targetRoomId } = await params;
    const url = new URL(req.url);
    let teamId = url.searchParams.get('teamId');

    if (!teamId) {
      try {
        const body = await req.json();
        teamId = body.teamId;
      } catch {}
    }

    if (!teamId) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: 'teamId is required to unassign.' },
        { status: 400 }
      );
    }

    const room = await prisma.room.findUnique({
      where: { id: targetRoomId },
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

    if (team.roomId !== targetRoomId) {
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
        data: { roomId: null, isLocked: false },
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
            previousRoomId: targetRoomId,
          },
        },
      });
    });

    realtimeHub.broadcastToRoom(targetRoomId, 'ROOM_UPDATED', {
      action: 'TEAM_UNASSIGNED',
      teamId: team.id,
      teamName: team.name,
      roomId: targetRoomId,
    });

    realtimeHub.broadcastToRole('ADMIN', 'ROOM_UPDATED', {
      action: 'TEAM_UNASSIGNED',
      teamId: team.id,
      teamName: team.name,
      roomId: targetRoomId,
    });

    return NextResponse.json({
      success: true,
      message: `Team "${team.name}" unassigned from "${room.name}".`,
    });
  } catch (error) {
    console.error('Error unassigning team:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to unassign team from room.' },
      { status: 500 }
    );
  }
}
