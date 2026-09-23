import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawToken = searchParams.get('token');

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      return NextResponse.json(
        {
          valid: false,
          reason: 'INVALID',
          message: 'This password reset link is no longer valid or malformed.',
        },
        { status: 400 }
      );
    }

    // 1. Hash the incoming token
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    // 2. Query token record from MySQL
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    // 3. Validation checks
    if (!resetRecord) {
      return NextResponse.json(
        {
          valid: false,
          reason: 'INVALID',
          message: 'This password reset link is no longer valid.',
        },
        { status: 404 }
      );
    }

    if (resetRecord.usedAt !== null) {
      return NextResponse.json(
        {
          valid: false,
          reason: 'ALREADY_USED',
          message: 'This password reset link has already been used or is no longer valid.',
        },
        { status: 410 }
      );
    }

    const now = new Date();
    if (resetRecord.expiresAt < now) {
      return NextResponse.json(
        {
          valid: false,
          reason: 'EXPIRED',
          message: 'This password reset link has expired.',
        },
        { status: 410 }
      );
    }

    if (!resetRecord.user || !resetRecord.user.isActive) {
      return NextResponse.json(
        {
          valid: false,
          reason: 'INVALID_ACCOUNT',
          message: 'The account associated with this reset link is inactive or unavailable.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: resetRecord.user.email,
      name: resetRecord.user.name,
    });
  } catch (error) {
    console.error('Error verifying password reset token:', error);
    return NextResponse.json(
      {
        valid: false,
        reason: 'INTERNAL_ERROR',
        message: 'Unable to verify reset link at this time.',
      },
      { status: 500 }
    );
  }
}
