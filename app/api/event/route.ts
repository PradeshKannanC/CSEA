import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [user, event] = await Promise.all([
    getServerUser(),
    prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!event) {
    return NextResponse.json(
      { success: false, error: 'No active event configuration' },
      { status: 404 }
    );
  }

  const isAdmin = user?.role === 'ADMIN';
  // Non-admins must only see CLOSED while event is in ADMIN_REVEALED stage
  const projectedStatus = !isAdmin && event.status === 'ADMIN_REVEALED' ? 'CLOSED' : event.status;

  // Authoritative real-time aggregation from MySQL tables
  const [
    totalParticipants,
    activeTeamsCount,
    submittedIdeasCount,
    distributedAggregate,
    investedAggregate,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { not: 'ADMIN' } } }),
    prisma.team.count(),
    prisma.idea.count(),
    prisma.wallet.aggregate({ _sum: { totalCoins: true } }),
    prisma.investment.aggregate({ _sum: { amount: true } }),
  ]);

  const totalDistributedCoins = distributedAggregate._sum.totalCoins || 0;
  const totalInvestedCoins = investedAggregate._sum.amount || 0;

  return NextResponse.json(
    {
      success: true,
      event: {
        id: event.id,
        title: event.name,
        status: projectedStatus,
        minPerIdea: event.minInvestment,
        maxPerIdea: event.maxInvestment,
        totalBudget: event.totalCoins,
        totalDistributedCoins,
        totalInvestedCoins,
        totalParticipants,
        activeTeamsCount,
        submittedIdeasCount,
        investmentStartsAt: event.investmentStartsAt ? event.investmentStartsAt.getTime() : null,
        investmentEndsAt: event.investmentEndsAt ? event.investmentEndsAt.getTime() : null,
        revealedAt: event.revealedAt ? event.revealedAt.getTime() : null,
        targetTeamsCount: event.targetTeamsCount,
        now: Date.now(),
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    }
  );
}