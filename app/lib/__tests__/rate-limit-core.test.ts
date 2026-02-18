import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkInMemoryLimit, extractClientIP, checkWithRedisOrFallback, cleanupRateLimitStore } from '../rate-limit-core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setNodeEnv(env: string) {
  vi.stubEnv('NODE_ENV', env)
}

// ---------------------------------------------------------------------------
// checkInMemoryLimit
// ---------------------------------------------------------------------------

describe('checkInMemoryLimit', () => {
  beforeEach(() => {
    // Start each test in development mode so in-memory logic runs
    setNodeEnv('development')
    // Clear the in-memory store between tests
    cleanupRateLimitStore()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
    cleanupRateLimitStore()
  })

  it('returns allowed:true on first call within limit', () => {
    const result = checkInMemoryLimit('test-key', 5, 60)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.resetInSeconds).toBe(60)
  })

  it('decrements remaining on each successive call', () => {
    checkInMemoryLimit('key-decrement', 5, 60)
    const second = checkInMemoryLimit('key-decrement', 5, 60)

    expect(second.allowed).toBe(true)
    expect(second.remaining).toBe(3)
  })

  it('returns allowed:false when limit is exceeded', () => {
    const key = 'key-exceed'
    for (let i = 0; i < 3; i++) {
      checkInMemoryLimit(key, 3, 60)
    }
    // 4th call exceeds the limit of 3
    const result = checkInMemoryLimit(key, 3, 60)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('allows exactly "limit" calls before blocking', () => {
    const key = 'key-exact'
    const limit = 3

    const results = Array.from({ length: limit }, () =>
      checkInMemoryLimit(key, limit, 60)
    )
    const blocked = checkInMemoryLimit(key, limit, 60)

    expect(results.every(r => r.allowed)).toBe(true)
    expect(blocked.allowed).toBe(false)
  })

  it('resets after window expires', () => {
    vi.useFakeTimers()

    const key = 'key-reset'
    // Use up all 3 allowed calls
    for (let i = 0; i < 3; i++) {
      checkInMemoryLimit(key, 3, 10)
    }
    const blocked = checkInMemoryLimit(key, 3, 10)
    expect(blocked.allowed).toBe(false)

    // Advance past the 10-second window
    vi.advanceTimersByTime(11_000)

    // Should now be allowed again (new window)
    const after = checkInMemoryLimit(key, 3, 10)
    expect(after.allowed).toBe(true)
    expect(after.remaining).toBe(2)
  })

  it('tracks separate keys independently', () => {
    const a = checkInMemoryLimit('key-a', 1, 60)
    const b = checkInMemoryLimit('key-b', 5, 60)

    expect(a.allowed).toBe(true)
    expect(b.allowed).toBe(true)
    expect(b.remaining).toBe(4)
  })

  it('returns allowed:false for ALL keys in production (fail-closed)', () => {
    setNodeEnv('production')

    const result = checkInMemoryLimit('any-key', 100, 60)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.resetInSeconds).toBe(60)
  })

  it('does not consume in-memory quota while in production mode', () => {
    setNodeEnv('production')
    // Use the key in production (should be fail-closed)
    checkInMemoryLimit('prod-key', 5, 60)
    checkInMemoryLimit('prod-key', 5, 60)

    // Switch back to development — the store should still be empty for this key
    setNodeEnv('development')
    const result = checkInMemoryLimit('prod-key', 5, 60)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('returns resetInSeconds close to the window for a fresh entry', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    const result = checkInMemoryLimit('fresh-key', 5, 30)

    expect(result.resetInSeconds).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// extractClientIP
// ---------------------------------------------------------------------------

describe('extractClientIP', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns cf-connecting-ip in production', () => {
    setNodeEnv('production')

    const ip = extractClientIP({
      cfConnectingIp: '1.2.3.4',
      realIp: '5.6.7.8',
      forwardedFor: '9.10.11.12',
    })

    expect(ip).toBe('1.2.3.4')
  })

  it('returns "unknown" when cf-connecting-ip is absent in production', () => {
    setNodeEnv('production')

    const ip = extractClientIP({
      cfConnectingIp: null,
      realIp: '5.6.7.8',
      forwardedFor: '9.10.11.12',
    })

    expect(ip).toBe('unknown')
  })

  it('ignores x-forwarded-for and x-real-ip in production (prevent spoofing)', () => {
    setNodeEnv('production')

    const ip = extractClientIP({
      cfConnectingIp: undefined,
      forwardedFor: '1.1.1.1',
    })

    // Must not use forwarded-for in production
    expect(ip).toBe('unknown')
  })

  it('returns cf-connecting-ip in development when present', () => {
    setNodeEnv('development')

    const ip = extractClientIP({
      cfConnectingIp: '1.2.3.4',
      realIp: '5.6.7.8',
    })

    expect(ip).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip in development', () => {
    setNodeEnv('development')

    const ip = extractClientIP({
      cfConnectingIp: null,
      realIp: '5.6.7.8',
      forwardedFor: '9.10.11.12',
    })

    expect(ip).toBe('5.6.7.8')
  })

  it('falls back to x-forwarded-for in development', () => {
    setNodeEnv('development')

    const ip = extractClientIP({
      cfConnectingIp: null,
      realIp: null,
      forwardedFor: '9.10.11.12',
    })

    expect(ip).toBe('9.10.11.12')
  })

  it('truncates x-forwarded-for to first IP when comma-separated', () => {
    setNodeEnv('development')

    const ip = extractClientIP({
      cfConnectingIp: null,
      realIp: null,
      forwardedFor: '10.0.0.1, 10.0.0.2, 10.0.0.3',
    })

    expect(ip).toBe('10.0.0.1')
  })

  it('trims whitespace from the first x-forwarded-for value', () => {
    setNodeEnv('development')

    const ip = extractClientIP({
      cfConnectingIp: null,
      realIp: null,
      forwardedFor: '  192.168.1.1 , 10.0.0.1',
    })

    expect(ip).toBe('192.168.1.1')
  })

  it('returns "unknown" when no headers are present', () => {
    setNodeEnv('development')

    const ip = extractClientIP({})

    expect(ip).toBe('unknown')
  })

  it('returns "unknown" when all header values are null', () => {
    setNodeEnv('development')

    const ip = extractClientIP({
      cfConnectingIp: null,
      realIp: null,
      forwardedFor: null,
    })

    expect(ip).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// checkWithRedisOrFallback
// ---------------------------------------------------------------------------

describe('checkWithRedisOrFallback', () => {
  beforeEach(() => {
    setNodeEnv('development')
    cleanupRateLimitStore()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    cleanupRateLimitStore()
  })

  it('uses in-memory fallback when limiter is null (development)', async () => {
    const result = await checkWithRedisOrFallback(null, 'fallback-key', 5, 60)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.resetInSeconds).toBe(60)
  })

  it('returns allowed:false from in-memory when limit is exceeded', async () => {
    const key = 'fallback-exceed'
    for (let i = 0; i < 2; i++) {
      await checkWithRedisOrFallback(null, key, 2, 60)
    }
    const result = await checkWithRedisOrFallback(null, key, 2, 60)

    expect(result.allowed).toBe(false)
  })

  it('uses Redis limiter when provided', async () => {
    const mockLimiter = {
      limit: vi.fn().mockResolvedValue({
        success: true,
        remaining: 9,
        reset: Date.now() + 30_000,
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkWithRedisOrFallback(mockLimiter as any, 'redis-key', 10, 30)

    expect(mockLimiter.limit).toHaveBeenCalledWith('redis-key')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
  })

  it('returns correct remaining and resetInSeconds from Redis result', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    const resetAt = 20_000 // 20 seconds from now

    const mockLimiter = {
      limit: vi.fn().mockResolvedValue({
        success: false,
        remaining: 0,
        reset: resetAt,
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkWithRedisOrFallback(mockLimiter as any, 'redis-blocked', 5, 30)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.resetInSeconds).toBe(20)

    vi.useRealTimers()
  })

  it('falls back to in-memory when Redis throws', async () => {
    const mockLimiter = {
      limit: vi.fn().mockRejectedValue(new Error('Redis connection lost')),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkWithRedisOrFallback(mockLimiter as any, 'error-fallback-key', 5, 60)

    // In development, in-memory fallback allows the request
    expect(result.allowed).toBe(true)
  })

  it('fail-closes in production when limiter is null', async () => {
    setNodeEnv('production')

    const result = await checkWithRedisOrFallback(null, 'prod-no-redis', 10, 60)

    expect(result.allowed).toBe(false)
  })
})
