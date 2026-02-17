/**
 * Rate limiting utilities for API endpoints (NextRequest-based)
 *
 * Uses shared rate-limit-core for Redis/in-memory logic.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRateLimiter, checkWithRedisOrFallback, extractClientIP, type RateLimitResult } from './rate-limit-core'

export interface RateLimitConfig {
  limit: number
  windowSeconds: number
  prefix?: string
}

// Default configurations for different endpoint types
export const RATE_LIMITS = {
  api: { limit: 60, windowSeconds: 60, prefix: 'api' },
  auth: { limit: 10, windowSeconds: 60, prefix: 'auth' },
  upload: { limit: 10, windowSeconds: 300, prefix: 'upload' },
  verify: { limit: 30, windowSeconds: 60, prefix: 'verify' },
  feed: { limit: 120, windowSeconds: 60, prefix: 'feed' },
} as const

// Create Upstash rate limiters for different endpoint types
const rateLimiters: Record<string, ReturnType<typeof createRateLimiter>> = {
  api: createRateLimiter(60, '60 s', 'api'),
  auth: createRateLimiter(10, '60 s', 'auth'),
  upload: createRateLimiter(10, '300 s', 'upload'),
  verify: createRateLimiter(30, '60 s', 'verify'),
  feed: createRateLimiter(120, '60 s', 'feed'),
}

/**
 * Get client identifier from NextRequest
 */
function getClientId(request: NextRequest): string {
  return extractClientIP({
    cfConnectingIp: request.headers.get('cf-connecting-ip'),
    realIp: request.headers.get('x-real-ip'),
    forwardedFor: request.headers.get('x-forwarded-for'),
  })
}

/**
 * Check rate limit and return result
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.api
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const clientId = getClientId(request)
  const key = `${config.prefix || 'default'}:${clientId}`
  const limiter = config.prefix ? rateLimiters[config.prefix] ?? null : null

  const result = await checkWithRedisOrFallback(limiter, key, config.limit, config.windowSeconds)

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetIn: result.resetInSeconds,
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
    const result = await checkRateLimit(request, config)

    if (!result.allowed) {
      return rateLimitResponse(result.resetIn)
    }

    const response = await handler(request)

    response.headers.set('X-RateLimit-Remaining', String(result.remaining))
    response.headers.set('X-RateLimit-Reset', String(result.resetIn))

    return response
  }
}

// Re-export for convenience
export type { RateLimitResult }
