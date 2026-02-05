/**
 * Rate limiting utilities for API endpoints
 *
 * Uses Upstash Redis when available (production), falls back to in-memory (development).
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Initialize Redis client if credentials are available
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

// In-memory store for rate limiting (fallback for development)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  })
}, 60000) // Clean every minute

export interface RateLimitConfig {
  // Maximum requests allowed in the window
  limit: number
  // Time window in seconds
  windowSeconds: number
  // Identifier prefix for different endpoints
  prefix?: string
}

// Default configurations for different endpoint types
export const RATE_LIMITS = {
  // General API endpoints
  api: { limit: 60, windowSeconds: 60, prefix: 'api' },
  // Authentication endpoints (more restrictive)
  auth: { limit: 10, windowSeconds: 60, prefix: 'auth' },
  // File uploads (very restrictive)
  upload: { limit: 10, windowSeconds: 300, prefix: 'upload' },
  // Verification endpoints (allow more since they're read-only)
  verify: { limit: 30, windowSeconds: 60, prefix: 'verify' },
  // Feed/read endpoints
  feed: { limit: 120, windowSeconds: 60, prefix: 'feed' },
} as const

/**
 * Get client identifier from request
 */
function getClientId(request: NextRequest): string {
  // Try to get IP from various headers (for proxied requests)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnecting = request.headers.get('cf-connecting-ip')

  // Use the first available IP
  const ip = cfConnecting || realIp || forwarded?.split(',')[0]?.trim() || 'unknown'

  return ip
}

// Create Upstash rate limiters for different endpoint types
const rateLimiters = redis ? {
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    prefix: 'wrootz:api',
  }),
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'wrootz:auth',
  }),
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '300 s'),
    prefix: 'wrootz:upload',
  }),
  verify: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '60 s'),
    prefix: 'wrootz:verify',
  }),
  feed: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, '60 s'),
    prefix: 'wrootz:feed',
  }),
} : null

/**
 * Check rate limit using in-memory store (fallback)
 */
function checkInMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  let entry = rateLimitStore.get(key)

  // If no entry or expired, create new one
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + windowMs,
    }
    rateLimitStore.set(key, entry)
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetIn: config.windowSeconds,
    }
  }

  // Increment count
  entry.count++

  const remaining = Math.max(0, config.limit - entry.count)
  const resetIn = Math.ceil((entry.resetTime - now) / 1000)

  return {
    allowed: entry.count <= config.limit,
    remaining,
    resetIn,
  }
}

/**
 * Check rate limit and return result
 * Uses Redis when available, falls back to in-memory
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.api
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const clientId = getClientId(request)
  const key = `${config.prefix || 'default'}:${clientId}`

  // Try Redis-based rate limiting first
  if (rateLimiters && config.prefix && config.prefix in rateLimiters) {
    try {
      const limiter = rateLimiters[config.prefix as keyof typeof rateLimiters]
      const result = await limiter.limit(key)
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetIn: Math.ceil((result.reset - Date.now()) / 1000),
      }
    } catch (error) {
      console.error('Redis rate limit error, falling back to in-memory:', error)
    }
  }

  // Fallback to in-memory rate limiting
  return checkInMemoryRateLimit(key, config)
}

/**
 * Create rate limit response with appropriate headers
 */
export function rateLimitResponse(resetIn: number): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests. Please try again later.',
      retryAfter: resetIn
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(resetIn),
        'X-RateLimit-Remaining': '0',
      }
    }
  )
}

/**
 * Middleware helper to apply rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig = RATE_LIMITS.api
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const result = await checkRateLimit(request, config)

    if (!result.allowed) {
      return rateLimitResponse(result.resetIn)
    }

    const response = await handler(request)

    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Remaining', String(result.remaining))
    response.headers.set('X-RateLimit-Reset', String(result.resetIn))

    return response
  }
}
