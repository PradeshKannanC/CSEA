import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json(
        {
          authenticated: false,
          user: null,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching current session user:', error);
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        message: 'Failed to verify session.',
      },
      { status: 500 }
    );
  }
}
