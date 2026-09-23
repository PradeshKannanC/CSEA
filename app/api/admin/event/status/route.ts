import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

const statusSchema = z.object({
  status: z.enum(['DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'ADMIN_REVEALED', 'REVEALED']),
  reset: z.boolean().optional(),
  force: z.boolean().optional(),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['OPEN'],
  OPEN: ['PAUSED', 'CLOSED'],
  PAUSED: ['OPEN', 'CLOSED'],
  CLOSED: ['ADMIN_REVEALED', 'OPEN'],
  ADMIN_REVEALED: ['REVEALED', 'CLOSED'],
  REVEALED: [],
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const body = await req.json();
    const result = statusSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message || 'Invalid lifecycle status.',
        },
        { status: 400 }
      );
    }

    const { status, reset, force } = result.data;
    const now = new Date();

    const currentEvent = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!currentEvent) {
      return NextResponse.json(
        { success: false, message: 'Tournament event configuration not found.' },
        { status: 404 }
      );
    }

    // Validate lifecycle transition; allow idempotent replays of the current status unless reset is requested.
    if (currentEvent.status === status && !reset) {
      return NextResponse.json({
        success: true,
        message: `Tournament arena already in ${status}.`,
        status,
        idempotent: true,
      });
    }

    const isReset = reset === true || status === 'DRAFT';
    const isForce = force === true;
    const allowed = ALLOWED_TRANSITIONS[currentEvent.status] || [];

    if (!isReset && !isForce && !allowed.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_TRANSITION',
          message: `Cannot transition tournament status from ${currentEvent.status} to ${status}. Allowed transitions: ${allowed.join(', ') || 'none'}.`,
        },
        { status: 400 }
      );
    }

    if (status === 'OPEN') {
      const teamCount = await prisma.team.count();
      const approvedIdeas = await prisma.idea.count({ where: { status: 'APPROVED' } });
      const roomCount = await prisma.room.count({ where: { status: { in: ['DRAFT', 'OPEN'] } } });
      const unassignedTeams = await prisma.team.findMany({
        where: { roomId: null },
        select: { name: true, teamId: true },
      });
      const issues: string[] = [];

      if (currentEvent.totalCoins <= 0) issues.push('Total coin budget must be configured and greater than zero.');
      if (currentEvent.minInvestment <= 0) issues.push('Minimum investment must be configured and greater than zero.');
      if (currentEvent.maxInvestment <= 0) issues.push('Maximum investment must be configured and greater than zero.');
      if (currentEvent.minInvestment >= currentEvent.maxInvestment) {
        issues.push('Minimum investment must be less than maximum investment.');
      }
      if (roomCount === 0) {
        issues.push('At least one competition room must be configured before opening the arena.');
      }
      if (teamCount === 0) issues.push('At least one team must be configured before starting the arena.');
      if (approvedIdeas === 0) issues.push('At least one approved idea is required before the arena can open.');
      if (unassignedTeams.length > 0) {
        issues.push(
          `All participating teams must be assigned to a room before opening the investment arena. Unassigned teams: ${unassignedTeams.map((t) => `${t.name} (${t.teamId})`).join(', ')}.`
        );
      }

      if (issues.length > 0) {
        return NextResponse.json(
          {
            success: false,
            code: unassignedTeams.length > 0 ? 'UNASSIGNED_TEAMS_DETECTED' : 'START_VALIDATION_FAILED',
            message: `Unable to start the arena: ${issues.join(' ')}`,
            unassignedTeams,
          },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (status === 'DRAFT') {
        await tx.event.update({
          where: { id: currentEvent.id },
          data: {
            status: 'DRAFT',
            investmentStartsAt: null,
            investmentEndsAt: null,
            revealedAt: null,
          },
        });

        // Unlock ideas and clear rankings for draft reset
        await tx.idea.updateMany({
          data: {
            isLocked: false,
            lockedAt: null,
            rank: null,
          },
        });

        // Clear staged results for the current event only
        await tx.result.deleteMany({
          where: { eventId: currentEvent.id },
        });
      } else if (status === 'OPEN') {
        await tx.event.update({
          where: { id: currentEvent.id },
          data: {
            status: 'OPEN',
            investmentStartsAt: currentEvent.investmentStartsAt || now,
            investmentEndsAt:
              currentEvent.investmentEndsAt && currentEvent.investmentEndsAt.getTime() > now.getTime()
                ? currentEvent.investmentEndsAt
                : new Date(now.getTime() + 4 * 3600 * 1000),
          },
        });

        // Only lock ideas in rooms where investment has started (never unassigned, DRAFT, or CLOSED rooms)
        await tx.idea.updateMany({
          where: {
            status: 'APPROVED',
            room: {
              status: { in: ['OPEN', 'PAUSED', 'REVEALED'] },
            },
          },
          data: {
            isLocked: true,
            lockedAt: now,
          },
        });
      } else if (status === 'PAUSED') {
        await tx.event.update({
          where: { id: currentEvent.id },
          data: { status: 'PAUSED' },
        });
      } else if (status === 'CLOSED') {
        await tx.event.update({
          where: { id: currentEvent.id },
          data: { status: 'CLOSED' },
        });

        await tx.idea.updateMany({
          where: {
            room: {
              status: { in: ['OPEN', 'PAUSED', 'REVEALED'] },
            },
          },
          data: { isLocked: true, lockedAt: now },
        });
      } else if (status === 'ADMIN_REVEALED') {
        await tx.event.update({
          where: { id: currentEvent.id },
          data: { status: 'ADMIN_REVEALED' },
        });

        await tx.idea.updateMany({
          where: {
            room: {
              status: { in: ['OPEN', 'PAUSED', 'REVEALED'] },
            },
          },
          data: { isLocked: true, lockedAt: now },
        });

        // Authoritatively calculate tournament rankings from verified database investments for the current event
        const ideas = await tx.idea.findMany({
          where: { status: 'APPROVED' },
          include: {
            team: {
              include: { roster: true },
            },
            investments: {
              where: {
                OR: [
                  { eventId: currentEvent.id },
                  { eventId: null },
                ],
              },
              select: { amount: true, investorId: true },
            },
          },
        });

        const calculatedIdeas = ideas.map((idea) => {
          const totalCoins = idea.investments.reduce((sum, inv) => sum + inv.amount, 0);
          const investorCount = new Set(idea.investments.map((inv) => inv.investorId)).size;
          return {
            idea,
            totalCoins,
            investorCount,
            createdAt: idea.createdAt.getTime(),
          };
        });

        // Clear existing rankings for the CURRENT event only (preserving all previous events)
        await tx.result.deleteMany({
          where: { eventId: currentEvent.id },
        });

        // Group ideas by room: Room A ideas are ranked only against Room A ideas!
        const ideasByRoom = new Map<string, typeof calculatedIdeas>();
        for (const item of calculatedIdeas) {
          const roomId = item.idea.team.roomId || '__unassigned__';
          if (!ideasByRoom.has(roomId)) {
            ideasByRoom.set(roomId, []);
          }
          ideasByRoom.get(roomId)!.push(item);
        }

        for (const [roomId, roomIdeas] of ideasByRoom.entries()) {
          // Deterministic sorting per room: Total Coins DESC -> Investor Count DESC -> Creation Time ASC
          roomIdeas.sort((a, b) => {
            if (b.totalCoins !== a.totalCoins) {
              return b.totalCoins - a.totalCoins;
            }
            if (b.investorCount !== a.investorCount) {
              return b.investorCount - a.investorCount;
            }
            return a.createdAt - b.createdAt;
          });

          for (let i = 0; i < roomIdeas.length; i++) {
            const item = roomIdeas[i];
            const rank = i + 1;
            const trophy =
              rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'finalist';
            const memberNames = item.idea.team.roster.map((m) => m.name);

            await tx.result.create({
              data: {
                eventId: currentEvent.id,
                roomId: roomId === '__unassigned__' ? null : roomId,
                rank,
                ideaId: item.idea.id,
                teamName: item.idea.team.name,
                members: memberNames,
                track: item.idea.track,
                totalCoins: item.totalCoins,
                investorCount: item.investorCount,
                trophy,
                revealedAt: now,
              },
            });

            await tx.idea.update({
              where: { id: item.idea.id },
              data: {
                totalInvested: item.totalCoins,
                investorCount: item.investorCount,
                rank,
              },
            });
          }
        }
      } else if (status === 'REVEALED') {
        await tx.event.update({
          where: { id: currentEvent.id },
          data: {
            status: 'REVEALED',
            revealedAt: now,
          },
        });

        await tx.idea.updateMany({
          data: { isLocked: true, lockedAt: now },
        });

        // If results table is not populated yet for this event, populate it now
        const existingResultsCount = await tx.result.count({
          where: { eventId: currentEvent.id },
        });
        if (existingResultsCount === 0) {
          const ideas = await tx.idea.findMany({
            where: { status: 'APPROVED' },
            include: {
              team: {
                include: { roster: true },
              },
              investments: {
                where: {
                  OR: [
                    { eventId: currentEvent.id },
                    { eventId: null },
                  ],
                },
                select: { amount: true, investorId: true },
              },
            },
          });

          const calculatedIdeas = ideas.map((idea) => {
            const totalCoins = idea.investments.reduce((sum, inv) => sum + inv.amount, 0);
            const investorCount = new Set(idea.investments.map((inv) => inv.investorId)).size;
            return {
              idea,
              totalCoins,
              investorCount,
              createdAt: idea.createdAt.getTime(),
            };
          });

          calculatedIdeas.sort((a, b) => {
            if (b.totalCoins !== a.totalCoins) return b.totalCoins - a.totalCoins;
            if (b.investorCount !== a.investorCount) return b.investorCount - a.investorCount;
            return a.createdAt - b.createdAt;
          });

          await tx.result.deleteMany({
            where: { eventId: currentEvent.id },
          });

          for (let i = 0; i < calculatedIdeas.length; i++) {
            const item = calculatedIdeas[i];
            const rank = i + 1;
            const trophy =
              rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'finalist';
            const memberNames = item.idea.team.roster.map((m) => m.name);

            await tx.result.create({
              data: {
                eventId: currentEvent.id,
                roomId: item.idea.roomId || item.idea.team.roomId || null,
                teamId: item.idea.team.id,
                teamCode: item.idea.team.teamId,
                ideaId: item.idea.id,
                ideaTitle: item.idea.title,
                anonymousId: item.idea.anonymousId,
                rank,
                teamName: item.idea.team.name,
                members: memberNames,
                track: item.idea.track,
                totalCoins: item.totalCoins,
                investorCount: item.investorCount,
                trophy,
                revealedAt: now,
              },
            });

            await tx.idea.update({
              where: { id: item.idea.id },
              data: {
                totalInvested: item.totalCoins,
                investorCount: item.investorCount,
                rank,
              },
            });
          }
        }

        // Authoritatively synchronize all rooms to REVEALED
        await tx.room.updateMany({
          where: currentEvent.id ? { OR: [{ eventId: currentEvent.id }, { eventId: null }] } : {},
          data: {
            status: 'REVEALED',
            resultsRevealedToParticipants: true,
            revealedAt: now,
            participantRevealedAt: now,
          },
        });
      }

      // Record audit log
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: `EVENT_STATUS_${status}`,
          entity: 'EVENT',
          entityId: currentEvent.id,
          metadata: { status, triggeredBy: auth.user.name },
        },
      });
    });

    // Handle Real-Time Broadcasts with strict role isolation
    if (status === 'ADMIN_REVEALED') {
      // Broadcast ONLY to Admins — participants remain on CLOSED state
      realtimeHub.broadcastToRole('ADMIN', 'EVENT_STATUS_CHANGED', {
        status: 'ADMIN_REVEALED',
        timestamp: Date.now(),
        isLocked: true,
      });
      realtimeHub.broadcastToRole('ADMIN', 'ADMIN_RESULTS_REVEALED', {
        revealed: true,
        timestamp: Date.now(),
      });
    } else if (status === 'REVEALED') {
      // Broadcast globally to all participants and admins
      realtimeHub.broadcast('EVENT_STATUS_CHANGED', {
        status: 'REVEALED',
        timestamp: Date.now(),
        isLocked: true,
      });
      realtimeHub.broadcast('RESULTS_REVEALED', {
        revealed: true,
        timestamp: Date.now(),
      });
    } else if (status === 'CLOSED') {
      realtimeHub.broadcast('EVENT_STATUS_CHANGED', {
        status: 'CLOSED',
        timestamp: Date.now(),
        isLocked: false,
      });
      realtimeHub.broadcast('ARENA_CLOSED', {
        timestamp: Date.now(),
      });
    } else {
      realtimeHub.broadcast('EVENT_STATUS_CHANGED', {
        status,
        timestamp: Date.now(),
        isLocked: status !== 'OPEN',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Tournament arena transitioned to ${status}.`,
      status,
    });
  } catch (error) {
    console.error('Error updating event status:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to transition tournament status.',
      },
      { status: 500 }
    );
  }
}