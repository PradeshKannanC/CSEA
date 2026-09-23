import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { normalizeEmail } from '@/lib/auth/email';

const addMemberSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required').trim(),
  name: z.string().min(2, 'Member name must be at least 2 characters').max(80),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  role: z.enum(['TEAM_LEADER', 'TEAM_MEMBER']),
});

const updateMemberSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  role: z.enum(['TEAM_LEADER', 'TEAM_MEMBER']).optional(),
  name: z.string().min(2).max(80).optional(),
});

/**
 * POST /api/admin/teams/members
 * Adds and authorizes a single team member to an existing team.
 * Enforces:
 * 1. Maximum 3 members per team (Rejects 4th member).
 * 2. Maximum 1 Team Leader per team (Rejects 2nd leader).
 * 3. Unique email across tournament.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const body = await req.json();
    const result = addMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message || 'Invalid member parameters.',
        },
        { status: 400 }
      );
    }

    const { teamId, name, email, role } = result.data;

    // 1. Locate team by internal ID or teamId (e.g. CSEA-001)
    const team = await prisma.team.findFirst({
      where: {
        OR: [{ id: teamId }, { teamId: teamId.toUpperCase() }],
      },
      include: {
        roster: true,
      },
    });

    if (!team) {
      return NextResponse.json(
        {
          success: false,
          code: 'TEAM_NOT_FOUND',
          message: `Team "${teamId}" does not exist in the database.`,
        },
        { status: 404 }
      );
    }

    const normEmail = normalizeEmail(email);

    // 2. Check if email is already in roster for ANY team
    const existingRosterMatch = await prisma.teamMember.findFirst({
      where: { email: normEmail },
      include: { team: true },
    });

    if (existingRosterMatch) {
      return NextResponse.json(
        {
          success: false,
          code: 'EMAIL_ALREADY_ROSTERED',
          message: `Email "${normEmail}" is already authorized on team "${existingRosterMatch.team.teamId}".`,
        },
        { status: 409 }
      );
    }

    // 3. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normEmail },
    });

    if (existingUser) {
      // Never overwrite an existing registered user with passwordHash
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
      // If user shell already assigned to another team
      if (existingUser.teamId && existingUser.teamId !== team.id) {
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

    // 4. Enforce team capacity limit (<= 3 members)
    if (team.roster.length >= 3) {
      return NextResponse.json(
        {
          success: false,
          code: 'TEAM_FULL',
          message: `Team "${team.name}" already has the maximum of 3 verified members. Member 4 was rejected.`,
        },
        { status: 400 }
      );
    }

    // 5. Enforce exactly 1 Team Leader (Reject 2nd Team Leader)
    if (role === 'TEAM_LEADER') {
      const existingLeader = team.roster.find((m) => m.role === 'TEAM_LEADER');
      if (existingLeader) {
        return NextResponse.json(
          {
            success: false,
            code: 'SECOND_LEADER_REJECTED',
            message: `Team "${team.name}" already has a designated Team Leader (${existingLeader.name}). Only 1 Team Leader is permitted.`,
          },
          { status: 400 }
        );
      }
    }

    // 6. Transactionally create/update User shell and Roster member
    const newMember = await prisma.$transaction(async (tx) => {
      let user = existingUser;
      const avatarInitials = name
        .split(' ')
        .map((p: string) => p[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'TM';

      if (!user) {
        user = await tx.user.create({
          data: {
            name: name.trim(),
            email: normEmail,
            passwordHash: null,
            role: role as UserRole,
            isActive: true,
            emailVerified: false,
            avatarInitials,
            teamId: team.id,
            title: role === 'TEAM_LEADER' ? 'Team Leader' : 'Team Member',
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: name.trim(),
            teamId: team.id,
            role: role as UserRole,
            title: role === 'TEAM_LEADER' ? 'Team Leader' : 'Team Member',
          },
        });
      }

      const createdMember = await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: user.id,
          name: name.trim(),
          email: normEmail,
          role: role as UserRole,
        },
      });

      if (role === 'TEAM_LEADER' && !team.leaderId) {
        await tx.team.update({
          where: { id: team.id },
          data: { leaderId: user.id },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'TEAM_MEMBER_AUTHORIZED',
          entity: 'TEAM_MEMBER',
          entityId: createdMember.id,
          metadata: {
            teamId: team.teamId,
            memberName: createdMember.name,
            memberEmail: createdMember.email,
            role: createdMember.role,
            userId: user.id,
          },
        },
      });

      return createdMember;
    });

    return NextResponse.json({
      success: true,
      message: `Member "${newMember.name}" successfully added to team "${team.name}" as ${newMember.role}.`,
      member: newMember,
    });
  } catch (error) {
    console.error('Error adding team member:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to add team member.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/teams/members
 * Updates an authorized team member's role or details.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const body = await req.json();
    const result = updateMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message || 'Invalid parameters.',
        },
        { status: 400 }
      );
    }

    const { memberId, role, name } = result.data;

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { team: { include: { roster: true } } },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, code: 'MEMBER_NOT_FOUND', message: 'Roster member not found.' },
        { status: 404 }
      );
    }

    // If changing role to TEAM_LEADER, ensure team doesn't already have another leader
    if (role === 'TEAM_LEADER' && member.role !== 'TEAM_LEADER') {
      const otherLeader = member.team.roster.find(
        (m) => m.id !== member.id && m.role === 'TEAM_LEADER'
      );
      if (otherLeader) {
        return NextResponse.json(
          {
            success: false,
            code: 'SECOND_LEADER_REJECTED',
            message: `Team "${member.team.name}" already has a Team Leader (${otherLeader.name}). Only 1 Team Leader is permitted.`,
          },
          { status: 400 }
        );
      }
    }

    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        ...(role ? { role: role as UserRole } : {}),
        ...(name ? { name } : {}),
      },
    });

    // Also update User record if user has already registered
    if (member.userId && role) {
      await prisma.user.update({
        where: { id: member.userId },
        data: { role: role as UserRole },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Member "${updatedMember.name}" updated successfully.`,
      member: updatedMember,
    });
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update member.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/teams/members
 * Removes an unregistered member from the roster.
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { success: false, message: 'Member ID is required.' },
        { status: 400 }
      );
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, message: 'Roster member not found.' },
        { status: 404 }
      );
    }

    if (member.user && member.user.passwordHash !== null) {
      return NextResponse.json(
        {
          success: false,
          code: 'MEMBER_ALREADY_REGISTERED',
          message: 'Cannot remove member: account is already registered. Please deactivate user instead.',
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.teamMember.delete({
        where: { id: memberId },
      });
      // If there was an unverified user shell created for this roster member, delete it too
      if (member.userId && member.user && member.user.passwordHash === null) {
        await tx.user.delete({
          where: { id: member.userId },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Member "${member.name}" removed from team roster.`,
    });
  } catch (error) {
    console.error('Error deleting roster member:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete roster member.' },
      { status: 500 }
    );
  }
}
