import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';
import { generateUniqueRoomCode } from '@/lib/code-generator';

export const dynamic = 'force-dynamic';

const createRoomSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters').max(80),
  code: z
    .string()
    .min(2, 'Room code must be at least 2 characters')
    .max(20)
    .trim()
    .toUpperCase()
    .optional(),
  description: z.string().max(500).optional(),
  initialCoins: z.number().int().positive().optional(),
  minInvestment: z.number().int().positive().optional(),
  maxInvestment: z.number().int().positive().optional(),
});

/**
 * GET /api/admin/rooms
 * Returns all competition rooms with calculated counts and coin allocations.
 */
export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const event = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const eventFilter = event?.id ? { OR: [{ eventId: event.id }, { eventId: null }] } : {};

    const [rooms, unassignedTeamsCount] = await Promise.all([
      prisma.room.findMany({
        where: {},
        include: {
          budgets: true,
          teams: {
            include: {
              users: {
                where: { isActive: true },
              },
              roster: {
                include: { user: true },
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
        },
        orderBy: { name: 'asc' },
      }),
      prisma.team.count({
        where: { roomId: null },
      }),
    ]);

    const eventBudget = event?.totalCoins ?? 100;

    const roomStats = rooms.map((room) => {
      const teamCount = room.teams.length;

      // Extract unique active participants across teams in this room
      const participantUserMap = new Map<string, any>();
      room.teams.forEach((t) => {
        t.users.forEach((u) => {
          if (u.isActive) participantUserMap.set(u.id, u);
        });
        t.roster.forEach((m) => {
          if (m.user && m.user.isActive) participantUserMap.set(m.user.id, m.user);
        });
      });

      const participantCount = participantUserMap.size;

      const roomBudgetSum = room.budgets.reduce((sum, b) => sum + b.allocatedCoins, 0);
      const totalCoinsDistributed = roomBudgetSum > 0
        ? roomBudgetSum
        : participantCount * (room.initialCoins ?? eventBudget);

      // Total coins invested into ideas belonging to teams in this room
      let totalCoinsInvested = 0;
      let ideaCount = 0;

      room.teams.forEach((t) => {
        if (t.idea) {
          ideaCount++;
          totalCoinsInvested += t.idea.investments.reduce((sum, inv) => sum + inv.amount, 0);
        }
      });

      const totalCoinsRemaining = Math.max(0, totalCoinsDistributed - totalCoinsInvested);

      return {
        id: room.id,
        name: room.name,
        code: room.code,
        description: room.description,
        status: room.status,
        version: room.version,
        teamCount,
        participantCount,
        ideaCount,
        totalCoinsDistributed,
        totalCoinsInvested,
        totalCoinsRemaining,
        teams: room.teams.map((t) => ({
          id: t.id,
          teamId: t.teamId,
          name: t.name,
          submissionId: t.submissionId,
          hasIdea: Boolean(t.idea),
          ideaAnonymousId: t.idea?.anonymousId || null,
        })),
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
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
      };
    });

    return NextResponse.json({
      success: true,
      rooms: roomStats,
      unassignedTeamsCount,
      eventStatus: event?.status || 'DRAFT',
      isLocked: event?.status ? ['OPEN', 'PAUSED'].includes(event.status) : false,
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve rooms.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/rooms
 * Creates a new dynamic competition room.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const body = await req.json();
    const parsed = createRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid room payload.',
        },
        { status: 400 }
      );
    }

    const { name, code: userCode, description, initialCoins, minInvestment, maxInvestment } = parsed.data;

    const event = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    let finalCode = userCode;
    if (finalCode) {
      // Check user-provided code uniqueness
      const existing = await prisma.room.findFirst({
        where: {
          code: finalCode,
          ...(event?.id ? { eventId: event.id } : {}),
        },
      });

      if (existing) {
        return NextResponse.json(
          {
            success: false,
            code: 'ROOM_CODE_EXISTS',
            message: `A room with code "${finalCode}" already exists for this event.`,
          },
          { status: 400 }
        );
      }
    } else {
      finalCode = await generateUniqueRoomCode(event?.id);
    }

    const newRoom = await prisma.room.create({
      data: {
        name,
        code: finalCode,
        description: description || null,
        status: 'DRAFT',
        eventId: event?.id || null,
        initialCoins: initialCoins ?? null,
        minInvestment: minInvestment ?? null,
        maxInvestment: maxInvestment ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'ROOM_CREATED',
        entity: 'ROOM',
        entityId: newRoom.id,
        metadata: { name, code: finalCode },
      },
    });

    realtimeHub.broadcast('ROOM_CREATED', {
      roomId: newRoom.id,
      roomName: newRoom.name,
      roomCode: finalCode,
    });

    realtimeHub.broadcast('ROOM_UPDATED', {
      action: 'CREATED',
      roomId: newRoom.id,
      roomName: newRoom.name,
    });

    return NextResponse.json({
      success: true,
      message: `Room "${name}" (${finalCode}) created successfully.`,
      room: newRoom,
    });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create room.' },
      { status: 500 }
    );
  }
}
