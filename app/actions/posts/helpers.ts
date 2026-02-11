'use server'

import prisma from '@/app/lib/db'
import { getCurrentBlockHeight } from '@/app/lib/blockchain'
import { forceUpdateLockStatuses } from '@/app/lib/lock-updater'

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
 * M9: Delegate to lock-updater.ts to avoid code duplication
 */
export async function updateLockStatuses() {
  await forceUpdateLockStatuses()
}
