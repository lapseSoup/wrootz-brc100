'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { MAX_LOCK_DURATION_BLOCKS, MIN_LOCK_AMOUNT_SATS, MAX_LOCK_AMOUNT_SATS, MIN_LOCK_PERCENTAGE_FOR_SALE, SATS_PER_BSV, calculateWrootzFromSats } from '@/app/lib/constants'
import { revalidatePath } from 'next/cache'
import { notifyLockOnPost, notifyTagFollowers } from '../notifications'
import { withIdempotencyAndLocking, generateIdempotencyKey } from '@/app/lib/idempotency'
import { verifyLock, getCurrentBlockHeight } from '@/app/lib/blockchain-verify'
import { checkStrictRateLimit } from '@/app/lib/server-action-rate-limit'


/**
 * DEPRECATED: This function uses simulated balance.
 * Use recordLock() instead for real BSV on-chain locks.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function lockBSV(_formData: FormData) {
  return { error: 'Direct locking is disabled. Please use wallet-based locking via recordLock().' }
}

/**
 * Record a lock that was created on-chain via wallet.
 * This is for REAL BSV transactions.
 */
export async function recordLock(params: {
  postId: string
  amount: number      // Amount in BSV
  satoshis: number    // Amount in satoshis
  durationBlocks: number
  tag: string | null
  txid: string        // On-chain transaction ID
  lockAddress: string // Address where BSV is locked
}) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in to lock BSV' }
  }

  // Rate limit lock operations to prevent spam
  const rateLimit = await checkStrictRateLimit('recordLock')
  if (!rateLimit.success) {
    return { error: `Too many lock attempts. Please try again in ${rateLimit.resetInSeconds} seconds.` }
  }

  const { postId, satoshis, durationBlocks, tag, txid, lockAddress } = params

  if (!postId || !txid) {
    return { error: 'Post ID and transaction ID are required' }
  }

  if (satoshis <= 0) {
    return { error: 'Amount must be positive' }
  }

  // Griefing protection: enforce minimum lock amount
  if (satoshis < MIN_LOCK_AMOUNT_SATS) {
    return { error: `Minimum lock amount is ${MIN_LOCK_AMOUNT_SATS.toLocaleString()} sats` }
  }

  if (satoshis > MAX_LOCK_AMOUNT_SATS) {
    return { error: `Maximum lock amount is ${(MAX_LOCK_AMOUNT_SATS / SATS_PER_BSV).toLocaleString()} BSV` }
  }

  if (durationBlocks < 1 || durationBlocks > MAX_LOCK_DURATION_BLOCKS) {
    return { error: 'Invalid lock duration' }
  }

  // Get current block height for unlock block calculation
  const blockchainState = await prisma.blockchainState.findUnique({
    where: { id: 'singleton' }
  })
  let currentBlock = blockchainState?.currentBlock ?? null
  if (currentBlock === null) {
    // Fallback: fetch from WhatsOnChain if DB state not initialized
    currentBlock = await getCurrentBlockHeight()
    if (currentBlock === null) {
      return { error: 'Unable to determine current block height. Please try again.' }
    }
  }
  const expectedUnlockBlock = currentBlock + durationBlocks

  // Full on-chain verification: verify tx exists AND lock amount, script, unlock block match
  const verification = await verifyLock(txid, satoshis, expectedUnlockBlock)
  if (!verification.txExists) {
    return { error: 'Transaction not found on blockchain. Please wait a moment and try again.' }
  }
  if (!verification.amountMatches) {
    return { error: `Lock amount mismatch: on-chain amount is ${verification.onChainAmount} sats, but ${satoshis} sats was claimed.` }
  }
  if (!verification.scriptIsValidLock) {
    return { error: 'Transaction does not contain a valid timelock script.' }
  }
  // Allow some tolerance on unlock block (±5 blocks for propagation delay)
  if (verification.onChainUnlockBlock !== undefined) {
    const blockDiff = Math.abs(verification.onChainUnlockBlock - expectedUnlockBlock)
    if (blockDiff > 5) {
      return { error: `Unlock block mismatch: on-chain unlock at block ${verification.onChainUnlockBlock}, expected ~${expectedUnlockBlock}.` }
    }
  }

  // Use txid as idempotency key - prevents duplicate lock records for same transaction
  const idempotencyKey = generateIdempotencyKey('recordLock', txid)
  const idempotencyResult = await withIdempotencyAndLocking(idempotencyKey, async () => {
    // Check if lock with this txid already exists in database
    const existingLock = await prisma.lock.findFirst({
      where: { txid }
    })
    if (existingLock) {
      return { success: true, txid, duplicate: true }
    }

    // Verify post exists and get sale info
    const post = await prisma.post.findUnique({
      where: { id: postId }
    })

    if (!post) {
      return { error: 'Post not found' }
    }

    // Additional griefing protection for posts listed for sale:
    // Lock must be at least MIN_LOCK_PERCENTAGE_FOR_SALE of the sale price
    // This prevents attackers from locking 1 sat for 1 year to freeze a sale
    if (post.forSale && post.salePrice > 0) {
      const salePriceInSats = post.salePrice * SATS_PER_BSV
      const minLockForSale = Math.max(MIN_LOCK_AMOUNT_SATS, Math.ceil(salePriceInSats * MIN_LOCK_PERCENTAGE_FOR_SALE))
      if (satoshis < minLockForSale) {
        return {
          error: `For posts listed for sale, minimum lock is ${minLockForSale.toLocaleString()} sats (${(MIN_LOCK_PERCENTAGE_FOR_SALE * 100).toFixed(1)}% of sale price)`
        }
      }
    }

    // Use verified on-chain amount for calculations (trust on-chain, not client)
    const verifiedSatoshis = verification.onChainAmount ?? satoshis
    const verifiedAmount = verifiedSatoshis / SATS_PER_BSV

    // Calculate initial wrootz using verified satoshi values (integer math, no float imprecision)
    const initialTu = calculateWrootzFromSats(verifiedSatoshis, durationBlocks)

    // Create lock record using verified on-chain data
    await prisma.$transaction([
      prisma.lock.create({
        data: {
          amount: verifiedAmount,
          satoshis: verifiedSatoshis,
          durationBlocks,
          startBlock: currentBlock,
          remainingBlocks: durationBlocks,
          initialTu,
          currentTu: initialTu,
          tag,
          txid,
          lockAddress,
          verified: true,
          verifiedAt: new Date(),
          onChainAmount: verification.onChainAmount ?? null,
          onChainUnlock: verification.onChainUnlockBlock ?? null,
          userId: session.userId,
          postId
        }
      }),
      prisma.post.update({
        where: { id: postId },
        data: {
          totalTu: { increment: initialTu }
        }
      }),
      prisma.transaction.create({
        data: {
          action: 'Lock',
          amount: verifiedAmount,
          satoshis: verifiedSatoshis,
          txid,
          confirmed: false, // Will be updated when confirmed on-chain
          description: `Locked ${verifiedSatoshis.toLocaleString()} sats for ${durationBlocks} blocks${tag ? ` with tag: ${tag}` : ''}`,
          userId: session.userId,
          postId
        }
      })
    ])

    // Get locker's username for notifications
    const locker = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { username: true }
    })

    if (locker) {
      // Notify post owner
      await notifyLockOnPost(postId, locker.username, session.userId)

      // Notify tag followers if there's a tag
      if (tag) {
        await notifyTagFollowers(tag, postId, post.title, session.userId, locker.username, post.body)
      }
    }

    return { success: true, txid }
  })

  // Handle idempotency result
  if (!idempotencyResult.success) {
    // Return cached result if it's a duplicate with valid result
    if (idempotencyResult.cached && 'success' in idempotencyResult.cached) {
      return idempotencyResult.cached
    }
    return { error: idempotencyResult.error }
  }

  revalidatePath(`/post/${postId}`)
  revalidatePath('/')

  return idempotencyResult.result
}

/**
 * TODO: Tipping on mainnet requires wallet integration.
 * Tips should be sent directly via wallet using sendBSV.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function tipPost(_formData: FormData) {
  return { error: 'Tipping is being updated for mainnet. Please use your wallet to send BSV directly.' }
}
