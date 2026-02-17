/**
 * Rate limiting for Next.js Server Actions
 *
 * Uses shared rate-limit-core for Redis/in-memory logic.
 * Server actions don't have NextRequest, so we use next/headers to get client IP.
 */

import { headers } from 'next/headers'
import { createRateLimiter, checkWithRedisOrFallback, extractClientIP, type RateLimitResult } from './rate-limit-core'

// Upstash rate limiters
const authRateLimiter = createRateLimiter(10, '60 s', 'auth')
const generalRateLimiter = createRateLimiter(60, '60 s', 'general')
const strictRateLimiter = createRateLimiter(5, '60 s', 'strict')

export interface ServerActionRateLimitResult {
  success: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * Get client IP from request headers
 */
async function getClientIP(): Promise<string> {
  const headersList = await headers()
  return extractClientIP({
    cfConnectingIp: headersList.get('cf-connecting-ip'),
    realIp: headersList.get('x-real-ip'),
    forwardedFor: headersList.get('x-forwarded-for'),
  })
}

function toServerActionResult(result: RateLimitResult): ServerActionRateLimitResult {
  return {
    success: result.allowed,
    remaining: result.remaining,
    resetInSeconds: result.resetInSeconds,
  }
}

/**
 * Rate limit for authentication actions (login, register)
 * 10 requests per minute per IP
 */
export async function checkAuthRateLimit(): Promise<ServerActionRateLimitResult> {
  const ip = await getClientIP()
  const key = `auth:${ip}`
  const result = await checkWithRedisOrFallback(authRateLimiter, key, 10, 60)
  return toServerActionResult(result)
}

/**
 * Rate limit for general actions
 * 60 requests per minute per IP
 */
export async function checkGeneralRateLimit(action: string): Promise<ServerActionRateLimitResult> {
  const ip = await getClientIP()
  const key = `${action}:${ip}`
  const result = await checkWithRedisOrFallback(generalRateLimiter, key, 60, 60)
  return toServerActionResult(result)
}

/**
 * Strict rate limit for sensitive operations (financial)
 * 5 requests per minute per IP
 */
export async function checkStrictRateLimit(action: string): Promise<ServerActionRateLimitResult> {
  const ip = await getClientIP()
  const key = `strict:${action}:${ip}`
  const result = await checkWithRedisOrFallback(strictRateLimiter, key, 5, 60)
  return toServerActionResult(result)
}