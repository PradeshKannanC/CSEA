import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

const updateNotificationSchema = z.object({
  notificationId: z.string().optional(),
  markAllAsRead: z.boolean().optional(),
});

/**
 * GET /api/notifications
 * Retrieves notifications for the authenticated user, scoped to their user ID.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if ('status' in auth) return auth;

    const { user } = auth;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientUserId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({
        where: {
          recipientUserId: user.id,
          isRead: false,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        relatedEntityId: n.relatedEntityId,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve notifications.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Marks a specific notification or all notifications as read for the authenticated user.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('status' in auth) return auth;

    const { user } = auth;
    const body = await req.json();
    const parsed = updateNotificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid payload.' },
        { status: 400 }
      );
    }

    const { notificationId, markAllAsRead } = parsed.data;

    if (markAllAsRead) {
      await prisma.notification.updateMany({
        where: {
          recipientUserId: user.id,
          isRead: false,
        },
        data: { isRead: true },
      });

      // Synchronize other open tabs of this user via SSE
      realtimeHub.broadcastToUser(user.id, 'NOTIFICATION_READ', {
        markAllAsRead: true,
      });

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read.',
      });
    }

    if (notificationId) {
      const existing = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          recipientUserId: user.id,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, message: 'Notification not found.' },
          { status: 404 }
        );
      }

      const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });

      // Synchronize other open tabs of this user via SSE
      realtimeHub.broadcastToUser(user.id, 'NOTIFICATION_READ', {
        notificationId: updated.id,
      });

      return NextResponse.json({
        success: true,
        message: 'Notification marked as read.',
        notification: {
          id: updated.id,
          isRead: updated.isRead,
        },
      });
    }

    return NextResponse.json(
      { success: false, message: 'Must specify notificationId or markAllAsRead.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update notification status.' },
      { status: 500 }
    );
  }
}
