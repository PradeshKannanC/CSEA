import { NextResponse } from 'next/server';
import { getCurrentParticipantContext } from '@/lib/context';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await getCurrentParticipantContext();
    if (!context || !context.user) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Please sign in.',
        },
        { status: 401 }
      );
    }

    if (!context.team) {
      return NextResponse.json(
        {
          success: false,
          code: 'NO_TEAM_ASSOCIATED',
          message: context.reason || 'Your account is not associated with any team.',
        },
        { status: 404 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: context.team.id },
      include: {
        room: true,
        roster: {
          include: { user: true },
          orderBy: { role: 'asc' },
        },
        idea: true,
      },
    });

    if (!team) {
      return NextResponse.json(
        {
          success: false,
          code: 'TEAM_NOT_FOUND',
          message: 'Team record not found.',
        },
        { status: 404 }
      );
    }

    const isSubmissionLocked = Boolean(
      team.room && ['OPEN', 'PAUSED', 'REVEALED'].includes(team.room.status)
    );

    return NextResponse.json({
      success: true,
      team: {
        id: team.teamId || team.id,
        internalId: team.id,
        name: team.name,
        cohort: team.cohort,
        submissionId: team.submissionId,
        members: team.roster.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
          displayRole: m.role === 'TEAM_LEADER' ? 'EDITOR' : 'VIEWER',
          isRegistered: Boolean(m.userId),
          avatarInitials: m.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2),
        })),
        idea: team.idea
          ? {
              id: team.idea.id,
              anonymousId: team.idea.anonymousId,
              title: team.idea.title,
              status: team.idea.status,
              isLocked: isSubmissionLocked,
              submissionIsLocked: isSubmissionLocked,
            }
          : null,
      },
      room: team.room
        ? {
            id: team.room.id,
            name: team.room.name,
            code: team.room.code,
            description: team.room.description,
            status: team.room.status,
            startedAt: team.room.startedAt ? team.room.startedAt.toISOString() : null,
            pausedAt: team.room.pausedAt ? team.room.pausedAt.toISOString() : null,
            closedAt: team.room.closedAt ? team.room.closedAt.toISOString() : null,
            revealedAt: team.room.revealedAt ? team.room.revealedAt.toISOString() : null,
          }
        : null,
      teamsInRoom: context.teamsInRoom,
    });
  } catch (error) {
    console.error('Error fetching my team:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to retrieve team details.',
      },
      { status: 500 }
    );
  }
}