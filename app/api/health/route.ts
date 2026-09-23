import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Ping MySQL with a quick SELECT 1
    await prisma.$queryRaw`SELECT 1`;

    const realtimeActive = Boolean(realtimeHub);

    return NextResponse.json({
      status: 'ok',
      application: 'operational',
      database: 'connected',
      realtime: realtimeActive ? 'available' : 'degraded',
      redis: realtimeHub.getRedisStatus(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        application: 'operational',
        database: 'disconnected',
        realtime: 'degraded',
        error: 'Database connection check failed',
      },
      { status: 503 }
    );
  }
}