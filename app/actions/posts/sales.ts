'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { revalidatePath } from 'next/cache'
import { checkStrictRateLimit } from '@/app/lib/server-action-rate-limit'
import { verifyPayment } from '@/app/lib/blockchain-verify'
import { withIdempotencyAndLocking, generateIdempotencyKey } from '@/app/lib/idempotency'
import { notifyPostSold, notifyLockerProfit } from '../notifications'

/**
 * List a post for sale.
 */
export async function listForSale(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  // L5: Rate limit listing operations
  const rateLimit = await checkStrictRateLimit('listForSale')
  if (!rateLimit.success) {
    return { error: `Too many attempts. Please try again in ${rateLimit.resetInSeconds} seconds.` }
  }

  const postId = formData.get('postId') as string
  const salePrice = parseFloat(formData.get('salePrice') as string)
  const lockerSharePercentage = parseFloat(formData.get('lockerSharePercentage') as string)

  if (!postId || !salePrice) {
    return { error: 'Post ID and sale price are required' }
  }

  if (salePrice <= 0) {
    return { error: 'Sale price must be positive' }
  }

  if (isNaN(lockerSharePercentage) || lockerSharePercentage < 0 || lockerSharePercentage > 100) {
    return { error: 'Locker share percentage must be between 0 and 100' }
  }

  // Get post with active locks and verify ownership
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      locks: {
        where: { expired: false }
      }
    }
  })

  if (!post) {
    return { error: 'Post not found' }
  }

  if (post.ownerId !== session.userId) {
    return { error: 'You do not own this post' }
  }

  if (post.forSale) {
    return { error: 'Post is already listed for sale' }
  }

  // Owner can set any locker share percentage when listing for sale
  // Lockers who locked before the sale was listed accepted this risk
  await prisma.post.update({
    where: { id: postId },
    data: {
      forSale: true,
      salePrice,
      lockerSharePercentage,
      listedAt: new Date() // Track when listed for lock comparison
    }
  })

  // Record transaction
  await prisma.transaction.create({
    data: {
      action: 'Sell',
      amount: salePrice,
      description: `Listed for sale: ${post.title} (${lockerSharePercentage}% locker share)`,
      userId: session.userId,
      postId
    }
  })

  revalidatePath(`/post/${postId}`)
  revalidatePath('/')

  return { success: true }
}

/**
 * Cancel a sale listing.
 */
export async function cancelSale(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  // L5: Rate limit cancel operations
  const rateLimit = await checkStrictRateLimit('cancelSale')
  if (!rateLimit.success) {
    return { error: `Too many attempts. Please try again in ${rateLimit.resetInSeconds} seconds.` }
  }

  const postId = formData.get('postId') as string

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      locks: {
        where: { expired: false }
      }
    }
  })

  if (!post) {
    return { error: 'Post not found' }
  }

  if (post.ownerId !== session.userId) {
    return { error: 'You do not own this post' }
  }

  // Check for locks created AFTER the post was listed for sale
  // Locks from before listing don't lock in the terms - only post-listing locks do
  const locksAfterListing = post.listedAt
    ? post.locks.filter(lock => new Date(lock.createdAt) > new Date(post.listedAt!))
    : []

  if (locksAfterListing.length > 0) {
    return { error: 'Cannot cancel sale while there are locks added after listing' }
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      forSale: false,
      salePrice: 0,
      lockerSharePercentage: 10, // L11: Reset to default
      listedAt: null // Clear the listing timestamp
    }
  })

  revalidatePath(`/post/${postId}`)
  revalidatePath('/')

  return { success: true }
}

/**
 * Buy a post that's listed for sale.
 *
 * The purchase flow:
 * 1. Buyer submits the transaction ID (txid) of their payment
 * 2. We verify the payment transaction exists and has correct amount
 * 3. Ownership is transferred in the database
 * 4. Transaction is recorded for both buyer and seller
 *
 * Note: Actual fund distribution to lockers is handled off-chain for now.
 * The lockerSharePercentage is recorded for reference.
 */
export async function buyPost(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  // Rate limit financial operations
  const rateLimit = await checkStrictRateLimit('buyPost')
  if (!rateLimit.success) {
    return { error: `Too many attempts. Please try again in ${rateLimit.resetInSeconds} seconds.` }
  }

  const postId = formData.get('postId') as string
  const txid = formData.get('txid') as string

  if (!postId) {
    return { error: 'Post ID is required' }
  }

  if (!txid || txid.length !== 64) {
    return { error: 'Valid transaction ID is required' }
  }

  // Prevent txid reuse: one blockchain tx can only pay for one post
  const existingBuy = await prisma.transaction.findFirst({
    where: { txid, action: 'Buy' }
  })
  if (existingBuy) {
    return { error: 'This transaction has already been used for a purchase.' }
  }

  // H3: Idempotency protection keyed on txid to prevent double-purchase
  const idempotencyKey = generateIdempotencyKey('buyPost', txid)
  const idempotencyResult = await withIdempotencyAndLocking(idempotencyKey, async () => {
    // Get post with active locks
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        owner: { select: { id: true, username: true, walletAddress: true } },
        locks: {
          where: { expired: false },
          include: { user: { select: { id: true, username: true } } }
        }
      }
    })

    if (!post) {
      return { error: 'Post not found' }
    }

    if (!post.forSale) {
      return { error: 'Post is not for sale' }
    }

    if (post.ownerId === session.userId) {
      return { error: 'Cannot buy your own post' }
    }

    // Verify payment was sent to seller's wallet for the correct amount
    if (!post.owner.walletAddress) {
      return { error: 'Seller has no wallet address configured. Cannot verify payment.' }
    }

    // Avoid floating-point precision loss in BSV-to-satoshi conversion
    const bsvToSatoshis = (bsv: number) => Math.round(Number((bsv * 100_000_000).toFixed(0)))

    const expectedSatoshis = bsvToSatoshis(post.salePrice)
    try {
      const verification = await verifyPayment(txid, expectedSatoshis, post.owner.walletAddress)
      if (!verification.txExists) {
        return { error: 'Payment transaction not found on blockchain. Please wait for confirmation.' }
      }
      if (!verification.paymentFound) {
        return { error: 'No payment to the seller\'s address was found in this transaction.' }
      }
      if (!verification.amountCorrect) {
        return { error: 'Payment amount insufficient. Please ensure the correct amount was sent.' }
      }
    } catch (error) {
      console.error('Payment verification error:', error)
      return { error: 'Unable to verify payment. Please try again.' }
    }

    // Calculate distribution for record-keeping
    const lockerShare = post.salePrice * (post.lockerSharePercentage / 100)
    const ownerShare = post.salePrice - lockerShare

    // Transfer ownership and record transaction
    try {
      await prisma.$transaction([
        // Update post ownership
        prisma.post.update({
          where: { id: postId },
          data: {
            ownerId: session.userId,
            forSale: false,
            salePrice: 0,
            listedAt: null
          }
        }),
        // Record buy transaction for buyer
        prisma.transaction.create({
          data: {
            action: 'Buy',
            amount: post.salePrice,
            satoshis: bsvToSatoshis(post.salePrice),
            txid,
            confirmed: true, // We verified it exists
            description: `Purchased: ${post.title}`,
            userId: session.userId,
            postId
          }
        }),
        // Record sale transaction for seller (profit)
        prisma.transaction.create({
          data: {
            action: 'Profit',
            amount: ownerShare,
            satoshis: bsvToSatoshis(ownerShare),
            txid,
            confirmed: true,
            description: `Sold: ${post.title} (${post.lockerSharePercentage}% to lockers)`,
            userId: post.ownerId,
            postId
          }
        })
      ])
    } catch (error) {
      console.error('Purchase transaction error:', error)
      return { error: 'Failed to complete purchase. Please contact support.' }
    }

    // H4: Notify seller and lockers
    try {
      const buyer = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { username: true }
      })
      const buyerUsername = buyer?.username || 'Unknown'

      await notifyPostSold(post.ownerId, buyerUsername, session.userId, postId, post.title, post.salePrice, post.body)

      // Notify lockers of their proportional profit share (based on currentTu)
      if (post.locks.length > 0 && lockerShare > 0) {
        const totalLockTu = post.locks.reduce((sum: number, lock: { currentTu: number }) => sum + lock.currentTu, 0)
        for (const lock of post.locks) {
          const profitForLocker = totalLockTu > 0
            ? lockerShare * (lock.currentTu / totalLockTu)
            : lockerShare / post.locks.length // Fallback to equal split if all locks have 0 Tu
          await notifyLockerProfit(lock.userId, postId, post.title, profitForLocker, post.body)
        }
      }
    } catch (notifyError) {
      // Non-fatal: purchase succeeded even if notifications fail
      console.error('Notification error after purchase:', notifyError)
    }

    return {
      success: true as const,
      ownerShare,
      lockerShare,
      newOwner: session.userId
    }
  })

  // Handle idempotency result
  if (!idempotencyResult.success) {
    if (idempotencyResult.cached && typeof idempotencyResult.cached === 'object') {
      return idempotencyResult.cached
    }
    return { error: idempotencyResult.error }
  }

  const result = idempotencyResult.result
  if ('error' in result) {
    return result
  }

  revalidatePath(`/post/${postId}`)
  revalidatePath('/')

  return result
}
