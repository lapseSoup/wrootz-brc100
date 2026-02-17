/**
 * Shared rate limiting core used by both API route and server action rate limiters.
 *
 * Uses Upstash Redis when available (production), falls back to in-memory (development).
 */

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Initialize Redis client if credentials are available
export const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

// Warn if Redis is not configured in production (skip during build phase)
if (!redis && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
  console.warn(
    'WARNING: Redis is not configured for rate limiting in production. ' +
    'Rate limiting will use in-memory storage which does not work across multiple instances. ' +
    'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
  )
}

// In-memory fallback store
const inMemoryStore = new Map<string, { count: number; resetAt: number }>()

// Clean up stale in-memory entries periodically
let cleanupTimer: ReturnType<typeof setInterval> | null = null
if (typeof setInterval !== 'undefined') {
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    inMemoryStore.forEach((entry, key) => {
      if (entry.resetAt < now) {
        inMemoryStore.delete(key)
      }
    })
  }, 60000)
}

export function cleanupRateLimitStore() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
  inMemoryStore.clear()
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * In-memory rate limiting fallback
 *
 * In production, auth and strict tiers fail closed (deny) rather than
 * falling back to in-memory, because in-memory state is not shared
 * across serverless instances and could be trivially bypassed.
 */
export function checkInMemoryLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  // Fail closed for security-critical tiers in production
  if (process.env.NODE_ENV === 'production' && (key.startsWith('auth:') || key.startsWith('strict:'))) {
    return { allowed: false, remaining: 0, resetInSeconds: 60 }
  }

  const now = Date.now()
  const windowMs = windowSeconds * 1000

  const entry = inMemoryStore.get(key)

  if (!entry || entry.resetAt < now) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetInSeconds: windowSeconds }
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)
  const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000)

  return {
    allowed: entry.count <= limit,
    remaining,
    resetInSeconds,
  }
}

/**
 * Check rate limit using an Upstash Ratelimit instance with in-memory fallback
 */
export async function checkWithRedisOrFallback(
  limiter: Ratelimit | null,
  key: string,
  fallbackLimit: number,
  fallbackWindowSeconds: number
): Promise<RateLimitResult> {
  if (limiter) {
    try {
      const result = await limiter.limit(key)
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetInSeconds: Math.ceil((result.reset - Date.now()) / 1000),
      }
    } catch (error) {
      console.error('Redis rate limit error, falling back to in-memory:', error)
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn(`Rate limiter unavailable (Redis not configured) for key: ${key}`)
  }

  return checkInMemoryLimit(key, fallbackLimit, fallbackWindowSeconds)
}

type Duration = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}` | `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`

/**
 * Create an Upstash rate limiter if Redis is available
 */
export function createRateLimiter(limit: number, window: Duration, prefix: string): Ratelimit | null {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `wrootz:${prefix}`,
  })
}

/**
 * Extract client IP from request headers.
 * IMPORTANT: These headers are trusted as-is. In production, ensure the
 * application is behind a trusted reverse proxy (e.g., Cloudflare, Vercel)
 * that sets these headers correctly. Without a trusted proxy, clients can
 * spoof these headers to bypass rate limiting.
 */
export function extractClientIP(headers: {
  cfConnectingIp?: string | null
  realIp?: string | null
  forwardedFor?: string | null
}): string {
  return headers.cfConnectingIp || headers.realIp || headers.forwardedFor?.split(',')[0]?.trim() || 'unknown'
}
