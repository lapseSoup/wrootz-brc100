// DEPRECATED: This file is kept for backward compatibility during migration.
// Use blockchain.ts instead for real BSV mainnet.

import { getCurrentBlockHeight } from './blockchain'
import prisma from './db'

// Redirect to real blockchain
export async function getCurrentBlock(): Promise<number> {
  try {
    return await getCurrentBlockHeight()
  } catch {
    // Fallback to cached value
    const cached = await prisma.blockchainState.findUnique({
      where: { id: 'singleton' }
    })
    return cached?.currentBlock || 0
  }
}

// No-op for mainnet - lock updates happen based on real blockchain
export async function updateSimulation(): Promise<{ currentBlock: number; expiredLocks: number }> {
  const currentBlock = await getCurrentBlock()
  return { currentBlock, expiredLocks: 0 }
}

// Not applicable for real blockchain
export async function getTimeUntilNextBlock(): Promise<number> {
  // BSV blocks are ~10 minutes on average
  return 600
}
