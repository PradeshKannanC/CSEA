import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const updateRoomSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  code: z.string().min(2).max(20).trim().toUpperCase().optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'REVEALED']).optional(),
  initialCoins: z.number().int().positive().optional(),
  minInvestment: z.number().int().positive().optional(),
  maxInvestment: z.number().int().positive().optional(),
  version: z.number().int().optional(),
});

/**
 * GET /api/admin/rooms/[id]
 * Returns full room details, assigned teams, idea status, recent investments, and metrics.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id } = await params;

    const event = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const eventFilter = event?.id ? { OR: [{ eventId: event.id }, { eventId: null }] } : {};

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        budgets: true,
        teams: {
          include: {
            leader: { select: { id: true, name: true, email: true } },
            roster: { select: { id: true, name: true, email: true, role: true } },
            users: {
              where: { isActive: true },
            },
            idea: {
              include: {
                investments: {
                  where: eventFilter,
                },
              },
            },
          },
        },
        results: {
          orderBy: { rank: 'asc' },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
        { status: 404 }
      );
    }

    const eventBudget = event?.totalCoins ?? 100;

    // Participants across teams in this room
    const participantUserMap = new Map<string, any>();
    room.teams.forEach((t) => {
      t.users.forEach((u) => {
        if (u.isActive) participantUserMap.set(u.id, u);
      });
      t.roster.forEach((m) => {
        if ((m as any).user && (m as any).user.isActive) {
          participantUserMap.set((m as any).user.id, (m as any).user);
        }
      });
    });

    const participantCount = participantUserMap.size;
    const roomBudgetSum = room.budgets.reduce((sum, b) => sum + b.allocatedCoins, 0);
    const totalCoinsDistributed = roomBudgetSum > 0
      ? roomBudgetSum
      : participantCount * (room.initialCoins ?? eventBudget);

    let totalCoinsInvested = 0;
    let ideaCount = 0;

    const teamsDetail = room.teams.map((t) => {
      let teamInvested = 0;
      if (t.idea) {
        ideaCount++;
        teamInvested = t.idea.investments.reduce((sum, inv) => sum + inv.amount, 0);
        totalCoinsInvested += teamInvested;
      }

      return {
        id: t.id,
        teamId: t.teamId,
        name: t.name,
        cohort: t.cohort,
        submissionId: t.submissionId,
        leaderName: t.leader?.name || 'Unassigned',
        memberCount: t.roster.length,
        members: t.roster,
        idea: t.idea
          ? {
              id: t.idea.id,
              anonymousId: t.idea.anonymousId,
              title: t.idea.title,
              track: t.idea.track,
              status: t.idea.status,
              isLocked: t.idea.isLocked,
              totalInvested: teamInvested,
              investorCount: t.idea.investorCount,
              velocity: t.idea.velocity,
              rank: t.idea.rank,
            }
          : null,
      };
    });

    const totalCoinsRemaining = Math.max(0, totalCoinsDistributed - totalCoinsInvested);

    // Recent investments in this room
    const recentInvestments = await prisma.investment.findMany({
      where: {
        OR: [
          { roomId: id },
          { idea: { team: { roomId: id } } },
        ],
      },
      include: {
        investor: { select: { name: true, email: true, role: true } },
        idea: { select: { anonymousId: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        code: room.code,
        description: room.description,
        status: room.status,
        version: room.version,
        startedAt: room.startedAt ? room.startedAt.toISOString() : null,
        pausedAt: room.pausedAt ? room.pausedAt.toISOString() : null,
        closedAt: room.closedAt ? room.closedAt.toISOString() : null,
        revealedAt: room.revealedAt ? room.revealedAt.toISOString() : null,
        resultsRevealedToAdmins: room.resultsRevealedToAdmins,
        resultsRevealedToParticipants: room.resultsRevealedToParticipants,
        adminRevealedAt: room.adminRevealedAt ? room.adminRevealedAt.toISOString() : null,
        participantRevealedAt: room.participantRevealedAt ? room.participantRevealedAt.toISOString() : null,
        investmentStartsAt: room.investmentStartsAt ? room.investmentStartsAt.toISOString() : null,
        investmentEndsAt: room.investmentEndsAt ? room.investmentEndsAt.toISOString() : null,
        initialCoins: room.initialCoins,
        minInvestment: room.minInvestment,
        maxInvestment: room.maxInvestment,
        teamCount: room.teams.length,
        participantCount,
        ideaCount,
        approvedIdeasCount: teamsDetail.filter((t) => t.idea && t.idea.status === 'APPROVED').length,
        investableIdeasCount: teamsDetail.filter((t) => t.idea && t.idea.status === 'APPROVED').length >= 2
          ? teamsDetail.filter((t) => t.idea && t.idea.status === 'APPROVED').length
          : 0,
        totalCoinsDistributed,
        totalCoinsInvested,
        totalCoinsRemaining,
        stats: {
          teamCount: room.teams.length,
          totalMembers: participantCount,
          ideaCount,
          approvedIdeasCount: teamsDetail.filter((t) => t.idea && t.idea.status === 'APPROVED').length,
          investableIdeasCount: teamsDetail.filter((t) => t.idea && t.idea.status === 'APPROVED').length >= 2
            ? teamsDetail.filter((t) => t.idea && t.idea.status === 'APPROVED').length
            : 0,
          investmentCount: recentInvestments.length,
          totalCoins: totalCoinsInvested,
          totalCoinsDistributed,
          totalCoinsRemaining,
        },
        teams: teamsDetail,
        results: room.results,
        recentInvestments: recentInvestments.map((inv) => ({
          id: inv.id,
          amount: inv.amount,
          investorName: inv.investor.name,
          investorRole: inv.investor.role,
          ideaAnonymousId: inv.idea.anonymousId,
          ideaTitle: inv.idea.title,
          createdAt: inv.createdAt.toISOString(),
        })),
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
      },
      diagnostics: {
        teamsCount: room.teams.length,
        ideasCount: ideaCount,
        approvedIdeasCount: teamsDetail.filter((t) => t.idea && t.idea.status === 'APPROVED').length,
        investableIdeasCount: teamsDetail.filter((t) => t.idea && t.idea.status === 'APPROVED').length >= 2
          ? teamsDetail.filter((t) => t.idea && t.idea.status === 'APPROVED').length
          : 0,
        readyForInvestment: room.teams.length >= 2 && teamsDetail.filter((t) => t.idea && t.idea.status === 'APPROVED').length >= 2,
      },
    });
  } catch (error) {
    console.error('Error fetching room details:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve room details.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/rooms/[id]
 * Updates room configuration or toggles active status.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id } = await params;
    const body = await req.json();
    const parsed = updateRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid update parameters.',
        },
        { status: 400 }
      );
    }

    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      return NextResponse.json(
        { success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
        { status: 404 }
      );
    }

    // 1. Optimistic Concurrency Check
    if (parsed.data.version !== undefined && parsed.data.version !== room.version) {
      return NextResponse.json(
        {
          success: false,
          code: 'SETTINGS_VERSION_CONFLICT',
          message: 'Room was updated by another administrator. Please refresh.',
        },
        { status: 409 }
      );
    }

    // 2. Settings Immutability Lock: once past DRAFT, initialCoins/minInvestment/maxInvestment cannot change
    const isChangingSettings =
      parsed.data.initialCoins !== undefined ||
      parsed.data.minInvestment !== undefined ||
      parsed.data.maxInvestment !== undefined;

    if (isChangingSettings && room.status !== 'DRAFT') {
      return NextResponse.json(
        {
          success: false,
          code: 'ROOM_SETTINGS_LOCKED',
          message: 'Room settings cannot be modified once the Arena has started.',
        },
        { status: 409 }
      );
    }

    // 3. If changing room code, verify uniqueness
    if (parsed.data.code && parsed.data.code !== room.code) {
      const duplicate = await prisma.room.findFirst({
        where: {
          code: parsed.data.code,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            code: 'ROOM_CODE_EXISTS',
            message: `A room with code "${parsed.data.code}" already exists.`,
          },
          { status: 400 }
        );
      }
    }

    // 4. Validate room status transitions
    if (parsed.data.status && parsed.data.status !== room.status) {
      const VALID_ROOM_TRANSITIONS: Record<string, string[]> = {
        DRAFT: ['OPEN'],
        OPEN: ['PAUSED', 'CLOSED'],
        PAUSED: ['OPEN', 'CLOSED'],
        CLOSED: ['REVEALED'],
        REVEALED: [],
      };

      const allowed = VALID_ROOM_TRANSITIONS[room.status] || [];
      if (!allowed.includes(parsed.data.status)) {
        return NextResponse.json(
          {
            success: false,
            code: 'INVALID_TRANSITION',
            message: `Cannot transition room from ${room.status} to ${parsed.data.status}. Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}.`,
          },
          { status: 400 }
        );
      }
    }

    const { version: _clientVersion, ...dataToUpdate } = parsed.data;

    const updated = await prisma.room.update({
      where: { id },
      data: {
        ...dataToUpdate,
        version: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'ROOM_UPDATED',
        entity: 'ROOM',
        entityId: id,
        metadata: parsed.data,
      },
    });

    if (parsed.data.status && parsed.data.status !== room.status) {
      realtimeHub.broadcastToRoom(id, 'ROOM_STATUS_CHANGED', {
        roomId: id,
        roomName: updated.name,
        roomCode: updated.code,
        status: updated.status,
        timestamp: Date.now(),
      });
      realtimeHub.broadcastToRole('ADMIN', 'ROOM_STATUS_CHANGED', {
        roomId: id,
        roomName: updated.name,
        roomCode: updated.code,
        status: updated.status,
        timestamp: Date.now(),
      });
    }

    realtimeHub.broadcast('ROOM_UPDATED', {
      action: 'UPDATED',
      roomId: id,
      roomName: updated.name,
    });

    return NextResponse.json({
      success: true,
      message: `Room "${updated.name}" updated successfully.`,
      room: updated,
    });
  } catch (error) {
    console.error('Error updating room:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update room.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/rooms/[id]
 * Safely deletes an empty DRAFT room.
 * Active (OPEN/PAUSED) or rooms with history/teams are strictly rejected with 409.
 */
export async function DELETE(
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

    // 1. Rejection: Room in OPEN or PAUSED state
    if (room.status === 'OPEN' || room.status === 'PAUSED') {
      return NextResponse.json(
        {
          success: false,
          code: 'ROOM_ACTIVE_CANNOT_DELETE',
          message: 'Cannot delete a room while Arena is running or paused.',
        },
        { status: 409 }
      );
    }

    // 2. Rejection: Room with teams, ideas, investments, participant budgets, or non-DRAFT status
    const [teamsCount, budgetsCount, investmentsCount] = await Promise.all([
      prisma.team.count({ where: { roomId: id } }),
      prisma.participantBudget.count({ where: { roomId: id } }),
      prisma.investment.count({ where: { roomId: id } }),
    ]);

    if (teamsCount > 0 || budgetsCount > 0 || investmentsCount > 0 || room.status !== 'DRAFT') {
      return NextResponse.json(
        {
          success: false,
          code: 'ROOM_HAS_HISTORICAL_DATA',
          message: 'Room cannot be deleted because it contains teams or event records.',
        },
        { status: 409 }
      );
    }

    await prisma.room.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'ROOM_DELETED',
        entity: 'ROOM',
        entityId: id,
        metadata: { name: room.name, code: room.code },
      },
    });

    realtimeHub.broadcast('ROOM_DELETED', {
      roomId: id,
      roomName: room.name,
    });
    realtimeHub.broadcastToRole('ADMIN', 'ROOM_DELETED', {
      roomId: id,
      roomName: room.name,
    });
    realtimeHub.broadcast('ROOM_UPDATED', {
      action: 'DELETED',
      roomId: id,
      roomName: room.name,
    });

    return NextResponse.json({
      success: true,
      message: `Room "${room.name}" was successfully deleted.`,
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete room.' },
      { status: 500 }
    );
  }
}

