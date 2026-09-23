import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParticipantContext } from '@/lib/context';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const context = await getCurrentParticipantContext();
    const url = new URL(req.url);
    const filterRoomId = url.searchParams.get('roomId');

    const isAdmin = context?.role === 'ADMIN';

    // 1. Participant room resolution (NEVER trust client-provided roomId)
    let targetRoomId: string | null = null;
    let participantTeamId: string | null = null;
    let participantTeamCode: string | null = null;

    if (!isAdmin) {
      if (!context || !context.room || !context.roomId) {
        const reason = !context ? 'UNAUTHENTICATED' : context.state === 'TEAM_NOT_ASSIGNED' ? 'TEAM_NOT_ASSIGNED' : 'ROOM_NOT_ASSIGNED';
        return NextResponse.json({
          success: true,
          ideas: [],
          room: null,
          isRevealed: false,
          diagnostics: {
            roomTeamsCount: 0,
            roomIdeasCount: 0,
            approvedIdeasCount: 0,
            ownTeamIdeasCount: 0,
            investableIdeasCount: 0,
            emptyReason: 'NO_ROOM',
          },
          message: context?.reason || 'No competition room is currently assigned to your team.',
        });
      }

      targetRoomId = context.roomId;
      participantTeamId = context.team?.id || null;
      participantTeamCode = context.team?.teamId || null;
    } else {
      // Admin may optionally inspect a specific room or view all
      targetRoomId = filterRoomId || context?.roomId || null;
    }

    // 2. Query all teams in the target room
    const roomTeams = targetRoomId
      ? await prisma.team.findMany({
          where: { roomId: targetRoomId },
          select: { id: true, teamId: true },
        })
      : [];
    const roomTeamsCount = roomTeams.length;
    const roomTeamIds = roomTeams.map((t) => t.id);

    // 3. Query all ideas in the target room
    const whereRoomIdeas: any = targetRoomId
      ? {
          OR: [
            { team: { roomId: targetRoomId } },
            { roomId: targetRoomId },
            ...(roomTeamIds.length > 0 ? [{ teamId: { in: roomTeamIds } }] : []),
          ],
        }
      : {};

    const allRoomIdeas = await prisma.idea.findMany({
      where: whereRoomIdeas,
      include: { team: true },
    });
    const roomIdeasCount = allRoomIdeas.length;

    // 4. Filter for APPROVED ideas
    const approvedRoomIdeas = allRoomIdeas.filter((i) => i.status === 'APPROVED');
    const approvedIdeasCount = approvedRoomIdeas.length;

    // 5. Query participant's existing investments in this room to enforce ONE INVESTMENT PER IDEA
    const userInvestments = (!isAdmin && context?.user && targetRoomId)
      ? await prisma.investment.findMany({
          where: {
            investorId: context.user.id,
            roomId: targetRoomId,
          },
          select: { ideaId: true },
        })
      : [];
    const investedIdeaIds = new Set(userInvestments.map((inv) => inv.ideaId));
    const investedIdeasCount = investedIdeaIds.size;

    // Separate participant's own team's approved ideas from investable ideas
    const ownTeamApprovedIdeas = approvedRoomIdeas.filter(
      (i) =>
        (participantTeamId && (i.teamId === participantTeamId || i.team.id === participantTeamId)) ||
        (participantTeamCode && i.team.teamId === participantTeamCode)
    );
    const ownTeamIdeasCount = ownTeamApprovedIdeas.length;

    // Investable ideas for this participant = approved ideas in room MINUS own team's approved ideas MINUS already-invested ideas
    let investableIdeas = approvedRoomIdeas.filter((i) => {
      if (isAdmin) return true;
      if (investedIdeaIds.has(i.id)) {
        return false;
      }
      if (!participantTeamId && !participantTeamCode) return true;
      if (participantTeamId && (i.teamId === participantTeamId || i.team.id === participantTeamId)) {
        return false;
      }
      if (participantTeamCode && i.team.teamId === participantTeamCode) {
        return false;
      }
      return true;
    });

    // 6. Determine machine-readable emptyReason for participants
    let emptyReason: 'NO_ROOM' | 'ROOM_NOT_OPEN' | 'NO_OTHER_TEAMS' | 'NO_IDEAS' | 'AWAITING_APPROVAL' | 'ALL_IDEAS_INVESTED' | 'NO_INVESTABLE_IDEAS' | null = null;
    const roomStatus = context?.room?.status;

    if (!isAdmin && context?.room) {
      if (roomStatus !== 'OPEN') {
        emptyReason = 'ROOM_NOT_OPEN';
      } else if (roomTeamsCount <= 1) {
        emptyReason = 'NO_OTHER_TEAMS';
      } else if (roomIdeasCount === 0) {
        emptyReason = 'NO_IDEAS';
      } else if (approvedIdeasCount === 0) {
        emptyReason = 'AWAITING_APPROVAL';
      } else if (investableIdeas.length === 0) {
        if (investedIdeasCount > 0 && (approvedIdeasCount - ownTeamIdeasCount) <= investedIdeasCount) {
          emptyReason = 'ALL_IDEAS_INVESTED';
        } else {
          emptyReason = 'NO_INVESTABLE_IDEAS';
        }
      }
    }

    const investableIdeasCount = investableIdeas.length;

    // 7. Structured diagnostic logging
    if (context?.user) {
      console.log('[ARENA_CONTEXT]', {
        userId: context.user.id,
        teamId: participantTeamId,
        roomId: targetRoomId,
        roomStatus: roomStatus || 'UNKNOWN',
      });
      console.log('[ARENA_DIAGNOSTICS]', {
        roomTeams: roomTeamsCount,
        roomIdeas: roomIdeasCount,
        approvedIdeas: approvedIdeasCount,
        ownTeamIdeas: ownTeamIdeasCount,
        investedIdeas: investedIdeasCount,
        investableIdeas: investableIdeasCount,
        emptyReason,
      });
    }

    // 8. Order ideas
    const isRoomRevealed = context?.room?.status === 'REVEALED';
    investableIdeas.sort((a, b) => {
      if (isRoomRevealed || isAdmin) {
        return b.totalInvested - a.totalInvested;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // 9. Strict anonymization
    // Before REVEALED, participants MUST NOT receive team name, member names, team ID, email, etc.
    const sanitizedIdeas = investableIdeas.map((idea) => {
      const base = {
        id: idea.id,
        anonymousId: idea.anonymousId,
        title: idea.title,
        track: idea.track,
        categoryTag: idea.categoryTag,
        problem: idea.problemStatement,
        problemStatement: idea.problemStatement,
        solution: idea.solution,
        innovation: idea.innovation,
        impact: idea.impact,
        whyInvest: idea.whyInvest,
        techStack: idea.technology,
        technology: idea.technology,
        status: idea.status,
        isLocked: idea.isLocked,
        isOwnTeam: false,
        roomId: idea.team.roomId || idea.roomId,
        totalInvested: isRoomRevealed || isAdmin ? idea.totalInvested : 0,
        investorCount: isRoomRevealed || isAdmin ? idea.investorCount : 0,
        velocity: isRoomRevealed || isAdmin ? idea.velocity : 'STABLE',
        rank: isRoomRevealed || isAdmin ? idea.rank : null,
      };

      if (isRoomRevealed || isAdmin) {
        return {
          ...base,
          teamId: idea.team.teamId,
          teamName: idea.team.name,
        };
      }

      return base;
    });

    // Resolve room metadata for payload
    const roomMeta = context?.room || (targetRoomId
      ? await prisma.room.findUnique({
          where: { id: targetRoomId },
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            status: true,
            startedAt: true,
            pausedAt: true,
            closedAt: true,
            revealedAt: true,
          },
        })
      : null);

    return NextResponse.json({
      success: true,
      ideas: sanitizedIdeas,
      isRevealed: roomMeta?.status === 'REVEALED',
      room: roomMeta
        ? {
            id: roomMeta.id,
            name: roomMeta.name,
            code: roomMeta.code,
            description: roomMeta.description,
            status: roomMeta.status,
            startedAt: roomMeta.startedAt ? new Date(roomMeta.startedAt).toISOString() : null,
            pausedAt: roomMeta.pausedAt ? new Date(roomMeta.pausedAt).toISOString() : null,
            closedAt: roomMeta.closedAt ? new Date(roomMeta.closedAt).toISOString() : null,
            revealedAt: roomMeta.revealedAt ? new Date(roomMeta.revealedAt).toISOString() : null,
          }
        : null,
      diagnostics: {
        roomTeamsCount,
        roomIdeasCount,
        approvedIdeasCount,
        ownTeamIdeasCount,
        investableIdeasCount,
        emptyReason,
      },
    });
  } catch (error) {
    console.error('Error fetching ideas:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to retrieve ideas.',
      },
      { status: 500 }
    );
  }
}