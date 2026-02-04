/**
 * Idempotency key management for state-changing operations
 *
 * Prevents duplicate transactions when:
 * - Users double-click buttons
 * - Network issues cause retries
 * - Browser refreshes during submission
 */

// In-memory store for idempotency keys (would use Redis in production)
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

/**
 * Check if an operation with this key has already been processed
 * @param key Unique idempotency key (typically: userId + action + timestamp/nonce)
 * @returns Whether this is a duplicate and the cached result if so
 */
export function checkIdempotency<T>(key: string): IdempotencyResult<T> {
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
 * @param key Unique idempotency key
 * @param result The result to cache
 */
export function storeIdempotencyResult(key: string, result: unknown): void {
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
  const check = checkIdempotency<T>(key)
  if (check.isDuplicate && check.result !== undefined) {
    return check.result
  }

  // Execute operation
  const result = await operation()

  // Store result for future duplicate checks
  storeIdempotencyResult(key, result)

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
  const check = checkIdempotency<T>(key)
  if (check.isDuplicate && check.result !== undefined) {
    return { success: false, error: 'Duplicate request', cached: check.result }
  }

  // Try to acquire lock
  if (!markInProgress(key)) {
    return { success: false, error: 'Operation already in progress' }
  }

  try {
    const result = await operation()
    storeIdempotencyResult(key, result)
    return { success: true, result }
  } finally {
    clearInProgress(key)
  }
}
