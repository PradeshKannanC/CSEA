import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

type TxResult =
  | { error: true; status: number; payload: any }
  | { error: false; updatedRoom: any; participantUserIds: string[] };

/**
 * POST /api/admin/rooms/[id]/start
 * Atomically starts an arena round for room [id].
 * Snapshots room configuration, initializes participant budgets, increments version, and broadcasts.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id } = await params;

    const txResult: TxResult = await prisma.$transaction(async (tx): Promise<TxResult> => {
      const room = await tx.room.findUnique({
        where: { id },
        include: {
          teams: {
            include: {
              roster: true,
              idea: true,
            },
          },
        },
      });

      if (!room) {
        return {
          error: true,
          status: 404,
          payload: { success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
        };
      }

      // If room was already started or transitioned by another admin concurrently
      if (room.status !== 'DRAFT') {
        return {
          error: true,
          status: 409,
          payload: {
            success: false,
            code: 'ROOM_STATE_CHANGED',
            message: 'This room was updated by another administrator. Refreshing the latest state.',
            room,
          },
        };
      }

      // Readiness Checks
      if (room.teams.length === 0) {
        return {
          error: true,
          status: 400,
          payload: {
            success: false,
            code: 'ROOM_NOT_READY',
            message: `Cannot start room "${room.name}": No teams are assigned to this room. Please assign teams first.`,
          },
        };
      }

      const approvedIdeas = room.teams
        .map((t) => t.idea)
        .filter((idea): idea is NonNullable<typeof idea> => Boolean(idea && idea.status === 'APPROVED'));

      if (approvedIdeas.length === 0) {
        const teamsWithoutApprovedIdeas = room.teams
          .filter((t) => !t.idea || t.idea.status !== 'APPROVED')
          .map((t) => t.name);

        return {
          error: true,
          status: 400,
          payload: {
            success: false,
            code: 'ROOM_NOT_READY',
            message: `Cannot start room "${room.name}": At least one approved idea is required. Teams without approved ideas: ${teamsWithoutApprovedIdeas.join(', ')}.`,
          },
        };
      }

      const event = await tx.event.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      // Snapshot room configuration: explicit room settings take priority; fallback to current event defaults
      const initialCoins = room.initialCoins ?? event?.totalCoins ?? 100;
      const minInvestment = room.minInvestment ?? event?.minInvestment ?? 10;
      const maxInvestment = room.maxInvestment ?? event?.maxInvestment ?? 50;
      const now = new Date();

      // Collect participants
      const participantIds = new Set<string>();
      for (const t of room.teams) {
        if (t.leaderId) participantIds.add(t.leaderId);
        for (const m of t.roster) {
          if (m.userId) participantIds.add(m.userId);
        }
      }

      const teamDbIds = room.teams.map((t) => t.id);
      const activeUsers = await tx.user.findMany({
        where: { teamId: { in: teamDbIds }, isActive: true },
        select: { id: true },
      });
      for (const u of activeUsers) {
        participantIds.add(u.id);
      }

      // 1. Transactionally initialize ParticipantBudgets for all participants in this room
      for (const userId of participantIds) {
        await tx.participantBudget.upsert({
          where: {
            userId_roomId: {
              userId,
              roomId: id,
            },
          },
          update: {},
          create: {
            userId,
            roomId: id,
            eventId: room.eventId,
            allocatedCoins: initialCoins,
            investedCoins: 0,
            availableCoins: initialCoins,
          },
        });
      }

      // 2. Lock approved ideas in this room
      const ideaIds = approvedIdeas.map((i) => i.id);
      await tx.idea.updateMany({
        where: { id: { in: ideaIds } },
        data: {
          isLocked: true,
          lockedAt: now,
        },
      });

      // 3. Transition room status to OPEN atomically guarded by status and version
      const updateResult = await tx.room.updateMany({
        where: {
          id,
          status: 'DRAFT',
          version: room.version,
        },
        data: {
          status: 'OPEN',
          initialCoins,
          minInvestment,
          maxInvestment,
          version: { increment: 1 },
          startedAt: room.startedAt || now,
          pausedAt: null,
          investmentStartsAt: room.investmentStartsAt || now,
          investmentEndsAt:
            room.investmentEndsAt && room.investmentEndsAt.getTime() > now.getTime()
              ? room.investmentEndsAt
              : new Date(now.getTime() + 4 * 3600 * 1000),
        },
      });

      if (updateResult.count === 0) {
        return {
          error: true,
          status: 409,
          payload: {
            success: false,
            code: 'ROOM_STATE_CHANGED',
            message: 'This room was updated by another administrator. Refreshing the latest state.',
            room,
          },
        };
      }

      const updatedRoom = await tx.room.findUniqueOrThrow({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'ROOM_STARTED',
          entity: 'ROOM',
          entityId: id,
          metadata: {
            roomName: updatedRoom.name,
            roomCode: updatedRoom.code,
            teamsCount: room.teams.length,
            approvedIdeasCount: approvedIdeas.length,
            initialCoins,
            minInvestment,
            maxInvestment,
            participantsCount: participantIds.size,
          },
        },
      });

      return {
        error: false,
        updatedRoom,
        participantUserIds: Array.from(participantIds),
      };
    });

    if (txResult.error) {
      return NextResponse.json(txResult.payload, { status: txResult.status });
    }

    const { updatedRoom, participantUserIds } = txResult;

    // Real-Time Broadcasts: Scoped strictly to target room and admin
    for (const userId of participantUserIds) {
      const budget = await prisma.participantBudget.findUnique({
        where: { userId_roomId: { userId, roomId: updatedRoom.id } },
      });
      if (budget) {
        realtimeHub.broadcastToUser(userId, 'WALLET_UPDATED', {
          userId,
          roomId: updatedRoom.id,
          eventId: budget.eventId,
          totalCoins: budget.allocatedCoins,
          allocatedCoins: budget.allocatedCoins,
          investedCoins: budget.investedCoins,
          availableCoins: budget.availableCoins,
          totalBudget: budget.allocatedCoins,
          remaining: budget.availableCoins,
          timestamp: Date.now(),
        });
      }
    }

    realtimeHub.broadcastToRoom(updatedRoom.id, 'ROOM_STATUS_CHANGED', {
      roomId: updatedRoom.id,
      roomName: updatedRoom.name,
      roomCode: updatedRoom.code,
      status: 'OPEN',
      timestamp: Date.now(),
    });

    realtimeHub.broadcastToRole('ADMIN', 'ROOM_STATUS_CHANGED', {
      roomId: updatedRoom.id,
      roomName: updatedRoom.name,
      roomCode: updatedRoom.code,
      status: 'OPEN',
      timestamp: Date.now(),
    });

    realtimeHub.broadcast('ROOM_STARTED', {
      action: 'STARTED',
      roomId: updatedRoom.id,
      roomName: updatedRoom.name,
    });

    return NextResponse.json({
      success: true,
      message: `Room "${updatedRoom.name}" (${updatedRoom.code}) is now OPEN.`,
      room: updatedRoom,
    });
  } catch (error) {
    console.error('Error starting room:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to start room.' },
      { status: 500 }
    );
  }
}
