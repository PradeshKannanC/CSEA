import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { cookies, headers } from 'next/headers';

export const SESSION_COOKIE_NAME = 'pnp_session';
export const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionData {
  sessionId: string;
  userId: string;
  expiresAt: number;
}

/**
 * Authoritatively determines whether the session cookie should have the Secure flag.
 *
 * Rules:
 * 1. Explicit COOKIE_SECURE override:
 *    - COOKIE_SECURE='true' -> true
 *    - COOKIE_SECURE='false' -> false
 * 2. In incoming request context:
 *    - If host is local loopback ('localhost', '127.0.0.1', '::1', '.local') without explicit HTTPS -> false
 *    - If x-forwarded-proto === 'https' -> true
 *    - If x-forwarded-proto === 'http' on loopback -> false
 * 3. Default fallback:
 *    - If NODE_ENV === 'production' and not on loopback host -> true
 *    - Otherwise -> false
 */
export async function isSecureConnection(): Promise<boolean> {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;

  try {
    const headerList = await headers();
    const host = (headerList.get('host') || '').toLowerCase();
    const forwardedProto = (headerList.get('x-forwarded-proto') || '').toLowerCase();

    const isLoopback =
      host.startsWith('localhost') ||
      host.startsWith('127.0.0.1') ||
      host.startsWith('[::1]') ||
      host.includes('.local');

    // On local machine running http://localhost:3000 or http://127.0.0.1:3000
    if (isLoopback && forwardedProto !== 'https') {
      return false;
    }

    if (forwardedProto === 'https') {
      return true;
    }

    // In production mode on non-local domain
    if (process.env.NODE_ENV === 'production' && !isLoopback) {
      return true;
    }
  } catch {
    // If called outside request context (e.g. background job/script)
  }

  return process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false';
}

/**
 * Creates a new session in MySQL database and returns the session ID.
 */
export async function createDatabaseSession(userId: string): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  return sessionId;
}

/**
 * Verifies a session ID against MySQL.
 * Deletes expired sessions if encountered.
 */
export async function verifyDatabaseSession(sessionId: string): Promise<SessionData | null> {
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) return null;

  const now = new Date();
  if (session.expiresAt < now) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt.getTime(),
  };
}

/**
 * Invalidates and deletes a session.
 */
export async function destroyDatabaseSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}

/**
 * Helper to set session cookie on Next.js response/cookies.
 */
export async function setSessionCookie(sessionId: string) {
  const cookieStore = await cookies();
  const secure = await isSecureConnection();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });
}

/**
 * Helper to delete session cookie on logout.
 */
export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  const current = cookieStore.get(SESSION_COOKIE_NAME);
  if (current?.value) {
    await destroyDatabaseSession(current.value);
  }
  const secure = await isSecureConnection();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Helper to read current session ID from cookies.
 */
export async function getSessionIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}