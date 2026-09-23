import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, setSessionCookie } from '@/lib/auth/session';
import { checkRateLimit, getClientIp, isLoopbackIp } from '@/lib/rate-limit';
import { normalizeEmail, getAuthoritativeActiveEvent } from '@/lib/auth/email';
import { UserRole } from '@prisma/client';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Full Name must be at least 2 characters').max(80).trim(),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

/**
 * POST /api/auth/register
 * 
 * Server-authoritative self-registration:
 * 1. Normalizes email strictly via normalizeEmail().
 * 2. Resolves active event authoritatively.
 * 3. Finds pre-registered user in User table or TeamMember roster.
 * 4. Never overwrites an existing non-null passwordHash.
 * 5. Role and Team are taken strictly from the database record (never trusted from client).
 * 6. Hashes password securely and activates the account.
 * 7. Creates an authenticated session and sets HTTP-only cookie.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = registerSchema.safeParse(body);

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

    const { name, email, password } = result.data;
    const normalizedEmail = normalizeEmail(email);
    const ip = getClientIp(req);
    const isLocal = isLoopbackIp(ip) || process.env.NODE_ENV !== 'production';

    // IP Rate Limit (30 attempts per 15 min for public IPs, 150 for local/test)
    const ipMax = isLocal ? 150 : 30;
    const ipLimit = checkRateLimit(`rate-limit:register:ip:${ip}`, ipMax, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many registration attempts from your network. Please wait a few minutes before trying again.',
          retryAfter: ipLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    // Authoritative event resolution
    const activeEvent = await getAuthoritativeActiveEvent();

    // 1. Find pre-registered user in User table
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        team: true,
        wallet: true,
      },
    });

    // 2. If not found in User table, search TeamMember roster for pre-registration
    if (!user) {
      const rosterMember = await prisma.teamMember.findFirst({
        where: { email: normalizedEmail },
        include: { team: true },
      });

      if (rosterMember) {
        // Pre-registered by Admin via Team creation or Roster member addition
        const avatarInitials = (rosterMember.name || name)
          .split(' ')
          .map((p) => p[0])
          .join('')
          .substring(0, 2)
          .toUpperCase() || 'TM';

        user = await prisma.$transaction(async (tx) => {
          // Double-check User didn't get created in parallel
          const existingUser = await tx.user.findUnique({
            where: { email: normalizedEmail },
            include: { team: true, wallet: true },
          });
          if (existingUser) return existingUser;

          const created = await tx.user.create({
            data: {
              name: rosterMember.name || name.trim(),
              email: normalizedEmail,
              passwordHash: null,
              role: rosterMember.role,
              isActive: true,
              emailVerified: false,
              avatarInitials,
              teamId: rosterMember.teamId,
              title: rosterMember.role === 'TEAM_LEADER' ? 'Team Leader' : 'Team Member',
            },
            include: {
              team: true,
              wallet: true,
            },
          });

          await tx.teamMember.update({
            where: { id: rosterMember.id },
            data: { userId: created.id },
          });

          if (rosterMember.role === 'TEAM_LEADER' && !rosterMember.team.leaderId) {
            await tx.team.update({
              where: { id: rosterMember.teamId },
              data: { leaderId: created.id },
            });
          }

          return created;
        });
      }
    }

    // 3. If still no pre-registration exists: reject with clear message
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          code: 'NOT_PRE_REGISTERED',
          message: 'Your email is not registered for this event. Please contact the organizer.',
        },
        { status: 400 }
      );
    }

    // Internal diagnostic logging (strictly internal, never exposed to user)
    console.log(`[AUTH_REGISTRATION_AUDIT] Email: ${email} | Normalized: ${normalizedEmail} | Event ID: ${activeEvent?.id} | Matched Pre-Reg User: ${user.id} | Role: ${user.role} | Team ID: ${user.teamId}`);

    // 4. Invariant: Never overwrite an existing non-null passwordHash
    if (user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          code: 'ALREADY_REGISTERED',
          message: 'An account already exists for this email. Please sign in.',
        },
        { status: 409 }
      );
    }

    // 5. Verify the account is allowed to register (not deactivated)
    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          code: 'ACCOUNT_DEACTIVATED',
          message: 'This account has been deactivated. Please contact the organizer.',
        },
        { status: 403 }
      );
    }

    // 6. Verify submitted name matches the pre-registered identity policy
    const normSubmitted = name.trim().toLowerCase();
    const normPreReg = user.name.trim().toLowerCase();
    const isNameMatch =
      normSubmitted === normPreReg ||
      normSubmitted.includes(normPreReg) ||
      normPreReg.includes(normSubmitted) ||
      normSubmitted.split(/\s+/)[0] === normPreReg.split(/\s+/)[0];

    if (!isNameMatch) {
      return NextResponse.json(
        {
          success: false,
          code: 'NAME_MISMATCH',
          message: 'The submitted name does not match the pre-registered name for this email.',
        },
        { status: 400 }
      );
    }

    // 7. Role & Team are taken strictly from the database record (never trusted from client)
    const assignedRole = user.role;
    const assignedTeamId = user.teamId;

    // 8. Hash the password securely
    const passwordHash = hashPassword(password);
    const avatarInitials = name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || user.avatarInitials || 'U';

    // 9. Transactionally update user with passwordHash, emailVerified, and audit log
    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          name: name.trim(),
          passwordHash,
          emailVerified: true,
          isActive: true,
          avatarInitials,
        },
        include: {
          team: true,
          wallet: true,
        },
      });

      // Ensure wallet exists for participants
      if (updated.role !== 'ADMIN' && !updated.wallet) {
        const initialCoins = activeEvent?.totalCoins ?? 500;
        await tx.wallet.create({
          data: {
            userId: updated.id,
            totalCoins: initialCoins,
            availableCoins: initialCoins,
            investedCoins: 0,
          },
        });
      }

      // Link any existing TeamMember roster entry to this user
      if (assignedTeamId) {
        await tx.teamMember.updateMany({
          where: {
            teamId: assignedTeamId,
            email: normalizedEmail,
            userId: null,
          },
          data: {
            userId: updated.id,
            name: updated.name,
          },
        });

        if (assignedRole === 'TEAM_LEADER' && !updated.team?.leaderId) {
          await tx.team.update({
            where: { id: assignedTeamId },
            data: { leaderId: updated.id },
          });
        }
      }

      // Record registration audit log
      await tx.auditLog.create({
        data: {
          userId: updated.id,
          action: 'USER_REGISTRATION_COMPLETED',
          entity: 'USER',
          entityId: updated.id,
          metadata: {
            role: assignedRole,
            teamId: assignedTeamId,
          },
        },
      });

      return updated;
    });

    // 10. Create authenticated session in MySQL & HTTP-only cookie
    const sessionId = await createDatabaseSession(updatedUser.id);
    await setSessionCookie(sessionId);

    // 11. Determine authoritative redirect destination
    let redirectUrl = '/dashboard';
    if (updatedUser.role === 'ADMIN') {
      redirectUrl = '/admin';
    } else if (updatedUser.role === 'TEAM_LEADER' || updatedUser.role === 'TEAM_MEMBER') {
      redirectUrl = '/team';
    }

    return NextResponse.json({
      success: true,
      message: 'Account verified and registered successfully.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        teamId: updatedUser.team?.teamId || updatedUser.teamId || null,
        teamName: updatedUser.team?.name || null,
      },
      redirectUrl,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'REGISTRATION_SERVICE_ERROR',
        message: 'An unexpected error occurred during account registration. Please try again.',
      },
      { status: 500 }
    );
  }
}