/**
 * Rate limiting for Next.js Server Actions
 *
 * Uses Upstash Redis when available (production), falls back to in-memory (development).
 * Server actions don't have NextRequest, so we use next/headers to get client IP.
 */

import { headers } from 'next/headers'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Initialize Redis client if credentials are available
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

// In-memory fallback store (for development or when Redis unavailable)
const inMemoryStore = new Map<string, { count: number; resetAt: number }>()

// Clean up stale in-memory entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    inMemoryStore.forEach((entry, key) => {
      if (entry.resetAt < now) {
        inMemoryStore.delete(key)
      }
    })
  }, 60000) // Clean every minute
}

// Upstash rate limiters (only created if Redis is available)
const authRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 requests per minute
      prefix: 'wrootz:auth',
    })
  : null

const generalRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '60 s'), // 60 requests per minute
      prefix: 'wrootz:general',
    })
  : null

const strictRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '60 s'), // 5 requests per minute
      prefix: 'wrootz:strict',
    })
  : null

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * Get client IP from request headers
 */
async function getClientIP(): Promise<string> {
  const headersList = await headers()
  return (
    headersList.get('cf-connecting-ip') ||
    headersList.get('x-real-ip') ||
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

/**
 * In-memory rate limiting fallback
 */
function checkInMemoryLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  const entry = inMemoryStore.get(key)

  if (!entry || entry.resetAt < now) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, resetInSeconds: windowSeconds }
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)
  const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000)

  return {
    success: entry.count <= limit,
    remaining,
    resetInSeconds,
  }
}

/**
 * Rate limit for authentication actions (login, register)
 * 10 requests per minute per IP
 */
export async function checkAuthRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP()
  const key = `auth:${ip}`

  if (authRateLimiter) {
    try {
      const result = await authRateLimiter.limit(key)
      return {
        success: result.success,
        remaining: result.remaining,
        resetInSeconds: Math.ceil((result.reset - Date.now()) / 1000),
      }
    } catch (error) {
      console.error('Redis rate limit error, falling back to in-memory:', error)
    }
  }

  // Fallback to in-memory
  return checkInMemoryLimit(key, 10, 60)
}

/**
 * Rate limit for general actions
 * 60 requests per minute per IP
 */
export async function checkGeneralRateLimit(action: string): Promise<RateLimitResult> {
  const ip = await getClientIP()
  const key = `${action}:${ip}`

  if (generalRateLimiter) {
    try {
      const result = await generalRateLimiter.limit(key)
      return {
        success: result.success,
        remaining: result.remaining,
        resetInSeconds: Math.ceil((result.reset - Date.now()) / 1000),
      }
    } catch (error) {
      console.error('Redis rate limit error, falling back to in-memory:', error)
    }
  }

  return checkInMemoryLimit(key, 60, 60)
}

/**
 * Strict rate limit for sensitive operations (financial)
 * 5 requests per minute per IP
 */
export async function checkStrictRateLimit(action: string): Promise<RateLimitResult> {
  const ip = await getClientIP()
  const key = `strict:${action}:${ip}`

  if (strictRateLimiter) {
    try {
      const result = await strictRateLimiter.limit(key)
      return {
        success: result.success,
        remaining: result.remaining,
        resetInSeconds: Math.ceil((result.reset - Date.now()) / 1000),
      }
    } catch (error) {
      console.error('Redis rate limit error, falling back to in-memory:', error)
    }
  }

  return checkInMemoryLimit(key, 5, 60)
}

/**
 * Check if Redis is available for rate limiting
 */
export function isRedisAvailable(): boolean {
  return redis !== null
}
