import { NextRequest } from 'next/server';
import { getServerUser } from '@/lib/auth/server';
import { realtimeHub, RealtimeEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getServerUser();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connected confirmation
      const initMessage = `data: ${JSON.stringify({
        type: 'CONNECTED',
        payload: {
          authenticated: Boolean(user),
          userId: user?.id || null,
          role: user?.role || 'ANONYMOUS',
          timestamp: Date.now(),
        },
      })}\n\n`;
      controller.enqueue(encoder.encode(initMessage));

      // Event listener with strict authorization filtering
      const onEvent = (event: RealtimeEvent) => {
        // 1. Personal User-Targeted Events (e.g. WALLET_UPDATED)
        if (event.recipientUserId) {
          if (user && event.recipientUserId === user.id) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            } catch {}
          }
          // STOP FURTHER FILTERING: personal user events are never rejected by room or role filters
          return;
        }

        // 2. Role-Targeted Events (e.g. ADMIN_METRICS_UPDATED, confidential admin feeds)
        if (event.recipientRole) {
          if (!user || user.role !== event.recipientRole) {
            return;
          }
        }

        // 3. Team-Targeted Events
        if (event.recipientTeamId) {
          if (!user || user.teamId !== event.recipientTeamId) {
            return;
          }
        }

        // 4. Room-Scoped Events (broadcast to specific room: e.g. ROOM_STATUS_CHANGED, peer announcements)
        const targetRoomId = event.recipientRoomId || event.payload?.roomId;
        if (targetRoomId) {
          // ADMINs can monitor rooms; participants only receive events for their assigned room
          if (!user || (user.role !== 'ADMIN' && targetRoomId !== user.roomId)) {
            return;
          }
        }

        try {
          const sseData = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch {
          // Stream might be closed
        }
      };

      realtimeHub.on('realtime_event', onEvent);

      // Heartbeat every 15s
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      // Cleanup on abort
      req.signal.addEventListener('abort', () => {
        realtimeHub.off('realtime_event', onEvent);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}