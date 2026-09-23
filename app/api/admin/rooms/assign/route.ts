import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

const assignSingleSchema = z.object({
  teamId: z.string().min(1, 'teamId is required'),
  roomId: z.string().nullable(),
});

const assignBatchSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  teamIds: z.array(z.string()),
});

const assignPayloadSchema = z.union([assignSingleSchema, assignBatchSchema]);

/**
 * POST /api/admin/rooms/assign
 * Assigns or moves teams between rooms (single or batch).
 * Strictly locked once a room or the tournament transitions out of DRAFT.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const body = await req.json();
    const parsed = assignPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid assignment payload.',
        },
        { status: 400 }
      );
    }

    // Handle BATCH assignment: { roomId, teamIds }
    if ('teamIds' in parsed.data) {
      const { roomId, teamIds } = parsed.data;

      const targetRoom = await prisma.room.findUnique({
        where: { id: roomId },
        include: { teams: true },
      });

      if (!targetRoom) {
        return NextResponse.json(
          { success: false, code: 'ROOM_NOT_FOUND', message: 'Target room not found.' },
          { status: 404 }
        );
      }

      if (targetRoom.status === 'OPEN' || targetRoom.status === 'PAUSED') {
        return NextResponse.json(
          {
            success: false,
            code: 'TEAM_ASSIGNMENT_LOCKED',
            message: `Room "${targetRoom.name}" is ${targetRoom.status}. Room assignments are locked while investment is active.`,
          },
          { status: 403 }
        );
      }

      // Check if any of the teams being moved out or in belong to an active locked room
      const targetTeamIds = new Set(teamIds);

      // Teams to unassign from this room
      const toUnassignIds = targetRoom.teams
        .filter((t) => !targetTeamIds.has(t.id) && !targetTeamIds.has(t.teamId))
        .map((t) => t.id);

      // Teams to assign to this room
      const candidateTeams = await prisma.team.findMany({
        where: {
          OR: [
            { id: { in: teamIds } },
            { teamId: { in: teamIds } },
          ],
        },
        include: { room: true },
      });

      for (const t of candidateTeams) {
        if (t.room && t.room.id !== targetRoom.id && (t.room.status === 'OPEN' || t.room.status === 'PAUSED')) {
          return NextResponse.json(
            {
              success: false,
              code: 'TEAM_ASSIGNMENT_LOCKED',
              message: `Team "${t.name}" is currently in room "${t.room.name}" which is ${t.room.status}. Cannot move teams while investment is active.`,
            },
            { status: 403 }
          );
        }
      }

      const toAssignIds = candidateTeams.map((t) => t.id);

      // Perform updates atomically
      await prisma.$transaction(async (tx) => {
        // Unassign removed teams
        if (toUnassignIds.length > 0) {
          await tx.team.updateMany({
            where: { id: { in: toUnassignIds } },
            data: { roomId: null },
          });
          await tx.idea.updateMany({
            where: { teamId: { in: toUnassignIds } },
            data: { roomId: null, isLocked: false },
          });
          await tx.user.updateMany({
            where: { teamId: { in: toUnassignIds } },
            data: { roomId: null },
          });
        }

        // Assign new teams
        if (toAssignIds.length > 0) {
          await tx.team.updateMany({
            where: { id: { in: toAssignIds } },
            data: { roomId: targetRoom.id },
          });
          await tx.idea.updateMany({
            where: { teamId: { in: toAssignIds } },
            data: {
              roomId: targetRoom.id,
              isLocked: ['OPEN', 'PAUSED', 'REVEALED'].includes(targetRoom.status),
            },
          });
          await tx.user.updateMany({
            where: { teamId: { in: toAssignIds } },
            data: { roomId: targetRoom.id },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: auth.user.id,
            action: 'TEAMS_BATCH_ASSIGNED',
            entity: 'ROOM',
            entityId: targetRoom.id,
            metadata: {
              roomId: targetRoom.id,
              roomName: targetRoom.name,
              assignedTeamIds: toAssignIds,
              unassignedTeamIds: toUnassignIds,
            },
          },
        });
      });

      realtimeHub.broadcast('ROOM_UPDATED', {
        action: 'BATCH_ASSIGNED',
        roomId: targetRoom.id,
        roomName: targetRoom.name,
        assignedCount: toAssignIds.length,
      });

      return NextResponse.json({
        success: true,
        message: `Updated team assignments for "${targetRoom.name}". (${toAssignIds.length} teams assigned)`,
        roomId: targetRoom.id,
        assignedCount: toAssignIds.length,
      });
    }

    // Handle SINGLE team assignment: { teamId, roomId }
    const { teamId, roomId } = parsed.data;

    // Locate target team
    const team = await prisma.team.findFirst({
      where: {
        OR: [{ id: teamId }, { teamId }],
      },
      include: {
        room: true,
      },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, code: 'TEAM_NOT_FOUND', message: 'Team record not found.' },
        { status: 404 }
      );
    }

    // Check if team's existing room is locked
    if (team.room && (team.room.status === 'OPEN' || team.room.status === 'PAUSED')) {
      return NextResponse.json(
        {
          success: false,
          code: 'TEAM_ASSIGNMENT_LOCKED',
          message: `Team "${team.name}" is in room "${team.room.name}" which is ${team.room.status}. Assignments are locked while investment is active.`,
        },
        { status: 403 }
      );
    }

    // If assigning to a room, verify room exists and is not actively running investments
    let targetRoom = null;
    if (roomId) {
      targetRoom = await prisma.room.findUnique({
        where: { id: roomId },
      });

      if (!targetRoom) {
        return NextResponse.json(
          { success: false, code: 'ROOM_NOT_FOUND', message: 'Target competition room not found.' },
          { status: 404 }
        );
      }

      if (targetRoom.status === 'OPEN' || targetRoom.status === 'PAUSED') {
        return NextResponse.json(
          {
            success: false,
            code: 'TEAM_ASSIGNMENT_LOCKED',
            message: `Room "${targetRoom.name}" is ${targetRoom.status}. Cannot assign teams while investment is active.`,
          },
          { status: 403 }
        );
      }
    }

    const newRoomId = targetRoom ? targetRoom.id : null;

    // Perform synchronized update across Team, Idea, and User
    const updatedTeam = await prisma.$transaction(async (tx) => {
      const t = await tx.team.update({
        where: { id: team.id },
        data: { roomId: newRoomId },
        include: { room: true },
      });

      await tx.idea.updateMany({
        where: { teamId: team.id },
        data: { roomId: newRoomId },
      });

      await tx.user.updateMany({
        where: { teamId: team.id },
        data: { roomId: newRoomId },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'TEAM_ROOM_ASSIGNED',
          entity: 'TEAM',
          entityId: team.id,
          metadata: {
            teamName: team.name,
            teamId: team.teamId,
            previousRoomId: team.roomId,
            newRoomId,
            newRoomName: targetRoom ? targetRoom.name : 'Unassigned',
          },
        },
      });

      return t;
    });

    realtimeHub.broadcast('ROOM_UPDATED', {
      action: 'TEAM_ASSIGNED',
      teamId: team.id,
      teamName: team.name,
      roomId: newRoomId,
    });

    return NextResponse.json({
      success: true,
      message: targetRoom
        ? `Team "${team.name}" assigned to "${targetRoom.name}".`
        : `Team "${team.name}" unassigned from room.`,
      team: {
        id: updatedTeam.id,
        teamId: updatedTeam.teamId,
        name: updatedTeam.name,
        roomId: updatedTeam.roomId,
        room: updatedTeam.room
          ? {
              id: updatedTeam.room.id,
              name: updatedTeam.room.name,
              code: updatedTeam.room.code,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error assigning team to room:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to assign team to room.' },
      { status: 500 }
    );
  }
}
