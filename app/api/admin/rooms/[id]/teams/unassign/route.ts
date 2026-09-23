import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const bulkUnassignSchema = z.object({
  teamIds: z.array(z.string().min(1)).min(1, 'At least one teamId is required'),
});

/**
 * POST /api/admin/rooms/[id]/teams/unassign
 * Unassigns multiple teams from room [id] in a single transaction.
 * Allowed in DRAFT, CLOSED, REVEALED. Blocked in OPEN, PAUSED.
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
    const parsed = bulkUnassignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid payload for bulk unassign.',
        },
        { status: 400 }
      );
    }

    const { teamIds } = parsed.data;

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

    // Resolve target teams
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { id: { in: teamIds } },
          { teamId: { in: teamIds } },
        ],
        roomId: targetRoomId,
      },
    });

    if (teams.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'NO_TEAMS_MATCHED',
          message: 'None of the specified teams are currently assigned to this room.',
        },
        { status: 400 }
      );
    }

    const targetInternalIds = teams.map((t) => t.id);

    await prisma.$transaction(async (tx) => {
      // 1. Unassign teams
      await tx.team.updateMany({
        where: { id: { in: targetInternalIds } },
        data: { roomId: null },
      });

      // 2. Unassign ideas
      await tx.idea.updateMany({
        where: { teamId: { in: targetInternalIds } },
        data: { roomId: null },
      });

      // 3. Unassign users
      await tx.user.updateMany({
        where: { teamId: { in: targetInternalIds } },
        data: { roomId: null },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'TEAMS_BULK_UNASSIGNED',
          entity: 'ROOM',
          entityId: targetRoomId,
          metadata: {
            roomName: room.name,
            unassignedCount: teams.length,
            teamNames: teams.map((t) => t.name),
          },
        },
      });
    });

    // Realtime notifications
    realtimeHub.broadcastToRoom(targetRoomId, 'ROOM_UPDATED', {
      action: 'TEAMS_BULK_UNASSIGNED',
      count: teams.length,
      roomId: targetRoomId,
    });

    realtimeHub.broadcastToRole('ADMIN', 'ROOM_UPDATED', {
      action: 'TEAMS_BULK_UNASSIGNED',
      count: teams.length,
      roomId: targetRoomId,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully unassigned ${teams.length} teams from "${room.name}".`,
      unassignedCount: teams.length,
    });
  } catch (error) {
    console.error('Error bulk unassigning teams:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to unassign teams.' },
      { status: 500 }
    );
  }
}
