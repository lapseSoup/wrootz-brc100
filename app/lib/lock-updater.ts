/**
 * Background lock status updater
 *
 * Decouples lock status updates from feed queries to improve performance.
 * Updates are rate-limited to prevent excessive database writes.
 */
'use server'

import prisma from '@/app/lib/db'
import { getCurrentBlockHeight } from '@/app/lib/blockchain'

// Minimum time between updates (in milliseconds)
const UPDATE_INTERVAL_MS = 60 * 1000 // 1 minute

// Block height cache duration
const BLOCK_CACHE_MS = 30 * 1000 // 30 seconds

// In-memory cache for block height and last update time
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

  // Find locks that need updating (not expired and have started)
  const activeLocks = await prisma.lock.findMany({
    where: {
      expired: false,
      startBlock: { lte: currentBlock }
    }
  })

  if (activeLocks.length === 0) {
    return { updated: true, lockCount: 0, expiredCount: 0 }
  }

  // Group locks by their new state
  const expiredLockUpdates: { id: string; postId: string; currentTu: number }[] = []
  const decayLockUpdates: { id: string; remainingBlocks: number; currentTu: number }[] = []

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
      const decayFactor = remainingBlocks / lock.durationBlocks
      const newTu = lock.initialTu * decayFactor
      decayLockUpdates.push({
        id: lock.id,
        remainingBlocks,
        currentTu: newTu
      })
    }
  }

  // Process all updates in a single transaction
  const operations = []

  // Batch expire locks
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
    operations.push(
      prisma.post.update({
        where: { id: lock.postId },
        data: {
          totalTu: { decrement: lock.currentTu }
        }
      })
    )
  }

  // Batch decay updates
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

  // Execute all in one atomic transaction
  if (operations.length > 0) {
    await prisma.$transaction(operations)
  }

  return {
    updated: true,
    lockCount: activeLocks.length,
    expiredCount: expiredLockUpdates.length
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
