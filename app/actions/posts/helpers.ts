'use server'

import prisma from '@/app/lib/db'
import { getCurrentBlockHeight } from '@/app/lib/blockchain'

/**
 * Get current block height from blockchain or cache
 */
export async function getCurrentBlock(): Promise<number> {
  try {
    return await getCurrentBlockHeight()
  } catch {
    // Fall back to cached value
    const cached = await prisma.blockchainState.findUnique({
      where: { id: 'singleton' }
    })
    return cached?.currentBlock || 0
  }
}

/**
 * Update lock statuses based on current block height.
 * Uses batch operations to prevent race conditions.
 */
export async function updateLockStatuses() {
  const currentBlock = await getCurrentBlock()
  if (currentBlock === 0) return // Skip if we can't get block height

  // Find locks that need updating (not expired and have started)
  const activeLocks = await prisma.lock.findMany({
    where: {
      expired: false,
      startBlock: { lte: currentBlock }
    }
  })

  if (activeLocks.length === 0) return

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

  // Process all updates in a single transaction to prevent race conditions
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
}
