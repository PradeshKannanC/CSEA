import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const updateSettingsSchema = z
  .object({
    totalCoins: z.number().int().positive('Total coins must be a positive integer').optional(),
    minInvestment: z.number().int().positive('Minimum investment must be a positive integer').optional(),
    maxInvestment: z.number().int().positive('Maximum investment must be a positive integer').optional(),
    totalCoinsPerParticipant: z.number().int().positive('Total coins must be a positive integer').optional(),
    minimumInvestment: z.number().int().positive('Minimum investment must be a positive integer').optional(),
    maximumInvestment: z.number().int().positive('Maximum investment must be a positive integer').optional(),
    targetTeamsCount: z.number().int().positive().optional(),
    investmentStartsAt: z.string().nullable().optional(),
    investmentEndsAt: z.string().nullable().optional(),
    settingsVersion: z.number().int().optional(),
    version: z.number().int().optional(),
  })
  .transform((data) => {
    const totalCoins = data.totalCoins ?? data.totalCoinsPerParticipant;
    const minInvestment = data.minInvestment ?? data.minimumInvestment;
    const maxInvestment = data.maxInvestment ?? data.maximumInvestment;
    return {
      ...data,
      totalCoins,
      minInvestment,
      maxInvestment,
    };
  })
  .refine(
    (data) => {
      if (data.minInvestment !== undefined && data.maxInvestment !== undefined) {
        return data.minInvestment <= data.maxInvestment;
      }
      return true;
    },
    {
      message: 'Minimum investment cannot exceed maximum investment.',
      path: ['minInvestment'],
    }
  )
  .refine(
    (data) => {
      if (data.maxInvestment !== undefined && data.totalCoins !== undefined) {
        return data.maxInvestment <= data.totalCoins;
      }
      return true;
    },
    {
      message: 'Maximum investment cannot exceed total coins per participant.',
      path: ['maxInvestment'],
    }
  );

/**
 * GET /api/admin/event/settings
 * Returns the authoritative event settings from MySQL.
 */
export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const event = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Event configuration not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: {
        id: event.id,
        name: event.name,
        status: event.status,
        totalCoins: event.totalCoins,
        minInvestment: event.minInvestment,
        maxInvestment: event.maxInvestment,
        totalDistributedCoins: event.totalDistributedCoins,
        targetTeamsCount: event.targetTeamsCount,
        settingsVersion: event.version,
        version: event.version,
        investmentStartsAt: event.investmentStartsAt ? event.investmentStartsAt.toISOString() : null,
        investmentEndsAt: event.investmentEndsAt ? event.investmentEndsAt.toISOString() : null,
        revealedAt: event.revealedAt ? event.revealedAt.toISOString() : null,
      },
    });
  } catch (error) {
    console.error('Error fetching event settings:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve event settings.' },
      { status: 500 }
    );
  }
}

/**
 * Core handler for updating event settings via POST or PATCH
 */
async function handleUpdateSettings(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if ('status' in auth) return auth;

    const body = await req.json();
    const result = updateSettingsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message || 'Invalid settings parameters.',
        },
        { status: 400 }
      );
    }

    const {
      totalCoins,
      minInvestment,
      maxInvestment,
      targetTeamsCount,
      investmentStartsAt,
      investmentEndsAt,
    } = result.data;

    let event = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!event) {
      event = await prisma.event.create({
        data: {
          name: 'PITCH AND PROSPER Arena 2024',
          totalCoins: totalCoins ?? 100,
          minInvestment: minInvestment ?? 10,
          maxInvestment: maxInvestment ?? 50,
          targetTeamsCount: targetTeamsCount ?? 50,
          version: 1,
        },
      });
    }

    // Optimistic Concurrency Control (Multi-Admin Synchronization)
    const expectedVersion = result.data.settingsVersion ?? result.data.version;
    if (expectedVersion !== undefined && event.version !== expectedVersion) {
      return NextResponse.json(
        {
          success: false,
          code: 'SETTINGS_VERSION_CONFLICT',
          message: 'Settings were modified by another administrator. Please refresh to view the latest configuration.',
          currentVersion: event.version,
          settingsVersion: event.version,
        },
        { status: 409 }
      );
    }

    // Verify constraints against combined DB and updated values
    const finalTotal = totalCoins ?? event.totalCoins;
    const finalMin = minInvestment ?? event.minInvestment;
    const finalMax = maxInvestment ?? event.maxInvestment;

    if (finalMin > finalMax) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_CAPS',
          message: `Minimum investment (${finalMin}) cannot exceed maximum investment (${finalMax}).`,
        },
        { status: 400 }
      );
    }

    if (finalMax > finalTotal) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_CAPS',
          message: `Maximum investment (${finalMax}) cannot exceed total coins per participant (${finalTotal}).`,
        },
        { status: 400 }
      );
    }

    // Transactionally update Event configuration as FUTURE DEFAULTS only.
    // ACTIVE, PAUSED, CLOSED, and REVEALED rooms remain completely immutable!
    const updatedEvt = await prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: event.id },
        data: {
          ...(totalCoins !== undefined ? { totalCoins } : {}),
          ...(minInvestment !== undefined ? { minInvestment } : {}),
          ...(maxInvestment !== undefined ? { maxInvestment } : {}),
          ...(targetTeamsCount !== undefined ? { targetTeamsCount } : {}),
          ...(investmentStartsAt !== undefined
            ? { investmentStartsAt: investmentStartsAt ? new Date(investmentStartsAt) : null }
            : {}),
          ...(investmentEndsAt !== undefined
            ? { investmentEndsAt: investmentEndsAt ? new Date(investmentEndsAt) : null }
            : {}),
          version: { increment: 1 },
        },
      });

      // Record audit log
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          action: 'EVENT_SETTINGS_UPDATED',
          entity: 'EVENT',
          entityId: updated.id,
          metadata: {
            totalCoins: updated.totalCoins,
            minInvestment: updated.minInvestment,
            maxInvestment: updated.maxInvestment,
            settingsVersion: updated.version,
            updatedBy: auth.user.email,
          },
        },
      });

      return updated;
    });

    // Broadcast EVENT_SETTINGS_UPDATED and DEFAULT_SETTINGS_UPDATED via SSE
    const broadcastPayload = {
      eventId: updatedEvt.id,
      totalCoins: updatedEvt.totalCoins,
      totalCoinsPerParticipant: updatedEvt.totalCoins,
      totalBudget: updatedEvt.totalCoins,
      minimumInvestment: updatedEvt.minInvestment,
      minPerIdea: updatedEvt.minInvestment,
      maximumInvestment: updatedEvt.maxInvestment,
      maxPerIdea: updatedEvt.maxInvestment,
      settingsVersion: updatedEvt.version,
      version: updatedEvt.version,
      investmentStartsAt: updatedEvt.investmentStartsAt ? updatedEvt.investmentStartsAt.getTime() : null,
      investmentEndsAt: updatedEvt.investmentEndsAt ? updatedEvt.investmentEndsAt.getTime() : null,
      eventStatus: updatedEvt.status,
      updatedAt: updatedEvt.updatedAt.toISOString(),
      timestamp: Date.now(),
    };

    realtimeHub.broadcast('EVENT_SETTINGS_UPDATED', broadcastPayload);
    realtimeHub.broadcast('EVENT_CONFIG_UPDATED', broadcastPayload);
    realtimeHub.broadcast('DEFAULT_SETTINGS_UPDATED', broadcastPayload);

    // Broadcast ADMIN_METRICS_UPDATED
    realtimeHub.broadcastToRole('ADMIN', 'ADMIN_METRICS_UPDATED', {
      totalDistributedCoins: updatedEvt.totalDistributedCoins,
      eventId: updatedEvt.id,
      settingsVersion: updatedEvt.version,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Future event default settings updated successfully. Active rooms remain immutable.',
      settings: {
        id: updatedEvt.id,
        totalCoins: updatedEvt.totalCoins,
        minInvestment: updatedEvt.minInvestment,
        maxInvestment: updatedEvt.maxInvestment,
        totalDistributedCoins: updatedEvt.totalDistributedCoins,
        targetTeamsCount: updatedEvt.targetTeamsCount,
        settingsVersion: updatedEvt.version,
        version: updatedEvt.version,
        investmentStartsAt: updatedEvt.investmentStartsAt ? updatedEvt.investmentStartsAt.toISOString() : null,
        investmentEndsAt: updatedEvt.investmentEndsAt ? updatedEvt.investmentEndsAt.toISOString() : null,
      },
    });
  } catch (error) {
    console.error('Error updating event settings:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update event settings.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/event/settings
 */
export async function POST(req: NextRequest) {
  return handleUpdateSettings(req);
}

/**
 * PATCH /api/admin/event/settings
 */
export async function PATCH(req: NextRequest) {
  return handleUpdateSettings(req);
}
