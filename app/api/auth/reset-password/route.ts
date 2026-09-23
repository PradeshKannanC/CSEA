import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { checkRateLimit, getClientIp, isLoopbackIp } from '@/lib/rate-limit';

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required.'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long.')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
      .regex(/[0-9]/, 'Password must contain at least one number.'),
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Rate limiting by IP (max 20 attempts per 15 min for public IPs, 200 for loopback/dev/test)
    const ipThreshold = isLoopbackIp(ip) ? 200 : 20;
    const ipLimit = checkRateLimit(`rate-limit:reset-password:ip:${ip}`, ipThreshold, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many password reset attempts. Please wait a few minutes before trying again.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(ipLimit.retryAfterSeconds),
          },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid password requirements.',
        },
        { status: 400 }
      );
    }

    const { token: rawToken, password } = parsed.data;

    // 2. Hash token to match database
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    // 3. Atomically execute validation and password update in a database transaction
    const result = await prisma.$transaction(async (tx) => {
      const resetRecord = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!resetRecord) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_TOKEN',
          message: 'This password reset link is no longer valid.',
        };
      }

      if (resetRecord.usedAt !== null) {
        return {
          ok: false,
          status: 400,
          code: 'TOKEN_ALREADY_USED',
          message: 'This password reset link has already been used or is no longer valid.',
        };
      }

      const now = new Date();
      if (resetRecord.expiresAt < now) {
        return {
          ok: false,
          status: 400,
          code: 'TOKEN_EXPIRED',
          message: 'This password reset link has expired. Please request a new one.',
        };
      }

      if (!resetRecord.user || !resetRecord.user.isActive) {
        return {
          ok: false,
          status: 403,
          code: 'ACCOUNT_INACTIVE',
          message: 'The associated account is inactive or disabled.',
        };
      }

      // Hash the new password using scrypt with a cryptographically secure random salt
      const newPasswordHash = hashPassword(password);

      // Update ONLY passwordHash on the User record (preserving role, team, etc.)
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      });

      // Mark the reset token as used (Strict Single-Use enforcement)
      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: now },
      });

      // Invalidate all other pending reset tokens for this user
      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetRecord.userId,
          usedAt: null,
        },
        data: { usedAt: now },
      });

      // Session Security: Invalidate all existing sessions for this user in MySQL
      await tx.session.deleteMany({
        where: { userId: resetRecord.userId },
      });

      // Record successful audit event
      await tx.auditLog.create({
        data: {
          userId: resetRecord.userId,
          action: 'PASSWORD_RESET_COMPLETED',
          entity: 'USER',
          entityId: resetRecord.userId,
          metadata: { ip },
        },
      });

      return {
        ok: true,
        userId: resetRecord.userId,
        email: resetRecord.user.email,
        role: resetRecord.user.role,
      };
    });

    if (!result.ok) {
      // Record failed reset attempt
      await prisma.auditLog.create({
        data: {
          action: 'PASSWORD_RESET_FAILED',
          entity: 'USER',
          metadata: { reason: result.message, ip },
        },
      }).catch(() => {});

      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.message,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully. You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('Error during password reset execution:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while resetting your password. Please try again.',
      },
      { status: 500 }
    );
  }
}
