import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { realtimeHub } from '@/lib/realtime';
import {
  generateUniqueTeamId,
  generateUniqueSubmissionId,
  generateUniqueIdeaAnonymousId,
} from '@/lib/code-generator';
import { normalizeEmail } from '@/lib/auth/email';

const memberSchema = z.object({
  name: z.string().min(2, 'Name is required').max(80),
  email: z.string().email('Invalid member email').toLowerCase().trim(),
  role: z.enum(['TEAM_LEADER', 'TEAM_MEMBER']),
});

const createTeamSchema = z.object({
  teamName: z.string().min(2, 'Team name must be at least 2 characters').max(100),
  teamId: z
    .string()
    .min(3, 'Team ID must be at least 3 characters')
    .max(20)
    .trim()
    .toUpperCase()
    .optional(),
  roomId: z.string().optional(),
  members: z.array(memberSchema).max(3, 'A team cannot have more than 3 members').optional().default([]),
});

/**
 * POST /api/admin/teams
 * Admin creates a team in MySQL (with optional initial members, max 3).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const body = await req.json();
    const result = createTeamSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message || 'Invalid team creation parameters.',
        },
        { status: 400 }
      );
    }

    const { teamName, teamId, members, roomId } = result.data;

    // 0. If assigning directly to a room, verify room exists and is not active
    if (roomId) {
      const targetRoom = await prisma.room.findUnique({ where: { id: roomId } });
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
            message: `Room "${targetRoom.name}" is ${targetRoom.status}. Cannot assign teams while investment is active.`,
          },
          { status: 403 }
        );
      }
    }

    // 1. Verify team composition constraints: max 3 members, max 1 leader
    if (members.length > 3) {
      return NextResponse.json(
        {
          success: false,
          code: 'TEAM_FULL',
          message: 'A team cannot have more than 3 members.',
        },
        { status: 400 }
      );
    }

    const leaders = members.filter((m) => m.role === 'TEAM_LEADER');

    if (leaders.length > 1) {
      return NextResponse.json(
        {
          success: false,
          code: 'SECOND_LEADER_REJECTED',
          message:
            'A second Team Leader is not permitted. A team must have at most 1 designated Team Leader.',
        },
        { status: 400 }
      );
    }

    // 2. Verify all member emails are distinct
    const uniqueEmails = new Set(members.map((m) => m.email));
    if (uniqueEmails.size !== members.length) {
      return NextResponse.json(
        {
          success: false,
          code: 'DUPLICATE_EMAILS_IN_ROSTER',
          message: 'All members must have distinct email addresses.',
        },
        { status: 400 }
      );
    }

    // 3. Verify or generate unique Team ID
    let finalTeamId = teamId;
    if (finalTeamId) {
      const existingTeam = await prisma.team.findFirst({
        where: {
          OR: [{ id: finalTeamId }, { teamId: finalTeamId }],
        },
      });

      if (existingTeam) {
        return NextResponse.json(
          {
            success: false,
            code: 'TEAM_ID_EXISTS',
            message: `Team ID "${finalTeamId}" already exists. Please assign a unique Team ID.`,
          },
          { status: 409 }
        );
      }
    } else {
      finalTeamId = await generateUniqueTeamId();
    }

    // 4. Verify no member email is already registered or rostered elsewhere
    for (const m of members) {
      const normEmail = normalizeEmail(m.email);
      const existingRoster = await prisma.teamMember.findFirst({
        where: { email: normEmail },
        include: { team: true },
      });

      if (existingRoster) {
        return NextResponse.json(
          {
            success: false,
            code: 'EMAIL_ALREADY_ROSTERED',
            message: `Email "${normEmail}" is already assigned to team "${existingRoster.team.teamId}".`,
          },
          { status: 409 }
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: normEmail },
      });

      if (existingUser) {
        // Never overwrite an existing non-null passwordHash
        if (existingUser.passwordHash) {
          return NextResponse.json(
            {
              success: false,
              code: 'CONFLICTING_USER_REGISTRATION',
              message: `An active registered account for "${normEmail}" already exists. Cannot overwrite an established account.`,
            },
            { status: 409 }
          );
        }
        // If user already has an established team assignment
        if (existingUser.teamId) {
          return NextResponse.json(
            {
              success: false,
              code: 'EMAIL_ALREADY_ROSTERED',
              message: `Email "${normEmail}" is already assigned to another team.`,
            },
            { status: 409 }
          );
        }
      }
    }

    // 5. Generate collision-safe unique IDs for submission and idea
    const submissionId = await generateUniqueSubmissionId();
    const anonymousId = await generateUniqueIdeaAnonymousId();

    // 6. Transactionally create Team, Pre-registered User Shells, Roster Members, and Idea shell
    const createdTeam = await prisma.$transaction(async (tx) => {
      const t = await tx.team.create({
        data: {
          teamId: finalTeamId,
          name: teamName,
          submissionId,
          cohort: 'Alpha 2024',
          roomId: roomId || null,
        },
      });

      for (const m of members) {
        const normEmail = normalizeEmail(m.email);
        const avatarInitials = m.name
          .split(' ')
          .map((p: string) => p[0])
          .join('')
          .substring(0, 2)
          .toUpperCase() || 'TM';

        let user = await tx.user.findUnique({
          where: { email: normEmail },
        });

        if (!user) {
          // Create pre-registration user shell with passwordHash = null
          user = await tx.user.create({
            data: {
              name: m.name.trim(),
              email: normEmail,
              passwordHash: null,
              role: m.role as UserRole,
              isActive: true,
              emailVerified: false,
              avatarInitials,
              teamId: t.id,
              title: m.role === 'TEAM_LEADER' ? 'Team Leader' : 'Team Member',
            },
          });
        } else if (!user.passwordHash) {
          // Update pre-registration shell only
          user = await tx.user.update({
            where: { id: user.id },
            data: {
              name: m.name.trim(),
              teamId: t.id,
              role: m.role as UserRole,
              title: m.role === 'TEAM_LEADER' ? 'Team Leader' : 'Team Member',
            },
          });
        }

        await tx.teamMember.create({
          data: {
            teamId: t.id,
            userId: user.id,
            email: normEmail,
            name: m.name.trim(),
            role: m.role as UserRole,
          },
        });

        if (m.role === 'TEAM_LEADER' && !t.leaderId) {
          await tx.team.update({
            where: { id: t.id },
            data: { leaderId: user.id },
          });
        }
      }

      // Initial idea shell
      await tx.idea.create({
        data: {
          anonymousId,
          teamId: t.id,
          title: teamName,
          track: 'INNOVATION TRACK',
          categoryTag: 'EMERGING',
          problemStatement: '',
          solution: '',
          innovation: '',
          impact: '',
          whyInvest: '',
          technology: '',
          status: 'DRAFT',
          roomId: roomId || null,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'TEAM_CREATED',
          entity: 'TEAM',
          entityId: t.id,
          metadata: { teamId: finalTeamId, teamName, memberCount: members.length, roomId },
        },
      });

      return t;
    });

    if (roomId) {
      realtimeHub.broadcastToRoom(roomId, 'ROOM_UPDATED', {
        action: 'TEAM_ASSIGNED',
        teamId: createdTeam.id,
        teamName: createdTeam.name,
        roomId,
      });
      realtimeHub.broadcastToRole('ADMIN', 'ROOM_UPDATED', {
        action: 'TEAM_ASSIGNED',
        teamId: createdTeam.id,
        teamName: createdTeam.name,
        roomId,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Team "${teamName}" (${finalTeamId}) created successfully with ${members.length} member(s).`,
      team: {
        id: createdTeam.teamId,
        name: createdTeam.name,
        submissionId: createdTeam.submissionId,
        cohort: createdTeam.cohort,
        members,
      },
    });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to create team record.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/teams
 * Returns list of all teams with their rosters and registration statuses.
 */
export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const teams = await prisma.team.findMany({
      include: {
        roster: {
          include: { user: true },
        },
        idea: true,
        users: true,
        room: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = teams.map((t) => ({
      id: t.teamId || t.id,
      name: t.name,
      submissionId: t.submissionId,
      cohort: t.cohort,
      roomId: t.roomId,
      room: t.room
        ? {
            id: t.room.id,
            name: t.room.name,
            code: t.room.code,
          }
        : null,
      members: t.roster.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        isRegistered: Boolean(m.userId),
      })),
      registeredCount: t.roster.filter((m) => Boolean(m.userId)).length,
      capacity: 3,
      idea: t.idea
        ? {
            id: t.idea.id,
            anonymousId: t.idea.anonymousId,
            title: t.idea.title,
            status: t.idea.status,
            isLocked: t.idea.isLocked,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      teams: formatted,
    });
  } catch (error) {
    console.error('Error fetching admin teams:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch teams list.',
      },
      { status: 500 }
    );
  }
}