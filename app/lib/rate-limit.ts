/**
 * Rate limiting utilities for API endpoints
 * Uses in-memory rate limiting for development
 * Can be upgraded to Redis-based (@upstash/ratelimit) for production
 */

import { NextRequest, NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (works for single-instance deployments)
// For multi-instance production, use Redis (@upstash/ratelimit)
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

/**
 * Check rate limit and return result
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.api
): { allowed: boolean; remaining: number; resetIn: number } {
  const clientId = getClientId(request)
  const key = `${config.prefix || 'default'}:${clientId}`
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
    const result = checkRateLimit(request, config)

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
