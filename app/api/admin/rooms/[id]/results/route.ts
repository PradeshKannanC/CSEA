import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/rooms/[id]/results
 * Returns room-specific podium, rankings, and coin allocation breakdown.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id } = await params;

    const room = await prisma.room.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        revealedAt: true,
        resultsRevealedToAdmins: true,
        resultsRevealedToParticipants: true,
        adminRevealedAt: true,
        participantRevealedAt: true,
      },
    });

    if (!room) {
      return NextResponse.json(
        { success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
        { status: 404 }
      );
    }

    const results = await prisma.result.findMany({
      where: { roomId: id },
      include: {
        idea: {
          select: {
            id: true,
            anonymousId: true,
            title: true,
            track: true,
            team: {
              select: {
                id: true,
                teamId: true,
                name: true,
                cohort: true,
              },
            },
          },
        },
      },
      orderBy: { rank: 'asc' },
    });

    const podium = results.slice(0, 3).map((r) => ({
      rank: r.rank,
      teamName: r.teamName,
      ideaTitle: r.idea.title,
      anonymousId: r.idea.anonymousId,
      track: r.track,
      totalCoins: r.totalCoins,
      investorCount: r.investorCount,
      trophy: r.trophy,
      members: r.members,
    }));

    const allRankings = results.map((r) => ({
      id: r.id,
      rank: r.rank,
      teamName: r.teamName,
      ideaTitle: r.idea.title,
      anonymousId: r.idea.anonymousId,
      track: r.track,
      totalCoins: r.totalCoins,
      investorCount: r.investorCount,
      trophy: r.trophy,
      members: r.members,
    }));

    return NextResponse.json({
      success: true,
      room,
      isRevealed: room.status === 'REVEALED',
      isRevealedToAdmins: room.resultsRevealedToAdmins,
      isRevealedToParticipants: room.resultsRevealedToParticipants,
      podium,
      results: allRankings,
    });
  } catch (error) {
    console.error('Error fetching room results:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve room results.' },
      { status: 500 }
    );
  }
}
