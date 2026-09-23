import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const [
      totalUsers,
      totalTeams,
      totalIdeas,
      unresolvedIssues,
      recentAuditLogs,
      event,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.team.count(),
      prisma.idea.count(),
      prisma.ideaIssueReport.findMany({
        where: {
          status: { in: ['OPEN', 'REVIEWED'] },
        },
        include: {
          reportedByUser: {
            select: { id: true, name: true, email: true, role: true },
          },
          idea: {
            select: { id: true, title: true, anonymousId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.event.findFirst({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const eventFilter = event?.id ? { OR: [{ eventId: event.id }, { eventId: null }] } : {};

    const [totalInvestmentsCount, investmentAggregate, allBudgets, eligibleUsers] = await Promise.all([
      prisma.investment.count({ where: eventFilter }),
      prisma.investment.aggregate({
        where: eventFilter,
        _sum: { amount: true },
      }),
      prisma.participantBudget.findMany({}),
      prisma.user.findMany({
        where: {
          role: { in: ['TEAM_MEMBER', 'TEAM_LEADER', 'INVESTOR'] },
          isActive: true,
        },
      }),
    ]);

    const eventBudget = event?.totalCoins ?? 100;
    const totalDistributedCoins = allBudgets.length > 0
      ? allBudgets.reduce((sum, b) => sum + b.allocatedCoins, 0)
      : eligibleUsers.length * eventBudget;

    const totalCoinsInvested = investmentAggregate._sum.amount || 0;
    const totalCoinsRemaining = Math.max(0, totalDistributedCoins - totalCoinsInvested);

    // Calculate per-room metrics
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
                  investments: { where: eventFilter },
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.team.count({ where: { roomId: null } }),
    ]);

    const roomStats = rooms.map((room) => {
      const teamCount = room.teams.length;
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
      const roomDistributed = roomBudgetSum > 0
        ? roomBudgetSum
        : participantCount * (room.initialCoins ?? eventBudget);

      let roomInvested = 0;
      let ideaCount = 0;
      const roomIdeaIds = new Set<string>();

      room.teams.forEach((t) => {
        if (t.idea) {
          ideaCount++;
          roomIdeaIds.add(t.idea.id);
          roomInvested += t.idea.investments.reduce((sum, inv) => sum + inv.amount, 0);
        }
      });
      const roomRemaining = Math.max(0, roomDistributed - roomInvested);

      return {
        id: room.id,
        name: room.name,
        code: room.code,
        status: room.status,
        teamCount,
        participantCount,
        ideaCount,
        totalCoinsDistributed: roomDistributed,
        totalCoinsInvested: roomInvested,
        totalCoinsRemaining: roomRemaining,
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalTeams,
        totalIdeas,
        totalRooms: rooms.length,
        unassignedTeamsCount,
        totalInvestmentsCount,
        totalCoinsInvested,
        totalDistributedCoins,
        totalCoinsRemaining,
        eventStatus: event?.status || 'DRAFT',
        roomStats,
      },
      unresolvedIssues: unresolvedIssues.map((issue) => ({
        id: issue.id,
        issueType: issue.issueType,
        message: issue.message,
        status: issue.status,
        createdAt: issue.createdAt.toISOString(),
        reportedBy: issue.reportedByUser?.name || 'Unknown',
        reportedByEmail: issue.reportedByUser?.email || '',
        ideaTitle: issue.idea?.title || 'Unknown Submission',
        ideaAnonymousId: issue.idea?.anonymousId || '',
      })),
      recentActivity: recentAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString(),
        userName: log.user?.name || 'System Operator',
        userRole: log.user?.role || 'SYSTEM',
      })),
    });
  } catch (error) {
    console.error('Failed to load admin overview:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve administrative overview.' },
      { status: 500 }
    );
  }
}
