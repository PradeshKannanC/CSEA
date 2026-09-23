import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const url = new URL(req.url);
    const requestedEventId = url.searchParams.get('eventId');
    const requestedRoomId = url.searchParams.get('roomId');

    // Fetch all event rounds for round switching
    const allEvents = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        round: true,
        status: true,
        createdAt: true,
        revealedAt: true,
      },
    });

    const activeEvent = allEvents[0];
    let selectedEvent = requestedEventId
      ? allEvents.find((e) => e.id === requestedEventId) || activeEvent
      : activeEvent;

    const targetEventId = selectedEvent?.id;
    const eventStatus = selectedEvent?.status || 'DRAFT';
    const isRevealed = eventStatus === 'REVEALED';
    const isAdminRevealed = eventStatus === 'ADMIN_REVEALED';

    const whereClause: any = targetEventId
      ? {
          OR: [
            { eventId: targetEventId },
            ...(allEvents.length <= 1 ? [{ eventId: null }] : []),
          ],
        }
      : {};

    if (requestedRoomId) {
      whereClause.roomId = requestedRoomId;
    }

    // Query official results for the selected event
    const results = await prisma.result.findMany({
      where: whereClause,
      orderBy: { rank: 'asc' },
      include: {
        room: true,
        idea: {
          select: {
            id: true,
            anonymousId: true,
            title: true,
            track: true,
            categoryTag: true,
            totalInvested: true,
            investorCount: true,
            velocity: true,
            team: {
              select: {
                id: true,
                teamId: true,
                name: true,
                roster: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const formattedResults = results.map((r) => {
      let members: string[] = [];
      if (Array.isArray(r.members)) {
        members = r.members as string[];
      } else if (r.idea.team.roster.length > 0) {
        members = r.idea.team.roster.map((m) => m.name);
      }

      return {
        id: r.id,
        rank: r.rank,
        roomId: r.roomId,
        roomName: r.room?.name || 'Main Room',
        roomCode: r.room?.code || 'MAIN',
        ideaId: r.ideaId,
        anonymousId: r.idea.anonymousId,
        title: r.idea.title,
        track: r.track,
        teamId: r.idea.team.teamId,
        teamName: r.teamName,
        members,
        roster: r.idea.team.roster,
        totalCoins: r.totalCoins,
        investorCount: r.investorCount,
        trophy: r.trophy || (r.rank === 1 ? 'gold' : r.rank === 2 ? 'silver' : r.rank === 3 ? 'bronze' : 'finalist'),
        revealedAt: r.revealedAt ? r.revealedAt.toISOString() : null,
      };
    });

    const allRooms = await prisma.room.findMany({
      where: targetEventId ? { OR: [{ eventId: targetEventId }, { eventId: null }] } : {},
      orderBy: { name: 'asc' },
    });

    const roomGroups = allRooms.map((rm) => ({
      id: rm.id,
      name: rm.name,
      code: rm.code,
      results: formattedResults.filter((r) => r.roomId === rm.id),
    }));

    const totalTeams = await prisma.team.count();
    const totalIdeas = await prisma.idea.count();
    const totalCoinsInvested = formattedResults.reduce((sum, r) => sum + r.totalCoins, 0);

    return NextResponse.json({
      success: true,
      eventStatus,
      isRevealed,
      isAdminRevealed,
      selectedEventId: selectedEvent?.id,
      selectedRound: selectedEvent?.round ?? 1,
      selectedEventName: selectedEvent?.name,
      allEvents,
      allRooms: allRooms.map((r) => ({ id: r.id, name: r.name, code: r.code, status: r.status })),
      roomGroups,
      results: formattedResults,
      overview: {
        totalRooms: allRooms.length,
        totalTeams,
        totalIdeas,
        totalCoinsInvested,
      },
    });
  } catch (error) {
    console.error('Error fetching admin results:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to retrieve tournament results.',
      },
      { status: 500 }
    );
  }
}
