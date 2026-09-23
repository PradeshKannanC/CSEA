import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * GET /api/admin/export
 * Authoritative, server-side CSV export endpoint for administrators.
 * Never depends on client-side memory or transient states.
 * Supports:
 * - ?type=ideas
 * - ?type=results
 * - ?type=investments
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const url = new URL(req.url);
    const type = (url.searchParams.get('type') || 'ideas').toLowerCase();
    const roomId = url.searchParams.get('roomId');
    const eventId = url.searchParams.get('eventId');

    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-');

    if (type === 'results') {
      const whereClause: any = {};
      if (roomId) whereClause.roomId = roomId;
      if (eventId) whereClause.eventId = eventId;

      let results = await prisma.result.findMany({
        where: whereClause,
        orderBy: { rank: 'asc' },
        include: {
          room: true,
          idea: { select: { title: true, anonymousId: true } },
        },
      });

      // If no persisted results exist yet for this room, calculate them dynamically from approved ideas
      if (results.length === 0 && roomId) {
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          include: {
            teams: {
              include: {
                roster: true,
                idea: {
                  include: { investments: true },
                },
              },
            },
          },
        });

        if (room) {
          const approvedTeamIdeas = room.teams
            .filter((t) => t.idea && t.idea.status === 'APPROVED')
            .map((t) => {
              const idea = t.idea!;
              const totalCoins = idea.investments.reduce((sum, inv) => sum + inv.amount, 0);
              const investorCount = new Set(idea.investments.map((inv) => inv.investorId)).size;
              return {
                idea,
                team: t,
                totalCoins,
                investorCount,
                createdAt: idea.createdAt.getTime(),
              };
            });

          approvedTeamIdeas.sort((a, b) => {
            if (b.totalCoins !== a.totalCoins) return b.totalCoins - a.totalCoins;
            if (b.investorCount !== a.investorCount) return b.investorCount - a.investorCount;
            return a.createdAt - b.createdAt;
          });

          results = approvedTeamIdeas.map((item, idx) => ({
            id: `calc-${item.idea.id}`,
            eventId: room.eventId,
            roomId: room.id,
            teamId: item.team.id,
            teamCode: item.team.teamId,
            teamName: item.team.name,
            ideaId: item.idea.id,
            ideaTitle: item.idea.title,
            anonymousId: item.idea.anonymousId,
            rank: idx + 1,
            totalCoins: item.totalCoins,
            investorCount: item.investorCount,
            members: item.team.roster.map((m) => m.name),
            track: item.idea.track,
            trophy: idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'finalist',
            revealedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            room,
            idea: { title: item.idea.title, anonymousId: item.idea.anonymousId },
          })) as any;
        }
      }

      const headers = [
        'Rank',
        'Trophy',
        'Team Name',
        'Team Code',
        'Idea Anonymous ID',
        'Idea Title',
        'Track',
        'Room Name',
        'Room Code',
        'Total Coins',
        'Investors Count',
        'Team Members',
      ];

      const rows = results.map((r) => {
        let membersStr = '';
        if (Array.isArray(r.members)) {
          membersStr = (r.members as string[]).join('; ');
        }
        return [
          r.rank,
          escapeCSV(r.trophy?.toUpperCase() || (r.rank === 1 ? 'GOLD' : r.rank === 2 ? 'SILVER' : r.rank === 3 ? 'BRONZE' : 'FINALIST')),
          escapeCSV(r.teamName),
          escapeCSV(r.teamCode || ''),
          escapeCSV(r.anonymousId || r.idea?.anonymousId || ''),
          escapeCSV(r.ideaTitle || r.idea?.title || ''),
          escapeCSV(r.track || ''),
          escapeCSV(r.room?.name || 'Main Room'),
          escapeCSV(r.room?.code || 'MAIN'),
          r.totalCoins,
          r.investorCount,
          escapeCSV(membersStr),
        ].join(',');
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const filename = `pitch_and_prosper_results_${timestampStr}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    if (type === 'investments') {
      const whereClause: any = {};
      if (roomId) whereClause.roomId = roomId;
      if (eventId) whereClause.eventId = eventId;

      const investments = await prisma.investment.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          investor: { select: { id: true, name: true, email: true } },
          idea: { select: { id: true, title: true, anonymousId: true, track: true } },
          room: { select: { id: true, name: true, code: true } },
        },
      });

      const headers = [
        'Investment ID',
        'Investor Name',
        'Investor Email',
        'Idea Anonymous ID',
        'Idea Title',
        'Track',
        'Room Name',
        'Amount (Coins)',
        'Timestamp',
      ];

      const rows = investments.map((inv) => [
        escapeCSV(inv.id),
        escapeCSV(inv.investor?.name || 'Anonymous'),
        escapeCSV(inv.investor?.email || ''),
        escapeCSV(inv.idea?.anonymousId || ''),
        escapeCSV(inv.idea?.title || ''),
        escapeCSV(inv.idea?.track || ''),
        escapeCSV(inv.room?.name || ''),
        inv.amount,
        escapeCSV(inv.createdAt.toISOString()),
      ].join(','));

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const filename = `pitch_and_prosper_investments_${timestampStr}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // Default: Ideas Export
    const whereIdeas: any = {};
    if (roomId) {
      whereIdeas.OR = [
        { roomId },
        { team: { roomId } },
      ];
    }

    const ideas = await prisma.idea.findMany({
      where: whereIdeas,
      orderBy: { createdAt: 'desc' },
      include: {
        room: true,
        team: {
          include: {
            room: true,
            roster: true,
          },
        },
        investments: true,
      },
    });

    const headers = [
      'Idea Anonymous ID',
      'Title',
      'Track',
      'Status',
      'Team Name',
      'Team Code',
      'Room Name',
      'Total Invested Coins',
      'Investors Count',
      'Velocity',
      'Created At',
    ];

    const rows = ideas.map((i) => {
      const totalCoins = i.investments.reduce((sum, inv) => sum + inv.amount, 0);
      const investorCount = new Set(i.investments.map((inv) => inv.investorId)).size;
      return [
        escapeCSV(i.anonymousId),
        escapeCSV(i.title),
        escapeCSV(i.track),
        escapeCSV(i.status),
        escapeCSV(i.team?.name || ''),
        escapeCSV(i.team?.teamId || ''),
        escapeCSV(i.team?.room?.name || i.room?.name || ''),
        totalCoins,
        investorCount,
        escapeCSV(i.velocity),
        escapeCSV(i.createdAt.toISOString()),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const filename = `pitch_and_prosper_ideas_${timestampStr}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error exporting CSV data:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate CSV export.' },
      { status: 500 }
    );
  }
}
