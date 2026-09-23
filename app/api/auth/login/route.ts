import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { createDatabaseSession, setSessionCookie } from '@/lib/auth/session';
import { getCurrentParticipantContext } from '@/lib/context';
import { checkRateLimit, clearRateLimit, getClientIp, isLoopbackIp } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/auth/email';

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
  teamId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message || 'Invalid credentials provided.',
        },
        { status: 400 }
      );
    }

    const { email, password, teamId } = result.data;
    const normalizedEmail = normalizeEmail(email);
    const ip = getClientIp(req);
    const isLocal = isLoopbackIp(ip) || process.env.NODE_ENV !== 'production';

    // IP Rate Limit (30 attempts per 15 min for public IPs, 150 for local/test)
    const ipMax = isLocal ? 150 : 30;
    const ipLimit = checkRateLimit(`rate-limit:login:ip:${ip}`, ipMax, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many login attempts from your network. Please wait a few minutes before trying again.',
          retryAfter: ipLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    // Email Rate Limit (10 attempts per 15 min for public IPs, 100 for local/test)
    const emailKey = `rate-limit:login:email:${normalizedEmail}`;
    const emailMax = isLocal ? 100 : 10;
    const emailLimit = checkRateLimit(emailKey, emailMax, 15 * 60 * 1000);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many failed login attempts for this account. Please wait a few minutes before trying again.',
          retryAfter: emailLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) },
        }
      );
    }

    // 1. Look up user by email in MySQL
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { team: true, wallet: true },
    });

    if (!user) {
      // Check if pre-registered in roster
      const rosterMember = await prisma.teamMember.findFirst({
        where: { email: normalizedEmail },
      });
      if (rosterMember) {
        return NextResponse.json(
          {
            success: false,
            code: 'REGISTRATION_REQUIRED',
            message: 'Your account has been pre-registered. Please complete your registration to set your password.',
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Your account has been deactivated. Please contact event administrators.',
        },
        { status: 403 }
      );
    }

    // 2. Check if user is pre-registered but has not established a password
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          code: 'REGISTRATION_REQUIRED',
          message: 'Your account has been pre-registered. Please complete your registration to set your password.',
        },
        { status: 403 }
      );
    }

    // 3. Verify password hash
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      // Record failed login audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_FAILED',
          entity: 'USER',
          entityId: user.id,
          metadata: { reason: 'Incorrect password' },
        },
      }).catch(() => {});

      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
        { status: 401 }
      );
    }

    // Password verified: clear failed attempt tracker for this email
    clearRateLimit(emailKey);

    // 3. If optional teamId provided as verification factor, ensure match
    if (teamId && teamId.trim()) {
      const normalizedEnteredTeam = teamId.trim().toUpperCase();
      const userTeamIdentifier = user.team?.teamId?.toUpperCase() || user.team?.id?.toUpperCase();
      if (!userTeamIdentifier || userTeamIdentifier !== normalizedEnteredTeam) {
        return NextResponse.json(
          {
            success: false,
            code: 'TEAM_MISMATCH',
            message: "Supplied Team ID does not match this account's verified registration.",
          },
          { status: 403 }
        );
      }
    }

    // 4. Create authenticated session in MySQL & HTTP-only cookie
    const sessionId = await createDatabaseSession(user.id);
    await setSessionCookie(sessionId);

    // 5. Record successful login audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entity: 'USER',
        entityId: user.id,
        metadata: { role: user.role },
      },
    }).catch(() => {});

    // 6. Determine destination based on authoritative server role
    let redirectUrl = '/dashboard';
    if (user.role === 'ADMIN') {
      redirectUrl = '/admin';
    } else if (user.role === 'TEAM_LEADER' || user.role === 'TEAM_MEMBER') {
      redirectUrl = '/team';
    }

    let context = null;
    try {
      context = await getCurrentParticipantContext(sessionId);
    } catch (ctxErr) {
      console.warn('Non-fatal context resolution error during login:', ctxErr);
    }

    const defaultWallet = {
      allocatedCoins: 0,
      investedCoins: 0,
      availableCoins: 0,
      totalBudget: 0,
      allocated: 0,
      remaining: 0,
    };

    return NextResponse.json({
      success: true,
      message: `Welcome back, ${user.name}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: context?.team?.teamId || context?.team?.id || user.team?.teamId || user.teamId,
        teamName: context?.team?.name || user.team?.name || null,
        roomId: context?.room?.id || null,
        roomName: context?.room?.name || null,
        roomCode: context?.room?.code || null,
        roomStatus: context?.room?.status || null,
        wallet: context?.wallet || defaultWallet,
        budget: context?.budget || null,
      },
      redirectUrl,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred during authentication.',
      },
      { status: 500 }
    );
  }
}