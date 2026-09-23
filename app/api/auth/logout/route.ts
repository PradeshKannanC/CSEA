import { NextResponse } from 'next/server';
import { deleteSessionCookie } from '@/lib/auth/session';

export async function POST() {
  try {
    await deleteSessionCookie();
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error during logout.',
      },
      { status: 500 }
    );
  }
}
