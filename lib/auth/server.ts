import { getSessionIdFromCookies, verifyDatabaseSession } from './session';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/lib/types';
import { NextResponse } from 'next/server';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string | null;
  teamName: string | null;
  roomId: string | null;
  roomName: string | null;
  roomCode: string | null;
  roomStatus: string | null;
  roomMinInvestment?: number | null;
  roomMaxInvestment?: number | null;
  wallet: {
    allocatedCoins: number;
    investedCoins: number;
    availableCoins: number;
    totalBudget: number;
    allocated: number;
    remaining: number;
  };
  budget?: import('@/lib/context').ParticipantContextBudget | null;
}

/**
 * Authoritatively resolves the currently authenticated user from MySQL via Prisma.
 * Never relies on client-provided query parameters, headers, or body attributes.
 */
export async function getServerUser(): Promise<AuthenticatedUser | null> {
  const sessionId = await getSessionIdFromCookies();
  if (!sessionId) return null;

  return getUserFromSessionId(sessionId);
}

import { getCurrentParticipantContext, type ParticipantContext } from '@/lib/context';
export { getCurrentParticipantContext };
export type { ParticipantContext };

/**
 * Resolves user directly by sessionId from MySQL.
 */
export async function getUserFromSessionId(sessionId: string): Promise<AuthenticatedUser | null> {
  const context = await getCurrentParticipantContext(sessionId);
  if (!context) return null;

  return {
    id: context.user.id,
    name: context.user.name,
    email: context.user.email,
    role: context.role as UserRole,
    teamId: context.team?.id || null,
    teamName: context.team?.name || null,
    roomId: context.room?.id || null,
    roomName: context.room?.name || null,
    roomCode: context.room?.code || null,
    roomStatus: context.room?.status || null,
    roomMinInvestment: context.room?.minInvestment ?? null,
    roomMaxInvestment: context.room?.maxInvestment ?? null,
    wallet: context.wallet,
    budget: context.budget,
  };
}

/**
 * Route Handler Guard: Ensures the caller is authenticated.
 */
export async function requireAuth(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        code: 'UNAUTHENTICATED',
        message: 'Authentication required. Please sign in to access this resource.',
      },
      { status: 401 }
    );
  }
  return { user };
}

/**
 * Route Handler Guard: Ensures the caller has one of the specified roles.
 */
export async function requireRole(
  allowedRoles: UserRole[]
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authRes = await requireAuth();
  if ('status' in authRes) return authRes;

  const { user } = authRes;
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      {
        success: false,
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      },
      { status: 403 }
    );
  }

  return { user };
}