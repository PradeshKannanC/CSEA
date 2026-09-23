import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable
    }

    const currentEvent = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!currentEvent) {
      return NextResponse.json(
        { success: false, message: 'Tournament event configuration not found.' },
        { status: 404 }
      );
    }

    // Allow starting new arena after CLOSED, ADMIN_REVEALED, or REVEALED
    const allowableStatuses = ['CLOSED', 'ADMIN_REVEALED', 'REVEALED'];
    if (!allowableStatuses.includes(currentEvent.status)) {
      return NextResponse.json(
        {
          success: false,
          code: 'ARENA_ACTIVE',
          message: `Cannot start a new arena while current arena is ${currentEvent.status}. Please close the arena first.`,
        },
        { status: 400 }
      );
    }

    const nextRound = (currentEvent.round ?? 1) + 1;
    const now = new Date();

    const newEvent = await prisma.$transaction(async (tx) => {
      // 1. Create the new Event cycle in DRAFT state
      const created = await tx.event.create({
        data: {
          name: `PITCH AND PROSPER Arena (Round ${nextRound})`,
          status: 'DRAFT',
          round: nextRound,
          totalCoins: currentEvent.totalCoins,
          minInvestment: currentEvent.minInvestment,
          maxInvestment: currentEvent.maxInvestment,
          totalDistributedCoins: currentEvent.totalDistributedCoins,
          targetTeamsCount: currentEvent.targetTeamsCount,
          investmentStartsAt: null,
          investmentEndsAt: null,
          revealedAt: null,
        },
      });

      // 2. Refresh participant wallets for the new investment cycle
      await tx.wallet.updateMany({
        data: {
          totalCoins: currentEvent.totalCoins,
          availableCoins: currentEvent.totalCoins,
          investedCoins: 0,
        },
      });

      // 3. Reset active idea live tracking counters for the new round
      // Historical investments and results remain preserved with eventId: currentEvent.id
      await tx.idea.updateMany({
        data: {
          totalInvested: 0,
          investorCount: 0,
          velocity: 'STABLE',
          rank: null,
          isLocked: false,
          lockedAt: null,
        },
      });

      // 4. Record audit log
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'NEW_ARENA_INITIALIZED',
          entity: 'EVENT',
          entityId: created.id,
          metadata: {
            previousEventId: currentEvent.id,
            previousStatus: currentEvent.status,
            previousRound: currentEvent.round ?? 1,
            newRound: nextRound,
            totalCoins: currentEvent.totalCoins,
            triggeredBy: auth.user.name,
          },
        },
      });

      return created;
    });

    // 5. Broadcast real-time SSE updates
    realtimeHub.broadcast('EVENT_STATUS_CHANGED', {
      status: 'DRAFT',
      timestamp: Date.now(),
      isLocked: true,
      eventId: newEvent.id,
      round: nextRound,
    });

    realtimeHub.broadcast('NEW_ARENA_INITIALIZED', {
      eventId: newEvent.id,
      round: nextRound,
      totalCoins: currentEvent.totalCoins,
      timestamp: Date.now(),
    });

    // Broadcast wallet refresh to all active users
    const allWallets = await prisma.wallet.findMany({
      select: { userId: true, availableCoins: true, investedCoins: true, totalCoins: true },
    });

    for (const w of allWallets) {
      realtimeHub.broadcastToUser(w.userId, 'WALLET_UPDATED', {
        availableCoins: w.availableCoins,
        investedCoins: w.investedCoins,
        totalCoins: w.totalCoins,
        timestamp: Date.now(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `New tournament arena (Round ${nextRound}) created successfully in DRAFT state.`,
      event: newEvent,
    });
  } catch (error) {
    console.error('Error starting new arena:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to initialize new arena cycle.',
      },
      { status: 500 }
    );
  }
}
