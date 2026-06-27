/**
 * Lightweight in-memory sliding-window rate limiter.
 * Works per-process — suitable for Vercel serverless (each function instance
 * has its own memory; for strict cross-instance limiting use Redis/Upstash).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes to avoid memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check and increment the rate limit for a given key.
 * @param key     Unique identifier (e.g. IP address, user ID)
 * @param options limit + windowSec
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSec * 1000;

  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    // New window
    const entry: RateLimitEntry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { success: true, remaining: options.limit - 1, resetAt: entry.resetAt };
  }

  existing.count += 1;

  if (existing.count > options.limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  return {
    success: true,
    remaining: options.limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Get the client IP from a Next.js request.
 * Checks x-forwarded-for (Vercel/proxies) then falls back to "unknown".
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
