// In-memory sliding window rate limiter — sufficient for single-instance deployment.
// Swap for Redis-backed implementation for multi-instance.

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const win = windows.get(key)

  if (!win || now >= win.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (win.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: win.resetAt }
  }

  win.count++
  return { allowed: true, remaining: limit - win.count, resetAt: win.resetAt }
}

// Cleanup stale windows every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, win] of windows.entries()) {
    if (now >= win.resetAt) windows.delete(key)
  }
}, 5 * 60 * 1000)

export function getRateLimitHeaders(result: RateLimitResult, limit: number): Record<string, string> {
  return {
    'X-RateLimit-Limit':     String(limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset':     String(Math.ceil(result.resetAt / 1000)),
  }
}
