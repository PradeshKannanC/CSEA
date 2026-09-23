import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/rooms/[id]/reveal-participant-results
 * Action 2: Reveals results to participants in that room.
 * Can ONLY be triggered after results have been revealed to Admins.
 * Sets resultsRevealedToParticipants = true, status = 'REVEALED', revealedAt = now.
 * Locks submissions and disables investments for this room.
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
    });

    if (!room) {
      return NextResponse.json(
        { success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
        { status: 404 }
      );
    }

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

    const now = new Date();

    const { updatedRoom, results } = await prisma.$transaction(async (tx) => {
      // Set revealedAt on the Result records for this room
      await tx.result.updateMany({
        where: { roomId: id },
        data: { revealedAt: now },
      });

      const finalResults = await tx.result.findMany({
        where: { roomId: id },
        orderBy: { rank: 'asc' },
      });

      // Update room to REVEALED with participant reveal flag
      const r = await tx.room.update({
        where: { id },
        data: {
          status: 'REVEALED',
          resultsRevealedToParticipants: true,
          participantRevealedAt: now,
          revealedAt: now,
        },
      });

      // Authoritative locking: All submissions in this revealed room are locked
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

    // Real-Time Broadcasts: Scoped strictly to target room and admin
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
      message: `Results for Room "${updatedRoom.name}" (${updatedRoom.code}) have been publicly revealed to participants.`,
      room: updatedRoom,
      results,
    });
  } catch (error) {
    console.error('Error revealing participant results:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to reveal participant results.' },
      { status: 500 }
    );
  }
}
