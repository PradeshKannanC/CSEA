import { NextResponse } from 'next/server';
import { getCurrentParticipantContext } from '@/lib/context';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const context = await getCurrentParticipantContext();

    if (!context) {
      return NextResponse.json(
        {
          success: false,
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Please sign in.',
          context: null,
        },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        context: {
          user: context.user,
          role: context.role,
          team: context.team,
          room: context.room,
          roomId: context.roomId,
          event: context.event,
          eventSettings: context.eventSettings,
          wallet: context.wallet,
          state: context.state,
          reason: context.reason,
          teamsInRoom: context.teamsInRoom,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching participant context:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to resolve participant context.',
        context: null,
      },
      { status: 500 }
    );
  }
}
