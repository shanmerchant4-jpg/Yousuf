/**
 * Simple in-memory rate limiter for login brute-force protection.
 *
 * Tracks failed attempts per key (IP or email). After MAX_ATTEMPTS failures
 * within WINDOW_MS the key is locked out for LOCKOUT_MS.
 *
 * NOTE: This is per-process. In a multi-instance / serverless deployment
 * replace the Map with a shared store (Redis via ioredis or Upstash).
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15-minute cooldown

interface Entry {
  count: number;
  windowStart: number;
  lockedUntil: number;
}

const store = new Map<string, Entry>();

function now(): number {
  return Date.now();
}

/** Returns true when the key is currently blocked from attempting. */
export function isRateLimited(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  const t = now();
  if (entry.lockedUntil > t) return true;
  // Lock expired — reset so the window starts fresh on next attempt
  if (entry.lockedUntil > 0 && entry.lockedUntil <= t) {
    store.delete(key);
    return false;
  }
  return false;
}

/** Record a failed attempt. Returns true when the limit is now exceeded. */
export function recordFailure(key: string): boolean {
  const t = now();
  let entry = store.get(key);

  if (!entry || t - entry.windowStart > WINDOW_MS) {
    // Start a new window
    entry = { count: 1, windowStart: t, lockedUntil: 0 };
    store.set(key, entry);
    return false;
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = t + LOCKOUT_MS;
    return true;
  }
  return false;
}

/** Clear failures on successful login so a legitimate user isn't penalised. */
export function clearFailures(key: string): void {
  store.delete(key);
}
