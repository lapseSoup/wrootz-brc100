'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { revalidatePath } from 'next/cache'

/**
 * List a post for sale.
 */
export async function listForSale(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
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
      listedAt: null // Clear the listing timestamp
    }
  })

  revalidatePath(`/post/${postId}`)
  revalidatePath('/')

  return { success: true }
}

/**
 * TODO: Buying posts on mainnet requires wallet integration.
 * The purchase flow should:
 * 1. Buyer sends BSV to a smart contract/escrow
 * 2. Contract distributes to owner and lockers based on locker share percentage
 * 3. Ownership is transferred in the database
 * For now, this is disabled until the escrow contract is implemented.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function buyPost(_formData: FormData) {
  return { error: 'Post purchases are being updated for mainnet. Coming soon!' }
}
