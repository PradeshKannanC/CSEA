import { prisma } from '@/lib/prisma';

/**
 * Deterministic single email normalization function.
 * Must be used across all registration, login, pre-registration, and password reset flows.
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Authoritative active event resolution mechanism.
 * Single source of truth across Admin pre-registration, public registration, and client status.
 */
export async function getAuthoritativeActiveEvent() {
  const activeEvent = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  return activeEvent;
}
