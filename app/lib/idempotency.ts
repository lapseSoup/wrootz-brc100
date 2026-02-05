/**
 * Idempotency key management for state-changing operations
 *
 * Prevents duplicate transactions when:
 * - Users double-click buttons
 * - Network issues cause retries
 * - Browser refreshes during submission
 *
 * Uses Upstash Redis when available (production), falls back to in-memory (development).
 */

import { Redis } from '@upstash/redis'

// Initialize Redis client if credentials are available
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

// In-memory store for idempotency keys (fallback for development)
const idempotencyStore = new Map<string, {
  result: unknown
  expiresAt: number
}>()

// Clean up expired keys periodically
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute
const KEY_TTL = 24 * 60 * 60 * 1000 // 24 hours

let cleanupTimer: NodeJS.Timeout | null = null

function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    idempotencyStore.forEach((value, key) => {
      if (value.expiresAt < now) {
        idempotencyStore.delete(key)
      }
    })
  }, CLEANUP_INTERVAL)
  // Don't keep process alive just for cleanup
  cleanupTimer.unref()
}

startCleanup()

export interface IdempotencyResult<T> {
  isDuplicate: boolean
  result?: T
}

// Redis key TTL in seconds
const KEY_TTL_SECONDS = 24 * 60 * 60 // 24 hours
const REDIS_PREFIX = 'wrootz:idempotency:'

/**
 * Check if an operation with this key has already been processed
 * Uses Redis when available, falls back to in-memory
 * @param key Unique idempotency key (typically: userId + action + timestamp/nonce)
 * @returns Whether this is a duplicate and the cached result if so
 */
export async function checkIdempotency<T>(key: string): Promise<IdempotencyResult<T>> {
  // Try Redis first
  if (redis) {
    try {
      const existing = await redis.get(`${REDIS_PREFIX}${key}`)
      if (existing) {
        return {
          isDuplicate: true,
          result: existing as T
        }
      }
      return { isDuplicate: false }
    } catch (error) {
      console.error('Redis idempotency check error, falling back to in-memory:', error)
    }
  }

  // Fallback to in-memory
  const existing = idempotencyStore.get(key)
  if (existing && existing.expiresAt > Date.now()) {
    return {
      isDuplicate: true,
      result: existing.result as T
    }
  }

  return { isDuplicate: false }
}

/**
 * Store the result of an operation for idempotency checking
 * Uses Redis when available, falls back to in-memory
 * @param key Unique idempotency key
 * @param result The result to cache
 */
export async function storeIdempotencyResult(key: string, result: unknown): Promise<void> {
  // Try Redis first
  if (redis) {
    try {
      await redis.set(`${REDIS_PREFIX}${key}`, result, { ex: KEY_TTL_SECONDS })
      return
    } catch (error) {
      console.error('Redis idempotency store error, falling back to in-memory:', error)
    }
  }

  // Fallback to in-memory
  idempotencyStore.set(key, {
    result,
    expiresAt: Date.now() + KEY_TTL
  })
}

/**
 * Generate an idempotency key from components
 * @param parts Parts to combine into a key
 */
export function generateIdempotencyKey(...parts: (string | number | undefined)[]): string {
  return parts.filter(Boolean).join(':')
}

/**
 * Execute an operation with idempotency protection
 * @param key Unique idempotency key
 * @param operation The operation to execute
 * @returns The result (either cached or fresh)
 */
export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> {
  // Check for existing result
  const check = await checkIdempotency<T>(key)
  if (check.isDuplicate && check.result !== undefined) {
    return check.result
  }

  // Execute operation
  const result = await operation()

  // Store result for future duplicate checks
  await storeIdempotencyResult(key, result)

  return result
}

/**
 * Mark an idempotency key as in-progress (for long-running operations)
 * This prevents race conditions where two requests start before either completes
 */
const inProgressKeys = new Set<string>()

export function markInProgress(key: string): boolean {
  if (inProgressKeys.has(key)) {
    return false // Already in progress
  }
  inProgressKeys.add(key)
  return true
}

export function clearInProgress(key: string): void {
  inProgressKeys.delete(key)
}

/**
 * Execute an operation with both duplicate detection and in-progress protection
 */
export async function withIdempotencyAndLocking<T>(
  key: string,
  operation: () => Promise<T>
): Promise<{ success: true; result: T } | { success: false; error: string; cached?: T }> {
  // Check for cached result first
  const check = await checkIdempotency<T>(key)
  if (check.isDuplicate && check.result !== undefined) {
    return { success: false, error: 'Duplicate request', cached: check.result }
  }

  // Try to acquire lock
  if (!markInProgress(key)) {
    return { success: false, error: 'Operation already in progress' }
  }

  try {
    const result = await operation()
    await storeIdempotencyResult(key, result)
    return { success: true, result }
  } finally {
    clearInProgress(key)
  }
}
