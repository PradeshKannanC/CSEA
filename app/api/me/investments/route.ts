import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authRes = await requireAuth();
  if ('status' in authRes) return authRes;

  const { user } = authRes;
  const requestedRoomId = req.nextUrl.searchParams.get('roomId');
  const allParam = req.nextUrl.searchParams.get('all');

  const whereClause: any = { investorId: user.id };
  if (requestedRoomId) {
    whereClause.roomId = requestedRoomId;
  } else if (allParam !== 'true' && user.roomId) {
    whereClause.roomId = user.roomId;
  }

  const investments = await prisma.investment.findMany({
    where: whereClause,
    include: {
      idea: {
        select: {
          id: true,
          anonymousId: true,
          title: true,
          track: true,
          categoryTag: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formatted = investments.map((inv) => ({
    id: inv.id,
    userId: inv.investorId,
    ideaId: inv.ideaId,
    roomId: inv.roomId,
    amount: inv.amount,
    timestamp: inv.createdAt.getTime(),
    dateFormatted: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(inv.createdAt),
    idea: inv.idea,
  }));

  return NextResponse.json({
    success: true,
    investments: formatted,
    count: formatted.length,
  });
}