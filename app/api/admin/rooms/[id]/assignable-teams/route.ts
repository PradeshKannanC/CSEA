import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/rooms/[id]/assignable-teams?search=...
 * Returns a comprehensive directory of teams categorized for the room assignment modal:
 * - Teams assigned to this room (ASSIGNED_THIS_ROOM)
 * - Available / unassigned teams (UNASSIGNED)
 * - Teams currently in other rooms (ASSIGNED_OTHER_ROOM) with movable status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { id: targetRoomId } = await params;

    const targetRoom = await prisma.room.findUnique({
      where: { id: targetRoomId },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
      },
    });

    if (!targetRoom) {
      return NextResponse.json(
        { success: false, code: 'ROOM_NOT_FOUND', message: 'Target room not found.' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';

    const searchFilter = search
      ? {
          OR: [
            { name: { contains: search } },
            { teamId: { contains: search } },
            { submissionId: { contains: search } },
            { leader: { name: { contains: search } } },
            { leader: { email: { contains: search } } },
          ],
        }
      : {};

    const teams = await prisma.team.findMany({
      where: searchFilter,
      include: {
        leader: {
          select: { id: true, name: true, email: true },
        },
        roster: {
          select: { id: true, name: true, email: true, role: true },
        },
        room: {
          select: { id: true, name: true, code: true, status: true },
        },
        idea: {
          select: { id: true, title: true, anonymousId: true, status: true },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const isRoomActive = (status: string) => status === 'OPEN' || status === 'PAUSED';
    const isCurrentRoomLocked = isRoomActive(targetRoom.status);

    const formatted = teams.map((t) => {
      let assignmentStatus: 'ASSIGNED_THIS_ROOM' | 'UNASSIGNED' | 'ASSIGNED_OTHER_ROOM' = 'UNASSIGNED';

      if (t.roomId === targetRoom.id) {
        assignmentStatus = 'ASSIGNED_THIS_ROOM';
      } else if (t.roomId) {
        assignmentStatus = 'ASSIGNED_OTHER_ROOM';
      }

      const isSourceRoomLocked = t.room ? isRoomActive(t.room.status) : false;
      const canMove = !isCurrentRoomLocked && !isSourceRoomLocked;

      let lockReason: string | null = null;
      if (isCurrentRoomLocked) {
        lockReason = `Target room is currently ${targetRoom.status}. Teams cannot be assigned while investment is active.`;
      } else if (isSourceRoomLocked && t.room) {
        lockReason =
          t.room.status === 'OPEN'
            ? `Investment is currently active in ${t.room.name}.`
            : `Investment round is paused in ${t.room.name}. Team assignment remains locked until the round ends.`;
      }

      return {
        id: t.id,
        teamId: t.teamId,
        name: t.name,
        cohort: t.cohort,
        submissionId: t.submissionId,
        memberCount: t.roster.length,
        leader: t.leader
          ? { id: t.leader.id, name: t.leader.name, email: t.leader.email }
          : null,
        members: t.roster.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
        })),
        hasIdea: Boolean(t.idea),
        idea: t.idea
          ? {
              id: t.idea.id,
              title: t.idea.title,
              anonymousId: t.idea.anonymousId,
              status: t.idea.status,
            }
          : null,
        roomId: t.roomId,
        roomName: t.room?.name || null,
        roomCode: t.room?.code || null,
        roomStatus: t.room?.status || null,
        assignmentStatus,
        canMove,
        isSourceRoomLocked,
        lockReason,
      };
    });

    const assignedThisRoom = formatted.filter((t) => t.assignmentStatus === 'ASSIGNED_THIS_ROOM');
    const unassigned = formatted.filter((t) => t.assignmentStatus === 'UNASSIGNED');
    const assignedOther = formatted.filter((t) => t.assignmentStatus === 'ASSIGNED_OTHER_ROOM');

    return NextResponse.json({
      success: true,
      room: {
        id: targetRoom.id,
        name: targetRoom.name,
        code: targetRoom.code,
        status: targetRoom.status,
        isLocked: isCurrentRoomLocked,
      },
      counts: {
        total: formatted.length,
        assignedThisRoom: assignedThisRoom.length,
        unassigned: unassigned.length,
        assignedOther: assignedOther.length,
      },
      teams: formatted,
    });
  } catch (error) {
    console.error('Error fetching assignable teams:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve assignable teams.' },
      { status: 500 }
    );
  }
}
