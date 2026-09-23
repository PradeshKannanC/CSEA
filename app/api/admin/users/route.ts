import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { normalizeEmail } from '@/lib/auth/email';

const createUserSchema = z
  .object({
    name: z.string().min(2, 'Full Name must be at least 2 characters').max(80),
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    role: z.enum(['ADMIN', 'TEAM_LEADER', 'TEAM_MEMBER', 'INVESTOR']).default('INVESTOR'),
    teamId: z.string().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.role === 'TEAM_LEADER' || data.role === 'TEAM_MEMBER') {
        return Boolean(data.teamId && data.teamId.trim().length > 0);
      }
      return true;
    },
    {
      message: 'Team selection is required for Team Leaders and Team Members.',
      path: ['teamId'],
    }
  );

const updateUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  isActive: z.boolean().optional(),
  name: z.string().min(2).max(80).optional(),
  title: z.string().max(100).optional(),
});

/**
 * GET /api/admin/users
 * Returns list of all registered users without exposing password hashes.
 */
export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        avatarInitials: true,
        title: true,
        teamId: true,
        team: {
          select: {
            id: true,
            teamId: true,
            name: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      users,
      total: users.length,
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve user directory.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Administrator creates a user account (ADMIN, TEAM_LEADER, TEAM_MEMBER, or INVESTOR).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const body = await req.json();
    const result = createUserSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message || 'Invalid input data.',
        },
        { status: 400 }
      );
    }

    const { name, email, role, teamId, isActive } = result.data;
    const normEmail = normalizeEmail(email);

    // Check if email already exists in users table
    const existing = await prisma.user.findUnique({
      where: { email: normEmail },
    });

    if (existing && existing.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          code: 'CONFLICTING_USER_REGISTRATION',
          message: `An active registered account for "${normEmail}" already exists. Cannot overwrite an established account.`,
        },
        { status: 409 }
      );
    }

    // Team validation for Team Leader and Team Member
    let targetTeam: any = null;
    if (role === 'TEAM_LEADER' || role === 'TEAM_MEMBER') {
      targetTeam = await prisma.team.findFirst({
        where: {
          OR: [{ id: teamId }, { teamId: teamId?.toUpperCase() }],
        },
        include: {
          roster: true,
        },
      });

      if (!targetTeam) {
        return NextResponse.json(
          {
            success: false,
            code: 'TEAM_NOT_FOUND',
            message: 'Selected team could not be found.',
          },
          { status: 400 }
        );
      }

      // Check if email is already in roster of a DIFFERENT team
      const otherTeamRoster = await prisma.teamMember.findFirst({
        where: {
          email: normEmail,
          teamId: { not: targetTeam.id },
        },
        include: { team: true },
      });

      if (otherTeamRoster) {
        return NextResponse.json(
          {
            success: false,
            code: 'EMAIL_ALREADY_ROSTERED',
            message: `Email "${normEmail}" is already assigned to team "${otherTeamRoster.team.teamId}".`,
          },
          { status: 409 }
        );
      }

      // Check team capacity (max 3 members)
      const isAlreadyOnRoster = targetTeam.roster.some((m: any) => m.email.toLowerCase() === normEmail);
      if (!isAlreadyOnRoster && targetTeam.roster.length >= 3) {
        return NextResponse.json(
          {
            success: false,
            code: 'TEAM_FULL',
            message: `Team "${targetTeam.name}" (${targetTeam.teamId}) already has the maximum 3 members.`,
          },
          { status: 400 }
        );
      }

      // Check single leader rule
      if (role === 'TEAM_LEADER') {
        const hasOtherLeader = targetTeam.leaderId || targetTeam.roster.some((m: any) => m.role === 'TEAM_LEADER' && m.email.toLowerCase() !== normEmail);
        if (hasOtherLeader) {
          return NextResponse.json(
            {
              success: false,
              code: 'SECOND_LEADER_REJECTED',
              message: `Team "${targetTeam.name}" already has a designated Team Leader.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const avatarInitials = name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const title =
      role === 'ADMIN'
        ? 'Administrator'
        : role === 'TEAM_LEADER'
        ? 'Team Leader'
        : role === 'TEAM_MEMBER'
        ? 'Team Member'
        : 'Investor / Participant';

    const newUser = await prisma.$transaction(async (tx) => {
      let user = existing;
      if (!user) {
        user = await tx.user.create({
          data: {
            name: name.trim(),
            email: normEmail,
            passwordHash: null,
            role: role as UserRole,
            isActive,
            emailVerified: false,
            avatarInitials,
            title,
            teamId: targetTeam ? targetTeam.id : null,
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: name.trim(),
            role: role as UserRole,
            isActive,
            avatarInitials,
            title,
            teamId: targetTeam ? targetTeam.id : user.teamId,
          },
        });
      }

      // Handle team roster & leader assignment
      if (targetTeam) {
        const existingRosterEntry = await tx.teamMember.findFirst({
          where: { email: normEmail },
        });

        if (existingRosterEntry) {
          await tx.teamMember.update({
            where: { id: existingRosterEntry.id },
            data: {
              teamId: targetTeam.id,
              userId: user.id,
              name: user.name,
              role: role as UserRole,
            },
          });
        } else {
          await tx.teamMember.create({
            data: {
              teamId: targetTeam.id,
              userId: user.id,
              email: normEmail,
              name: user.name,
              role: role as UserRole,
            },
          });
        }

        if (role === 'TEAM_LEADER') {
          await tx.team.update({
            where: { id: targetTeam.id },
            data: { leaderId: user.id },
          });
        }
      }

      // Create wallet if needed
      if (role !== 'ADMIN') {
        const existingWallet = await tx.wallet.findUnique({
          where: { userId: user.id },
        });
        if (!existingWallet) {
          const activeEvent = await tx.event.findFirst({
            orderBy: { createdAt: 'desc' },
          });
          const initialCoins = activeEvent?.totalCoins ?? 500;

          await tx.wallet.create({
            data: {
              userId: user.id,
              totalCoins: initialCoins,
              availableCoins: initialCoins,
              investedCoins: 0,
            },
          });
        }
      }

      // Record audit log
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'USER_PRE_REGISTERED_BY_ADMIN',
          entity: 'USER',
          entityId: user.id,
          metadata: {
            preRegisteredEmail: user.email,
            preRegisteredName: user.name,
            assignedRole: user.role,
            assignedTeamId: targetTeam?.teamId || null,
          },
        },
      });

      return await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
          avatarInitials: true,
          title: true,
          teamId: true,
          team: {
            select: {
              id: true,
              teamId: true,
              name: true,
            },
          },
          createdAt: true,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Account pre-registered. The user can now complete registration with their email.',
        user: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create user account.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users
 * Manages user activation/deactivation.
 * Strictly protects root administrator pradeshkannan64@gmail.com and prevents 0 active admins.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const body = await req.json();
    const result = updateUserSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message || 'Invalid update parameters.',
        },
        { status: 400 }
      );
    }

    const { userId, isActive, name, title } = result.data;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, code: 'USER_NOT_FOUND', message: 'User record not found.' },
        { status: 404 }
      );
    }

    // CRITICAL PROTECTION: Protect Root Administrator pradeshkannan64@gmail.com
    const ROOT_ADMIN_EMAIL = 'pradeshkannan64@gmail.com';
    if (targetUser.email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() && isActive === false) {
      return NextResponse.json(
        {
          success: false,
          code: 'ROOT_ADMIN_PROTECTED',
          message: `The root administrator ${ROOT_ADMIN_EMAIL} is protected and cannot be deactivated.`,
        },
        { status: 403 }
      );
    }

    // CRITICAL PROTECTION: Prevent system from reaching zero active administrators
    if (targetUser.role === 'ADMIN' && isActive === false) {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });

      if (activeAdminCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            code: 'CANNOT_DEACTIVATE_LAST_ADMIN',
            message: 'Cannot deactivate the last active administrator on the platform.',
          },
          { status: 400 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(name ? { name } : {}),
        ...(title ? { title } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        avatarInitials: true,
        title: true,
        updatedAt: true,
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        action: 'USER_STATUS_UPDATED',
        entity: 'USER',
        entityId: updatedUser.id,
        metadata: {
          targetEmail: updatedUser.email,
          isActive: updatedUser.isActive,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Account status for "${updatedUser.name}" updated successfully.`,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update user record.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users
 * Destructive deletion is blocked; administrators must be deactivated instead.
 */
export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      code: 'DELETION_DISABLED',
      message: 'Destructive deletion of user accounts is disabled in production. Please deactivate the account instead.',
    },
    { status: 403 }
  );
}
