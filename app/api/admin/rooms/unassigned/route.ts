import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/rooms/unassigned
 * Returns all teams that currently do not have a competition room assigned.
 */
export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const unassignedTeams = await prisma.team.findMany({
      where: { roomId: null },
      include: {
        leader: {
          select: { id: true, name: true, email: true },
        },
        roster: {
          select: { id: true, name: true, email: true, role: true },
        },
        idea: {
          select: { id: true, anonymousId: true, title: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      count: unassignedTeams.length,
      teams: unassignedTeams.map((t) => ({
        id: t.id,
        teamId: t.teamId,
        name: t.name,
        submissionId: t.submissionId,
        cohort: t.cohort,
        leaderName: t.leader?.name || 'Unassigned',
        memberCount: t.roster.length,
        hasIdea: Boolean(t.idea),
        ideaTitle: t.idea?.title || null,
        ideaAnonymousId: t.idea?.anonymousId || null,
      })),
    });
  } catch (error) {
    console.error('Error fetching unassigned teams:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve unassigned teams.' },
      { status: 500 }
    );
  }
}
