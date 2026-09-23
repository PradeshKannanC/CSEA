import { NextRequest } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

declare global {
  // Preserve across hot-reloads in development without leaking
  var __pnpRateLimitStore: Map<string, RateLimitRecord> | undefined;
}

const store: Map<string, RateLimitRecord> =
  globalThis.__pnpRateLimitStore || new Map<string, RateLimitRecord>();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pnpRateLimitStore = store;
}

// Cleanup expired entries periodically to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 2 * 60 * 1000).unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/**
 * Checks whether an IP address is a local/loopback address.
 */
export function isLoopbackIp(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost' ||
    ip.startsWith('127.')
  );
}

/**
 * Sliding-window rate limiter with isolated keying.
 *
 * @param key Unique isolated key (e.g. `rate-limit:password-reset:email:${email}`)
 * @param limit Maximum allowed requests within the time window
 * @param windowMs Window duration in milliseconds (e.g. 15 minutes)
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const record = store.get(key);

  // If no previous record exists or the window has expired, reset counter
  if (!record || record.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: now + windowMs,
      retryAfterSeconds: 0,
    };
  }

  // If already at or exceeded limit, block request
  if (record.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      retryAfterSeconds,
    };
  }

  // Increment counter
  record.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - record.count),
    resetAt: record.resetAt,
    retryAfterSeconds: 0,
  };
}

/**
 * Explicitly clears a specific rate limit key.
 */
export function clearRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Clears rate limit keys matching a specific prefix or pattern.
 */
export function clearRateLimitsForPattern(pattern: string): void {
  for (const key of store.keys()) {
    if (key.includes(pattern)) {
      store.delete(key);
    }
  }
}

/**
 * Clears all rate limits in the in-memory store.
 */
export function resetAllRateLimits(): void {
  store.clear();
}

/**
 * Extracts the real client IP address from Next.js request headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim());
    if (ips[0] && ips[0].length > 0) return ips[0];
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim().length > 0) return realIp.trim();

  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp && cfConnectingIp.trim().length > 0) return cfConnectingIp.trim();

  return '127.0.0.1';
}
