import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/rooms/[id]/resume
 * Transitions a room from PAUSED back to OPEN.
 * Resumes investments for this room while preserving historical timer architecture.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id } = await params;

    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      return NextResponse.json(
        { success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
        { status: 404 }
      );
    }

    if (room.status === 'OPEN') {
      return NextResponse.json({
        success: true,
        message: `Room "${room.name}" is already open.`,
        room,
        idempotent: true,
      });
    }

    if (room.status !== 'PAUSED') {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_TRANSITION',
          message: `Cannot resume room "${room.name}" from status ${room.status}. Only PAUSED rooms can be resumed.`,
        },
        { status: 400 }
      );
    }

    const updatedRoom = await prisma.room.update({
      where: { id },
      data: {
        status: 'OPEN',
        pausedAt: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'ROOM_RESUMED',
        entity: 'ROOM',
        entityId: id,
        metadata: { roomName: room.name, code: room.code },
      },
    });

    // Real-Time Broadcasts: Scoped strictly to target room and admin
    realtimeHub.broadcastToRoom(id, 'ROOM_STATUS_CHANGED', {
      roomId: id,
      roomName: updatedRoom.name,
      roomCode: updatedRoom.code,
      status: 'OPEN',
      timestamp: Date.now(),
    });

    realtimeHub.broadcastToRole('ADMIN', 'ROOM_STATUS_CHANGED', {
      roomId: id,
      roomName: updatedRoom.name,
      roomCode: updatedRoom.code,
      status: 'OPEN',
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      message: `Room "${updatedRoom.name}" has been resumed. Investment arena is active.`,
      room: updatedRoom,
    });
  } catch (error) {
    console.error('Error resuming room:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to resume room.' },
      { status: 500 }
    );
  }
}
