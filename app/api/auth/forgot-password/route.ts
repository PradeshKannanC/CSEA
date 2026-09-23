import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { checkRateLimit, getClientIp, isLoopbackIp } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/auth/email';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.').toLowerCase().trim(),
});

// Standard neutral message for anti-enumeration
const NEUTRAL_SUCCESS_MESSAGE =
  "If an account exists for this email, password reset instructions have been sent.";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // 1. Parse and validate email format FIRST (do not consume rate limits on malformed inputs)
    const body = await req.json().catch(() => ({}));
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid email format.',
        },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const normalizedEmail = normalizeEmail(email);

    // 2. Email-specific Rate Limiting (protects individual accounts from being spammed)
    // Default: 5 requests per 15-minute window per email address
    const emailLimitMax = parseInt(process.env.RATE_LIMIT_FORGOT_PW_EMAIL_MAX || '5', 10);
    const emailKey = `rate-limit:password-reset:email:${normalizedEmail}`;
    const emailLimit = checkRateLimit(emailKey, emailLimitMax, 15 * 60 * 1000);

    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many password reset requests for this email. Please check your inbox or wait a few minutes before trying again.',
          retryAfter: emailLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) },
        }
      );
    }

    // 3. IP Abuse Prevention Rate Limiting
    // Standard IPs: 60 requests per 15 minutes (generous for multi-user campus/NAT gateways)
    // Local / Loopback IPs: 300 requests per 15 minutes (avoids blocking local developers & test suites)
    const isLocal = isLoopbackIp(ip) || process.env.NODE_ENV !== 'production';
    const ipLimitMax = isLocal
      ? 300
      : parseInt(process.env.RATE_LIMIT_FORGOT_PW_IP_MAX || '60', 10);
    const ipKey = `rate-limit:password-reset:ip:${ip}`;
    const ipLimit = checkRateLimit(ipKey, ipLimitMax, 15 * 60 * 1000);

    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many password reset requests from your network. Please wait a few minutes before trying again.',
          retryAfter: ipLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    // 4. Look up account securely in MySQL
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Anti-Enumeration: If user does not exist or is inactive, return neutral success message
    // without revealing whether the account exists
    if (!user || !user.isActive) {
      await prisma.auditLog.create({
        data: {
          action: 'PASSWORD_RESET_FAILED',
          entity: 'USER',
          metadata: {
            reason: 'User not found or inactive',
            recipientDomain: normalizedEmail.split('@')[1] || 'unknown',
            ip,
          },
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: NEUTRAL_SUCCESS_MESSAGE,
      });
    }

    // 5. Generate cryptographically secure random reset token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    // 6. Invalidate previous active unused reset tokens for this account
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    // 7. Store ONLY the HASH of the reset token in MySQL
    const tokenRecord = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        createdAt: now,
      },
    });

    // Determine authoritative base URL (guarantee NO localhost in production emails)
    const originHeader = req.headers.get('origin');
    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const protoHeader = req.headers.get('x-forwarded-proto') || 'https';
    const computedOrigin = originHeader || (hostHeader ? `${protoHeader}://${hostHeader}` : null);

    let configuredUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
    const isProduction = process.env.NODE_ENV === 'production';

    let effectiveBaseUrl = configuredUrl;
    if (isProduction && (!configuredUrl || configuredUrl.includes('localhost'))) {
      if (computedOrigin && !computedOrigin.includes('localhost')) {
        effectiveBaseUrl = computedOrigin;
      }
    } else if (!effectiveBaseUrl && computedOrigin) {
      effectiveBaseUrl = computedOrigin;
    }

    // 8. Actually send the email via Resend
    // CRITICAL: Await real delivery! Do NOT fake success!
    const emailResult = await sendPasswordResetEmail({
      to: user.email,
      rawToken,
      baseUrl: effectiveBaseUrl,
    });

    // If real email delivery failed or email provider is unconfigured:
    if (!emailResult.success) {
      // Clean up the unused token record so it does not linger
      await prisma.passwordResetToken.delete({
        where: { id: tokenRecord.id },
      }).catch(() => {});

      // Record delivery failure in audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_RESET_DELIVERY_FAILED',
          entity: 'USER',
          entityId: user.id,
          metadata: {
            recipientDomain: user.email.split('@')[1] || 'unknown',
            provider: emailResult.provider || 'none',
            error: emailResult.error,
            ip,
          },
        },
      }).catch(() => {});

      console.error('[EMAIL_DELIVERY_FAILURE]', {
        recipientDomain: user.email.split('@')[1] || 'unknown',
        error: emailResult.error,
        missingConfig: emailResult.missingConfig,
      });

      const isDev = process.env.NODE_ENV !== 'production';
      let responseMessage = 'Unable to send password reset email right now. Please try again later.';
      if (isDev) {
        if (emailResult.missingConfig?.includes('RESEND_API_KEY')) {
          responseMessage = 'RESEND_API_KEY is not configured.';
        } else if (emailResult.error) {
          responseMessage = emailResult.error;
        }
      } else {
        responseMessage = 'Unable to send password reset email right now. Please contact your system administrator or try again later.';
      }

      return NextResponse.json(
        {
          success: false,
          code: 'EMAIL_DELIVERY_FAILED',
          message: responseMessage,
          ...(isDev ? { diagnostics: emailResult.error, missingConfig: emailResult.missingConfig } : {}),
        },
        { status: 503 }
      );
    }

    // 9. Record security audit log for accepted dispatch
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'USER',
        entityId: user.id,
        metadata: {
          recipientDomain: user.email.split('@')[1] || 'unknown',
          provider: emailResult.provider,
          messageId: emailResult.messageId,
          ip,
        },
      },
    }).catch(() => {});

    // 10. Return success after actual email provider acceptance
    return NextResponse.json({
      success: true,
      message: NEUTRAL_SUCCESS_MESSAGE,
    });
  } catch (error) {
    console.error('Unhandled error in forgot-password API:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
