/**
 * Tests for withIdempotencyAndLocking, checkIdempotency, storeIdempotencyResult,
 * markInProgress, clearInProgress, and withIdempotency from idempotency.ts.
 *
 * Redis is mocked via vi.mock so no real network calls are made.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock rate-limit-core to control the redis export
// ---------------------------------------------------------------------------
let mockRedis: Record<string, unknown> | null = null

vi.mock('../rate-limit-core', () => ({
  get redis() {
    return mockRedis
  },
}))

// Import under test AFTER the mock is in place
import {
  withIdempotencyAndLocking,
  withIdempotency,
  generateIdempotencyKey,
  checkIdempotency,
  storeIdempotencyResult,
  markInProgress,
  clearInProgress,
} from '../idempotency'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRedis(overrides: Partial<{
  get: () => unknown
  set: () => unknown
  del: () => unknown
}> = {}): Record<string, unknown> {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// generateIdempotencyKey (already has its own file, but adding richer cases here)
// ---------------------------------------------------------------------------

describe('generateIdempotencyKey', () => {
  it('returns consistent key for same inputs', () => {
    const a = generateIdempotencyKey('buy', 'user1', 'post42')
    const b = generateIdempotencyKey('buy', 'user1', 'post42')
    expect(a).toBe(b)
  })

  it('returns different keys for different inputs', () => {
    const a = generateIdempotencyKey('buy', 'user1', 'post42')
    const b = generateIdempotencyKey('buy', 'user2', 'post42')
    expect(a).not.toBe(b)
  })

  it('returns different keys when action differs', () => {
    const a = generateIdempotencyKey('buy', 'user1')
    const b = generateIdempotencyKey('sell', 'user1')
    expect(a).not.toBe(b)
  })
})

// ---------------------------------------------------------------------------
// checkIdempotency & storeIdempotencyResult
// ---------------------------------------------------------------------------

describe('checkIdempotency', () => {
  beforeEach(() => {
    mockRedis = null
  })

  it('returns isDuplicate:false when Redis returns null (cache miss)', async () => {
    mockRedis = makeRedis({ get: vi.fn().mockResolvedValue(null) })

    const result = await checkIdempotency('fresh-key')

    expect(result.isDuplicate).toBe(false)
  })

  it('returns isDuplicate:true with cached result when Redis has the key', async () => {
    const cached = { txid: 'abc123', status: 'ok' }
    mockRedis = makeRedis({ get: vi.fn().mockResolvedValue(cached) })

    const result = await checkIdempotency<typeof cached>('cached-key')

    expect(result.isDuplicate).toBe(true)
    expect(result.result).toEqual(cached)
  })

  it('falls back to in-memory when Redis throws on get', async () => {
    mockRedis = makeRedis({
      get: vi.fn().mockRejectedValue(new Error('Redis down')),
    })

    // Should not throw; falls back gracefully
    const result = await checkIdempotency('error-key')
    expect(result.isDuplicate).toBe(false)
  })
})

describe('storeIdempotencyResult', () => {
  beforeEach(() => {
    mockRedis = null
  })

  it('calls Redis set with the correct key prefix and TTL', async () => {
    const mockSet = vi.fn().mockResolvedValue('OK')
    mockRedis = makeRedis({ set: mockSet })

    await storeIdempotencyResult('my-key', { ok: true })

    expect(mockSet).toHaveBeenCalledWith(
      'wrootz:idempotency:my-key',
      { ok: true },
      { ex: 86400 }
    )
  })

  it('falls back to in-memory when Redis set throws', async () => {
    mockRedis = makeRedis({
      set: vi.fn().mockRejectedValue(new Error('write error')),
    })

    // Should not throw
    await expect(storeIdempotencyResult('err-store-key', 'value')).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// markInProgress & clearInProgress
// ---------------------------------------------------------------------------

describe('markInProgress and clearInProgress', () => {
  beforeEach(() => {
    mockRedis = null
  })

  it('acquires lock and returns true when Redis SET NX succeeds', async () => {
    mockRedis = makeRedis({ set: vi.fn().mockResolvedValue('OK') })

    const acquired = await markInProgress('lock-key')
    expect(acquired).toBe(true)
  })

  it('returns false when Redis SET NX returns null (key already exists)', async () => {
    mockRedis = makeRedis({ set: vi.fn().mockResolvedValue(null) })

    const acquired = await markInProgress('already-locked')
    expect(acquired).toBe(false)
  })

  it('falls back to in-memory when Redis throws on markInProgress', async () => {
    mockRedis = makeRedis({
      set: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    })

    // Should fall back gracefully and use the in-memory set
    const acquired = await markInProgress('fallback-lock')
    expect(typeof acquired).toBe('boolean')
  })

  it('releases lock via Redis del on clearInProgress', async () => {
    const mockDel = vi.fn().mockResolvedValue(1)
    mockRedis = makeRedis({ del: mockDel })

    await clearInProgress('release-key')

    expect(mockDel).toHaveBeenCalledWith('wrootz:idempotency:inprogress:release-key')
  })

  it('prevents duplicate in-memory lock acquisition', async () => {
    mockRedis = null // in-memory path

    const key = 'inmem-lock-key'
    const first = await markInProgress(key)
    const second = await markInProgress(key)
    expect(first).toBe(true)
    expect(second).toBe(false)

    // Clean up so it doesn't bleed into other tests
    await clearInProgress(key)
  })

  it('allows re-acquisition after clearInProgress', async () => {
    mockRedis = null

    const key = 'reacquire-key'
    await markInProgress(key)
    await clearInProgress(key)

    const reacquired = await markInProgress(key)
    expect(reacquired).toBe(true)

    await clearInProgress(key)
  })
})

// ---------------------------------------------------------------------------
// withIdempotency
// ---------------------------------------------------------------------------

describe('withIdempotency', () => {
  beforeEach(() => {
    mockRedis = null
  })

  it('executes operation and returns result on first call', async () => {
    mockRedis = makeRedis()

    const op = vi.fn().mockResolvedValue({ value: 42 })
    const result = await withIdempotency('wi-first', op)

    expect(op).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ value: 42 })
  })

  it('returns cached result without re-executing on duplicate call', async () => {
    const cached = { value: 99 }
    const mockGet = vi.fn().mockResolvedValue(cached)
    const mockSet = vi.fn().mockResolvedValue('OK')
    mockRedis = makeRedis({ get: mockGet, set: mockSet })

    const op = vi.fn().mockResolvedValue({ value: 999 })
    const result = await withIdempotency('wi-duplicate', op)

    // Operation should NOT have been called because cache hit occurred
    expect(op).not.toHaveBeenCalled()
    expect(result).toEqual(cached)
  })
})

// ---------------------------------------------------------------------------
// withIdempotencyAndLocking
// ---------------------------------------------------------------------------

describe('withIdempotencyAndLocking', () => {
  beforeEach(() => {
    mockRedis = null
  })

  it('executes the action and returns success result on first call', async () => {
    // no cached result, lock acquired
    mockRedis = makeRedis({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'), // NX set succeeds
    })

    const op = vi.fn().mockResolvedValue({ txid: 'abc' })
    const result = await withIdempotencyAndLocking('wil-first', op)

    expect(result).toEqual({ success: true, result: { txid: 'abc' } })
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('returns cached result as duplicate on second call with same key', async () => {
    const cached = { txid: 'cached-tx' }
    mockRedis = makeRedis({
      get: vi.fn().mockResolvedValue(cached),
    })

    const op = vi.fn()
    const result = await withIdempotencyAndLocking('wil-dup', op)

    expect(result).toEqual({
      success: false,
      error: 'Duplicate request',
      cached,
    })
    expect(op).not.toHaveBeenCalled()
  })

  it('returns "Operation already in progress" when lock is held', async () => {
    // get returns null (no cached result), but SET NX returns null (lock already held)
    mockRedis = makeRedis({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(null),
    })

    const op = vi.fn()
    const result = await withIdempotencyAndLocking('wil-locked', op)

    expect(result).toEqual({ success: false, error: 'Operation already in progress' })
    expect(op).not.toHaveBeenCalled()
  })

  it('releases lock even when operation throws', async () => {
    const mockDel = vi.fn().mockResolvedValue(1)
    mockRedis = makeRedis({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: mockDel,
    })

    const op = vi.fn().mockRejectedValue(new Error('op failed'))
    await expect(withIdempotencyAndLocking('wil-throws', op)).rejects.toThrow('op failed')

    // clearInProgress should have been called for the lock key
    expect(mockDel).toHaveBeenCalledWith(
      expect.stringContaining('inprogress:wil-throws')
    )
  })

  it('prevents concurrent execution with same key (in-memory lock)', async () => {
    mockRedis = null // use in-memory path

    const key = 'concurrent-key'

    let resolveFirst!: () => void
    const firstOpStarted = new Promise<void>(res => {
      // signals when the first operation body begins
      resolveFirst = () => res()
    })
    let finishFirst!: () => void
    const firstOpGate = new Promise<string>(res => { finishFirst = () => res('done') })

    const firstOp = vi.fn().mockImplementation(async () => {
      resolveFirst()
      return firstOpGate
    })
    const secondOp = vi.fn().mockResolvedValue('second-result')

    // Start first operation but don't await it yet
    const firstPromise = withIdempotencyAndLocking(key, firstOp)

    // Wait until first op body is executing, then attempt second with same key
    await firstOpStarted
    const secondResult = await withIdempotencyAndLocking(key, secondOp)

    // Second call must be blocked by the lock
    expect(secondResult).toEqual({ success: false, error: 'Operation already in progress' })
    expect(secondOp).not.toHaveBeenCalled()

    // Let first finish
    finishFirst()
    const firstResult = await firstPromise
    expect(firstResult).toEqual({ success: true, result: 'done' })
  })

  it('stores result for future duplicate detection after success', async () => {
    const mockSet = vi.fn().mockResolvedValue('OK')
    const mockGet = vi.fn().mockResolvedValue(null)
    mockRedis = makeRedis({ get: mockGet, set: mockSet })

    const op = vi.fn().mockResolvedValue({ status: 'minted' })
    await withIdempotencyAndLocking('wil-store', op)

    // Should have called set at least twice: once for the lock (NX), once for the result
    expect(mockSet).toHaveBeenCalledTimes(2)

    // One of those calls should be for the idempotency result (no nx flag)
    const resultStorageCall = mockSet.mock.calls.find(
      (args: unknown[]) => {
        const key = args[0] as string
        const opts = args[2] as { ex?: number; nx?: boolean } | undefined
        return key === 'wrootz:idempotency:wil-store' && !opts?.nx
      }
    )
    expect(resultStorageCall).toBeDefined()
  })
})
