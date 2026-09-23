import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/auth/server';
import { getCurrentParticipantContext } from '@/lib/context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    const url = new URL(req.url);
    const requestedEventId = url.searchParams.get('eventId');

    // Find requested event, or the latest event
    let targetEvent = null;
    if (requestedEventId) {
      targetEvent = await prisma.event.findUnique({ where: { id: requestedEventId } });
    }

    if (!targetEvent) {
      targetEvent = await prisma.event.findFirst({
        orderBy: { createdAt: 'desc' },
      });
    }

    const isAdmin = user?.role === 'ADMIN';
    const requestedRoomId = url.searchParams.get('roomId');

    let targetRoomId: string | null = null;
    let userRoomRecord: { id: string; name: string; code: string; status: string } | null = null;

    if (!isAdmin) {
      const context = await getCurrentParticipantContext();
      if (!context) {
        return NextResponse.json(
          {
            success: false,
            code: 'UNAUTHENTICATED',
            message: 'You must be logged in to view tournament results.',
            revealed: false,
            results: [],
          },
          { status: 401 }
        );
      }

      if (context.state === 'TEAM_NOT_ASSIGNED' || !context.team) {
        return NextResponse.json(
          {
            success: false,
            code: 'NO_TEAM_ASSIGNED',
            message: 'You are not assigned to any team.',
            revealed: false,
            results: [],
          },
          { status: 403 }
        );
      }

      // Check if team has historical results in any revealed room
      const teamPastResults = await prisma.result.findMany({
        where: {
          OR: [
            { teamId: context.team.id },
            { teamCode: context.team.teamId },
          ],
          revealedAt: { not: null },
        },
        include: { room: true },
        orderBy: { createdAt: 'desc' },
      });

      const historicalRoomIds = new Set(
        teamPastResults.map((r) => r.roomId).filter((id): id is string => Boolean(id))
      );

      // Determine targetRoomId
      if (requestedRoomId) {
        // Can view if it's current room or a room they historically participated in
        const isCurrentRoom = context.room && context.room.id === requestedRoomId;
        const isHistoricalRoom = historicalRoomIds.has(requestedRoomId);

        if (!isCurrentRoom && !isHistoricalRoom) {
          return NextResponse.json(
            {
              success: false,
              code: 'CROSS_ROOM_RESULTS_FORBIDDEN',
              message: 'You are only authorized to view results for rooms your team participated in.',
              revealed: false,
              results: [],
            },
            { status: 403 }
          );
        }

        // Verify that target room is REVEALED to participants
        const targetRoom = await prisma.room.findUnique({ where: { id: requestedRoomId } });

        if (!targetRoom || !targetRoom.resultsRevealedToParticipants || targetRoom.status !== 'REVEALED') {
          const isUnderReview = targetRoom?.resultsRevealedToAdmins && !targetRoom.resultsRevealedToParticipants;
          return NextResponse.json(
            {
              success: false,
              code: isUnderReview ? 'RESULTS_UNDER_ADMIN_REVIEW' : 'RESULTS_NOT_REVEALED',
              message: isUnderReview
                ? 'Results are being reviewed by administrators. Please wait for the final announcement.'
                : 'Tournament results have not been publicly revealed yet for this room.',
              revealed: false,
              eventStatus: targetEvent?.status || 'DRAFT',
              results: [],
            },
            { status: 403 }
          );
        }

        targetRoomId = requestedRoomId;
        userRoomRecord = targetRoom;
      } else {
        // Default room resolution:
        const currentRoomDb = context.room
          ? await prisma.room.findUnique({ where: { id: context.room.id } })
          : null;

        if (currentRoomDb) {
          if (currentRoomDb.resultsRevealedToParticipants && currentRoomDb.status === 'REVEALED') {
            targetRoomId = currentRoomDb.id;
            userRoomRecord = currentRoomDb;
          } else {
            const isUnderReview = currentRoomDb.resultsRevealedToAdmins && !currentRoomDb.resultsRevealedToParticipants;
            return NextResponse.json(
              {
                success: false,
                code: isUnderReview ? 'RESULTS_UNDER_ADMIN_REVIEW' : 'RESULTS_NOT_REVEALED',
                message: isUnderReview
                  ? 'Results are being reviewed by administrators. Please wait for the final announcement.'
                  : 'Tournament results have not been publicly revealed yet for your room.',
                revealed: false,
                eventStatus: targetEvent?.status || 'DRAFT',
                results: [],
              },
              { status: 403 }
            );
          }
        } else if (teamPastResults.length > 0) {
          // Team has a published historical result in a revealed room
          const mostRecent = teamPastResults[0];
          targetRoomId = mostRecent.roomId;
          userRoomRecord = mostRecent.room || (targetRoomId ? await prisma.room.findUnique({ where: { id: targetRoomId } }) : null);
        } else {
          return NextResponse.json(
            {
              success: false,
              code: 'NO_ROOM_ASSIGNED',
              message: 'Your team is not assigned to any room arena and has no published results.',
              revealed: false,
              results: [],
            },
            { status: 403 }
          );
        }
      }
    } else {
      targetRoomId = requestedRoomId || null;
    }

    const whereClause: any = {};
    if (targetRoomId) {
      whereClause.roomId = targetRoomId;
    } else if (targetEvent?.id) {
      whereClause.OR = [
        { eventId: targetEvent.id },
        { eventId: null },
      ];
    }
    if (!isAdmin) {
      whereClause.revealedAt = { not: null };
    }

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
          },
        },
      },
    });

    const formattedResults = results.map((r) => {
      let members: string[] = [];
      if (Array.isArray(r.members)) {
        members = r.members as string[];
      }

      return {
        id: r.id,
        rank: r.rank,
        roomId: r.roomId,
        roomName: r.room?.name || 'Main Room',
        roomCode: r.room?.code || 'MAIN',
        ideaId: r.ideaId,
        anonymousId: r.anonymousId || r.idea?.anonymousId,
        title: r.ideaTitle || r.idea?.title,
        track: r.track,
        teamName: r.teamName,
        teamCode: r.teamCode || null,
        members,
        totalCoins: r.totalCoins,
        investorCount: r.investorCount,
        trophy: r.trophy || (r.rank === 1 ? 'gold' : r.rank === 2 ? 'silver' : r.rank === 3 ? 'bronze' : 'finalist'),
        revealedAt: r.revealedAt ? r.revealedAt.toISOString() : null,
      };
    });

    // If admin, also group results by room for seamless tabbed inspection
    let roomGroups: any[] = [];
    if (isAdmin) {
      const allRooms = await prisma.room.findMany({
        where: targetEvent?.id ? { OR: [{ eventId: targetEvent.id }, { eventId: null }] } : {},
        orderBy: { name: 'asc' },
      });
      roomGroups = allRooms.map((rm) => ({
        id: rm.id,
        name: rm.name,
        code: rm.code,
        results: formattedResults.filter((r) => r.roomId === rm.id),
      }));
    }

    return NextResponse.json({
      success: true,
      revealed: true,
      eventStatus: targetEvent?.status || (userRoomRecord?.status || 'DRAFT'),
      round: targetEvent?.round ?? 1,
      eventName: targetEvent?.name || 'PITCH AND PROSPER',
      room: userRoomRecord
        ? { id: userRoomRecord.id, name: userRoomRecord.name, code: userRoomRecord.code }
        : user?.roomId
        ? { id: user.roomId, name: user.roomName, code: user.roomCode }
        : null,
      results: formattedResults,
      roomGroups: isAdmin ? roomGroups : undefined,
    });
  } catch (error) {
    console.error('Error fetching public tournament results:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to retrieve results.',
      },
      { status: 500 }
    );
  }
}
