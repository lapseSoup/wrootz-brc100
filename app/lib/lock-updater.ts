/**
 * Background lock status updater
 *
 * Decouples lock status updates from feed queries to improve performance.
 * Updates are rate-limited to prevent excessive database writes.
 */
'use server'

import prisma from '@/app/lib/db'
import { getCurrentBlockHeight } from '@/app/lib/blockchain'
import { fetchTransaction } from '@/app/lib/blockchain-verify'
import { markInProgress, clearInProgress } from '@/app/lib/idempotency'

// Minimum time between updates (in milliseconds)
const UPDATE_INTERVAL_MS = 60 * 1000 // 1 minute

// Block height cache duration
const BLOCK_CACHE_MS = 30 * 1000 // 30 seconds

// In-memory cache for block height and last update time.
// Note: These reset on serverless cold starts, but the code falls back gracefully
// by re-fetching from the blockchain API when cache is empty/stale.
let cachedBlockHeight = 0
let blockHeightCacheTime = 0
let lastUpdateTime = 0

/**
 * Get cached block height to reduce API calls
 */
async function getCachedBlockHeight(): Promise<number> {
  const now = Date.now()

  // Return cached value if still fresh
  if (now - blockHeightCacheTime < BLOCK_CACHE_MS && cachedBlockHeight > 0) {
    return cachedBlockHeight
  }

  try {
    cachedBlockHeight = await getCurrentBlockHeight()
    blockHeightCacheTime = now
    return cachedBlockHeight
  } catch {
    // Fallback to database cached value
    const cached = await prisma.blockchainState.findUnique({
      where: { id: 'singleton' }
    })
    return cached?.currentBlock || 0
  }
}

/**
 * Check if lock update is needed based on time since last update
 */
export async function shouldUpdateLocks(): Promise<boolean> {
  const cached = await prisma.blockchainState.findUnique({
    where: { id: 'singleton' }
  })

  if (!cached) return true

  const timeSinceSync = Date.now() - cached.lastSyncTime.getTime()
  return timeSinceSync > UPDATE_INTERVAL_MS
}

/**
 * Update lock statuses if needed
 * Returns early if an update was performed recently
 */
export async function updateLockStatusesIfNeeded(): Promise<{
  updated: boolean
  lockCount: number
  expiredCount: number
}> {
  // Acquire distributed lock BEFORE throttle check to prevent TOCTOU race
  if (!(await markInProgress('lockUpdate'))) {
    return { updated: false, lockCount: 0, expiredCount: 0 }
  }

  try {

  // Check if enough time has passed since last update
  const now = Date.now()
  if (now - lastUpdateTime < UPDATE_INTERVAL_MS) {
    return { updated: false, lockCount: 0, expiredCount: 0 }
  }

  const currentBlock = await getCachedBlockHeight()
  if (currentBlock === 0) {
    return { updated: false, lockCount: 0, expiredCount: 0 }
  }

  // Mark sync time BEFORE processing to prevent concurrent updates
  lastUpdateTime = now
  await prisma.blockchainState.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      currentBlock,
      lastSyncTime: new Date(),
      network: 'mainnet'
    },
    update: {
      currentBlock,
      lastSyncTime: new Date()
    }
  })

  // Process locks in batches with cursor-based pagination
  const BATCH_SIZE = 2000
  let totalLockCount = 0
  let totalExpiredCount = 0
  let cursor: string | undefined

  while (true) {
    const activeLocks = await prisma.lock.findMany({
      where: {
        expired: false,
        startBlock: { lte: currentBlock }
      },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' }
    })

    if (activeLocks.length === 0) break
    cursor = activeLocks[activeLocks.length - 1].id

    // Group locks by their new state
    const expiredLockUpdates: { id: string; postId: string; currentTu: number }[] = []
    const decayLockUpdates: { id: string; postId: string; remainingBlocks: number; currentTu: number }[] = []

    for (const lock of activeLocks) {
      const blocksElapsed = currentBlock - lock.startBlock
      const remainingBlocks = Math.max(0, lock.durationBlocks - blocksElapsed)

      if (remainingBlocks <= 0) {
        expiredLockUpdates.push({
          id: lock.id,
          postId: lock.postId,
          currentTu: lock.currentTu
        })
      } else {
        if (lock.durationBlocks <= 0) continue // skip malformed locks
        const decayFactor = remainingBlocks / lock.durationBlocks
        const newTu = lock.initialTu * decayFactor
        decayLockUpdates.push({
          id: lock.id,
          postId: lock.postId,
          remainingBlocks,
          currentTu: newTu
        })
      }
    }

    // Process batch updates in a single transaction
    const operations = []

    for (const lock of expiredLockUpdates) {
      operations.push(
        prisma.lock.update({
          where: { id: lock.id },
          data: {
            expired: true,
            remainingBlocks: 0,
            currentTu: 0
          }
        })
      )
      // NOTE: do NOT decrement post.totalTu here — we recalculate from scratch below
      // to prevent float drift and ensure accuracy after both expiry and decay updates
    }

    for (const lock of decayLockUpdates) {
      operations.push(
        prisma.lock.update({
          where: { id: lock.id },
          data: {
            remainingBlocks: lock.remainingBlocks,
            currentTu: lock.currentTu
          }
        })
      )
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations)
    }

    // Recalculate totalTu from scratch for affected posts to prevent float drift
    const affectedPostIds = new Set<string>([
      ...expiredLockUpdates.map(l => l.postId),
      ...decayLockUpdates.map(l => l.postId)
    ])

    for (const postId of Array.from(affectedPostIds)) {
      const sumResult = await prisma.lock.aggregate({
        where: { postId, expired: false },
        _sum: { currentTu: true }
      })
      const newTotalTu = Math.max(0, sumResult._sum.currentTu ?? 0)
      await prisma.post.update({
        where: { id: postId },
        data: { totalTu: newTotalTu }
      })
    }

    totalLockCount += activeLocks.length
    totalExpiredCount += expiredLockUpdates.length

    if (activeLocks.length < BATCH_SIZE) break
  }

  return {
    updated: true,
    lockCount: totalLockCount,
    expiredCount: totalExpiredCount
  }

  } finally {
    await clearInProgress('lockUpdate')
  }
}

/**
 * Force an immediate update regardless of timing
 * Use sparingly - primarily for cron jobs
 */
export async function forceUpdateLockStatuses(): Promise<{
  updated: boolean
  lockCount: number
  expiredCount: number
}> {
  // Reset last update time to force update
  lastUpdateTime = 0
  return updateLockStatusesIfNeeded()
}

/**
 * Confirm unconfirmed transactions by checking on-chain status
 * Returns the number of transactions confirmed
 */
export async function confirmTransactions(): Promise<{
  checked: number
  confirmed: number
  errors: number
}> {
  // WhatsOnChain rate limit: 3 requests per second
  // Process in batches to stay well under limit
  const BATCH_SIZE = 5
  const DELAY_BETWEEN_BATCH_MS = 2000 // 2 seconds between batches

  let checked = 0
  let confirmed = 0
  let errors = 0

  // Find unconfirmed transactions (both locks and transactions table)
  const unconfirmedLocks = await prisma.lock.findMany({
    where: {
      confirmed: false,
      txid: { not: null }
    },
    select: {
      id: true,
      txid: true
    },
    take: 50 // Process max 50 per run to respect rate limits
  })

  const unconfirmedTxs = await prisma.transaction.findMany({
    where: {
      confirmed: false,
      txid: { not: null }
    },
    select: {
      id: true,
      txid: true
    },
    take: 50
  })

  // Combine unique txids
  const txidMap = new Map<string, { lockIds: string[]; txIds: string[] }>()

  for (const lock of unconfirmedLocks) {
    if (lock.txid) {
      const entry = txidMap.get(lock.txid) || { lockIds: [], txIds: [] }
      entry.lockIds.push(lock.id)
      txidMap.set(lock.txid, entry)
    }
  }

  for (const tx of unconfirmedTxs) {
    if (tx.txid) {
      const entry = txidMap.get(tx.txid) || { lockIds: [], txIds: [] }
      entry.txIds.push(tx.id)
      txidMap.set(tx.txid, entry)
    }
  }

  const txids = Array.from(txidMap.keys())

  // Process in batches
  for (let i = 0; i < txids.length; i += BATCH_SIZE) {
    const batch = txids.slice(i, i + BATCH_SIZE)

    // Check each transaction in the batch
    const batchResults = await Promise.allSettled(
      batch.map(async (txid) => {
        const txData = await fetchTransaction(txid)
        return { txid, txData }
      })
    )

    // Process results
    const updateOperations: Array<ReturnType<typeof prisma.lock.update> | ReturnType<typeof prisma.transaction.update>> = []

    for (const result of batchResults) {
      checked++
      if (result.status === 'rejected') {
        errors++
        continue
      }

      const { txid, txData } = result.value
      if (!txData) {
        errors++
        continue
      }

      // Check if confirmed (has at least 1 confirmation)
      if (txData.confirmations > 0) {
        const entry = txidMap.get(txid)
        if (entry) {
          // Update all locks with this txid
          for (const lockId of entry.lockIds) {
            updateOperations.push(
              prisma.lock.update({
                where: { id: lockId },
                data: { confirmed: true }
              })
            )
          }
          // Update all transactions with this txid
          for (const txId of entry.txIds) {
            updateOperations.push(
              prisma.transaction.update({
                where: { id: txId },
                data: { confirmed: true }
              })
            )
          }
          confirmed++
        }
      }
    }

    // Execute batch updates
    if (updateOperations.length > 0) {
      await prisma.$transaction(updateOperations)
    }

    // Wait before next batch (if not the last batch)
    if (i + BATCH_SIZE < txids.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCH_MS))
    }
  }

  return { checked, confirmed, errors }
}
