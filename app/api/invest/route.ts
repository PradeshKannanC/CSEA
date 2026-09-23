import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentParticipantContext } from '@/lib/context';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';
import { Velocity } from '@prisma/client';

const investSchema = z.object({
  ideaId: z.string().min(1, 'Target Idea ID is required'),
  amount: z.number().int().positive('Investment amount must be a positive integer'),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user and resolve authoritative context
    const context = await getCurrentParticipantContext();
    if (!context) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Please sign in to invest.',
        },
        { status: 401 }
      );
    }

    const { user, team, room } = context;
    const body = await req.json();
    const result = investSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message || 'Invalid investment request parameters.',
        },
        { status: 400 }
      );
    }

    const { ideaId, amount } = result.data;

    // 2. Retrieve Event from MySQL
    const event = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!event) {
      return NextResponse.json(
        {
          success: false,
          code: 'EVENT_NOT_CONFIGURED',
          message: 'Tournament configuration not found.',
        },
        { status: 500 }
      );
    }

    // 3. Retrieve Target Idea with Team relation
    const idea = await prisma.idea.findFirst({
      where: {
        OR: [{ id: ideaId }, { anonymousId: ideaId.toUpperCase() }],
      },
      include: {
        team: true,
      },
    });

    if (!idea) {
      return NextResponse.json(
        {
          success: false,
          code: 'IDEA_NOT_FOUND',
          message: 'The requested innovation asset does not exist in the active arena.',
        },
        { status: 404 }
      );
    }

    // 4. Verify Idea is Approved
    if (idea.status !== 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          code: 'IDEA_NOT_APPROVED',
          message: 'Only approved ideas are open for investment.',
        },
        { status: 403 }
      );
    }

    // 5. STRICT ROOM SCOPE AND SELF-TEAM INVESTMENT PREVENTIONS
    const userRoomId = context.roomId || room?.id;

    if (!context.team) {
      return NextResponse.json(
        {
          success: false,
          code: 'TEAM_NOT_ASSIGNED',
          message: context.reason || 'Your account is not associated with any competition team.',
        },
        { status: 403 }
      );
    }

    if (!userRoomId || !context.room) {
      return NextResponse.json(
        {
          success: false,
          code: 'NO_ROOM_ASSIGNED',
          message: context.reason || `Team "${context.team.name}" is not currently assigned to any competition room.`,
        },
        { status: 403 }
      );
    }

    // Verify user room status from authoritative context
    if (context.room.status !== 'OPEN') {
      const code =
        context.room.status === 'PAUSED'
          ? 'ROOM_PAUSED'
          : context.room.status === 'CLOSED'
          ? 'ROOM_CLOSED'
          : context.room.status === 'REVEALED'
          ? 'ROOM_REVEALED'
          : 'ROOM_NOT_OPEN';
      const message =
        context.room.status === 'PAUSED'
          ? 'ARENA PAUSED. Investment temporarily paused by administrator.'
          : context.room.status === 'CLOSED'
          ? 'Investment closed for this room.'
          : context.room.status === 'REVEALED'
          ? 'Tournament results have already been revealed for this room.'
          : 'The investment arena for this room is not currently open.';
      return NextResponse.json({ success: false, code, message }, { status: 403 });
    }

    const targetRoomId = idea.team?.roomId;

    if (!targetRoomId || userRoomId !== targetRoomId) {
      console.warn(
        `[SECURITY] Cross-room investment blocked: User ${user.id} in Room ${userRoomId} tried to invest in Idea ${idea.id} in Room ${targetRoomId}`
      );
      return NextResponse.json(
        {
          success: false,
          code: 'CROSS_ROOM_INVESTMENT_FORBIDDEN',
          message: 'Cross-room investments are strictly prohibited. You may only invest in ideas within your assigned room.',
        },
        { status: 403 }
      );
    }

    // Compare target idea team with current user's team
    if (
      team &&
      (team.id === idea.team.id ||
        team.teamId.toUpperCase() === idea.team.teamId.toUpperCase() ||
        team.id === idea.teamId)
    ) {
      const msg = "You cannot invest in your own team's idea.";
      return NextResponse.json(
        {
          success: false,
          code: 'OWN_TEAM_IDEA',
          legacyCode: 'OWN_TEAM_INVESTMENT_FORBIDDEN',
          message: msg,
          error: msg,
        },
        { status: 403 }
      );
    }

    // 6. Verify target room status and configuration snapshots
    const targetRoom = await prisma.room.findUnique({
      where: { id: targetRoomId },
    });

    if (!targetRoom) {
      return NextResponse.json(
        {
          success: false,
          code: 'ROOM_NOT_FOUND',
          message: 'Target competition room not found.',
        },
        { status: 404 }
      );
    }

    if (targetRoom.status !== 'OPEN') {
      return NextResponse.json(
        {
          success: false,
          code:
            targetRoom.status === 'PAUSED'
              ? 'ROOM_PAUSED'
              : targetRoom.status === 'CLOSED'
              ? 'ROOM_CLOSED'
              : targetRoom.status === 'REVEALED'
              ? 'ROOM_REVEALED'
              : 'ROOM_NOT_OPEN',
          message:
            targetRoom.status === 'PAUSED'
              ? 'ARENA PAUSED. Investment temporarily paused by administrator.'
              : targetRoom.status === 'CLOSED'
              ? 'Investment closed for this room.'
              : targetRoom.status === 'REVEALED'
              ? 'Tournament results have already been revealed for this room.'
              : 'The investment arena for this room is not currently open.',
        },
        { status: 403 }
      );
    }

    if (targetRoom.investmentEndsAt && Date.now() > targetRoom.investmentEndsAt.getTime()) {
      return NextResponse.json(
        {
          success: false,
          code: 'ROOM_CLOSED',
          message: 'The investment countdown has expired for this room.',
        },
        { status: 403 }
      );
    }

    // 7. Verify limits against room snapshot (fallback to event configuration)
    const minInvestment = targetRoom.minInvestment ?? event.minInvestment ?? 10;
    const maxInvestment = targetRoom.maxInvestment ?? event.maxInvestment ?? 50;

    if (amount < minInvestment) {
      const msg = `Minimum investment is ${minInvestment} coins.`;
      return NextResponse.json(
        {
          success: false,
          code: 'BELOW_MINIMUM',
          message: msg,
          error: msg,
        },
        { status: 400 }
      );
    }

    if (amount > maxInvestment) {
      const msg = `Maximum investment is ${maxInvestment} coins.`;
      return NextResponse.json(
        {
          success: false,
          code: 'EXCEEDS_MAXIMUM',
          message: msg,
          error: msg,
        },
        { status: 400 }
      );
    }

    // 8. Retrieve and Verify Room-Scoped Participant Budget
    const budget = await prisma.participantBudget.findUnique({
      where: {
        userId_roomId: {
          userId: user.id,
          roomId: targetRoomId,
        },
      },
    });

    if (!budget) {
      return NextResponse.json(
        {
          success: false,
          code: 'BUDGET_NOT_INITIALIZED',
          message: 'Your room wallet has not been initialized for this competition room. Please contact the administrator.',
          error: 'Your room wallet has not been initialized for this competition room. Please contact the administrator.',
        },
        { status: 409 }
      );
    }

    if (budget.availableCoins < amount) {
      const msg = `You only have ${budget.availableCoins} coins available.`;
      return NextResponse.json(
        {
          success: false,
          code: 'INSUFFICIENT_COINS',
          message: msg,
          error: msg,
          availableCoins: budget.availableCoins,
        },
        { status: 400 }
      );
    }

    // 9. Check if user already invested in this idea in this room (ONE INVESTMENT PER IDEA)
    const priorInvestment = await prisma.investment.findUnique({
      where: {
        investorId_roomId_ideaId: {
          investorId: user.id,
          roomId: targetRoomId,
          ideaId: idea.id,
        },
      },
    });

    if (priorInvestment) {
      return NextResponse.json(
        {
          success: false,
          code: 'ALREADY_INVESTED',
          message: 'You have already invested in this idea.',
        },
        { status: 409 }
      );
    }

    const newTotalInvested = idea.totalInvested + amount;
    const newInvestorCount = idea.investorCount + 1;
    const newVelocity =
      newTotalInvested > 700
        ? Velocity.HIGH
        : newTotalInvested > 550
        ? Velocity.STABLE
        : Velocity.MODERATE;

    // 10. ATOMIC DATABASE TRANSACTION (Prisma $transaction)
    const {
      investment,
      updatedBudget,
      freshTotalInvested,
      freshInvestorCount,
      freshVelocity,
      roomDistributedCoins,
      roomInvestedCoins,
      roomRemainingCoins,
      totalDistributedCoins,
      totalCoinsInvested,
      totalCoinsRemaining,
    } = await prisma.$transaction(async (tx) => {
      // Re-check existing investment inside transaction to prevent race conditions
      const existingInTx = await tx.investment.findUnique({
        where: {
          investorId_roomId_ideaId: {
            investorId: user.id,
            roomId: targetRoomId,
            ideaId: idea.id,
          },
        },
      });

      if (existingInTx) {
        throw new Error('ALREADY_INVESTED');
      }

      // Re-verify budget inside transaction with pessimistic row-level locking
      const [lockedBudget]: any[] = await tx.$queryRaw`
        SELECT * FROM \`ParticipantBudget\` WHERE \`id\` = ${budget.id} FOR UPDATE
      `;

      if (!lockedBudget) {
        throw new Error('BUDGET_NOT_FOUND');
      }

      const budgetAvail = lockedBudget.availableCoins;
      if (budgetAvail < amount) {
        throw new Error(`INSUFFICIENT_COINS:${budgetAvail}`);
      }

      // Re-fetch target idea inside transaction for latest aggregate totals
      const freshIdea = await tx.idea.findUnique({
        where: { id: idea.id },
      });

      if (!freshIdea) {
        throw new Error('IDEA_NOT_FOUND');
      }

      const calcTotalInvested = freshIdea.totalInvested + amount;
      const calcInvestorCount = freshIdea.investorCount + 1;
      const calcVelocity =
        calcTotalInvested > 700
          ? Velocity.HIGH
          : calcTotalInvested > 550
          ? Velocity.STABLE
          : Velocity.MODERATE;

      // Create investment record
      const inv = await tx.investment.create({
        data: {
          eventId: event.id,
          roomId: targetRoomId,
          investorId: user.id,
          ideaId: idea.id,
          amount,
        },
      });

      // Deduct budget available coins, increase invested coins
      await tx.$executeRaw`
        UPDATE \`ParticipantBudget\`
        SET \`availableCoins\` = \`availableCoins\` - ${amount},
            \`investedCoins\` = \`investedCoins\` + ${amount}
        WHERE \`id\` = ${budget.id} AND \`availableCoins\` >= ${amount}
      `;

      const b = await tx.participantBudget.findUniqueOrThrow({
        where: { id: budget.id },
      });

      // Sync legacy Wallet record if present for backward compatibility
      const legacyWallet = await tx.wallet.findUnique({
        where: { userId: user.id },
      });
      if (legacyWallet) {
        await tx.wallet.update({
          where: { id: legacyWallet.id },
          data: {
            totalCoins: b.allocatedCoins,
            investedCoins: b.investedCoins,
            availableCoins: b.availableCoins,
          },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: legacyWallet.id,
            type: 'DEPLOYMENT',
            amount,
            referenceId: inv.id,
          },
        }).catch(() => {});
      }

      // Update idea total invested, investor count, velocity
      await tx.idea.update({
        where: { id: idea.id },
        data: {
          roomId: targetRoomId,
          totalInvested: calcTotalInvested,
          investorCount: calcInvestorCount,
          velocity: calcVelocity,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'INVESTMENT_EXECUTED',
          entity: 'INVESTMENT',
          entityId: inv.id,
          metadata: {
            roomId: targetRoomId,
            ideaAnonymousId: idea.anonymousId,
            amount,
            remaining: b.availableCoins,
          },
        },
      });

      // Calculate room-scoped metrics
      const roomBudgets = await tx.participantBudget.findMany({
        where: { roomId: targetRoomId },
      });
      const rDistCoins = roomBudgets.reduce((sum, bRec) => sum + bRec.allocatedCoins, 0);

      const roomInvestments = await tx.investment.aggregate({
        where: { roomId: targetRoomId },
        _sum: { amount: true },
      });
      const rInvCoins = roomInvestments._sum.amount || 0;
      const rRemCoins = Math.max(0, rDistCoins - rInvCoins);

      // Calculate platform-wide metrics
      const allBudgets = await tx.participantBudget.findMany({});
      const distCoins = allBudgets.reduce((sum, bRec) => sum + bRec.allocatedCoins, 0);

      const currentEvtInvestments = await tx.investment.aggregate({
        where: {
          OR: [{ eventId: event.id }, { eventId: null }],
        },
        _sum: { amount: true },
      });

      const invCoins = currentEvtInvestments._sum.amount || 0;
      const remCoins = Math.max(0, distCoins - invCoins);

      return {
        investment: inv,
        updatedBudget: b,
        freshTotalInvested: calcTotalInvested,
        freshInvestorCount: calcInvestorCount,
        freshVelocity: calcVelocity,
        roomDistributedCoins: rDistCoins,
        roomInvestedCoins: rInvCoins,
        roomRemainingCoins: rRemCoins,
        totalDistributedCoins: distCoins,
        totalCoinsInvested: invCoins,
        totalCoinsRemaining: remCoins,
      };
    });

    // 11. REAL-TIME BROADCASTS (Server-Sent Events)
    // A. Notify the investing user of authoritative updated room budget balance
    realtimeHub.broadcastToUser(user.id, 'WALLET_UPDATED', {
      userId: user.id,
      eventId: event.id,
      roomId: targetRoomId,
      totalCoins: updatedBudget.allocatedCoins,
      allocatedCoins: updatedBudget.allocatedCoins,
      investedCoins: updatedBudget.investedCoins,
      availableCoins: updatedBudget.availableCoins,
      totalBudget: updatedBudget.allocatedCoins,
      remaining: updatedBudget.availableCoins,
      timestamp: Date.now(),
    });

    // B. Broadcast room-scoped investment event (only connected clients in targetRoomId receive this)
    realtimeHub.broadcastToRoom(targetRoomId, 'INVESTMENT_MADE', {
      ideaId: idea.id,
      anonymousId: idea.anonymousId,
      roomId: targetRoomId,
      timestamp: Date.now(),
    });

    // C. Broadcast confidential live investment aggregates strictly to ADMIN role
    realtimeHub.broadcastToRole('ADMIN', 'INVESTMENT_MADE', {
      ideaId: idea.id,
      anonymousId: idea.anonymousId,
      roomId: targetRoomId,
      totalInvested: freshTotalInvested,
      investorCount: freshInvestorCount,
      velocity: freshVelocity,
    });

    // D. Notify Admin with live authoritative platform and room metrics
    realtimeHub.broadcastToRole('ADMIN', 'ADMIN_METRICS_UPDATED', {
      ideaId: idea.id,
      roomId: targetRoomId,
      amount,
      investorId: user.id,
      roomDistributedCoins,
      roomInvestedCoins,
      roomRemainingCoins,
      totalDistributedCoins,
      totalCoinsInvested,
      totalCoinsRemaining,
      timestamp: Date.now(),
    });

    // E. Notify the investing user specifically that they have invested in this idea
    realtimeHub.broadcastToUser(user.id, 'IDEA_INVESTED', {
      userId: user.id,
      roomId: targetRoomId,
      ideaId: idea.id,
      anonymousId: idea.anonymousId,
      amount,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deployed ${amount} coins to ${idea.anonymousId}.`,
      investment: {
        id: investment.id,
        ideaId: idea.id,
        anonymousId: idea.anonymousId,
        amount,
        timestamp: investment.createdAt.getTime(),
      },
      budget: {
        userId: user.id,
        roomId: targetRoomId,
        eventId: event.id,
        allocatedCoins: updatedBudget.allocatedCoins,
        investedCoins: updatedBudget.investedCoins,
        availableCoins: updatedBudget.availableCoins,
        totalBudget: updatedBudget.allocatedCoins,
        remaining: updatedBudget.availableCoins,
        allocated: updatedBudget.investedCoins,
      },
      wallet: {
        allocatedCoins: updatedBudget.allocatedCoins,
        investedCoins: updatedBudget.investedCoins,
        availableCoins: updatedBudget.availableCoins,
        remaining: updatedBudget.availableCoins,
        allocated: updatedBudget.investedCoins,
        totalBudget: updatedBudget.allocatedCoins,
      },
    });
  } catch (error: any) {
    if (
      error?.message === 'ALREADY_INVESTED' ||
      error?.code === 'P2002' ||
      error?.message?.includes('Unique constraint failed') ||
      error?.message?.includes('Duplicate entry')
    ) {
      return NextResponse.json(
        {
          success: false,
          code: 'ALREADY_INVESTED',
          message: 'You have already invested in this idea.',
        },
        { status: 409 }
      );
    }

    if (error?.message?.startsWith('INSUFFICIENT_COINS')) {
      const remaining = parseInt(error.message.split(':')[1] || '0', 10);
      return NextResponse.json(
        {
          success: false,
          code: 'INSUFFICIENT_COINS',
          message: `You only have ${remaining} coins available.`,
          availableCoins: remaining,
        },
        { status: 400 }
      );
    }

    console.error('Error executing investment transaction:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred processing your investment transaction.',
      },
      { status: 500 }
    );
  }
}