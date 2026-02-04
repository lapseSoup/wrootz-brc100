'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { MAX_POST_LENGTH, MAX_LOCK_DURATION_BLOCKS, MIN_LOCK_AMOUNT_SATS, MIN_LOCK_PERCENTAGE_FOR_SALE, SATS_PER_BSV, calculateWrootz } from '@/app/lib/constants'
import { getCurrentBlockHeight } from '@/app/lib/blockchain'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyLockOnPost, notifyFollowersOfNewPost, notifyTagFollowers, notifyReplyCreated } from './notifications'
import { withIdempotencyAndLocking, generateIdempotencyKey } from '@/app/lib/idempotency'

// Helper to get current block from blockchain or cache
async function getCurrentBlock(): Promise<number> {
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

// Update lock statuses based on current block
// Uses batch operations to prevent race conditions
async function updateLockStatuses() {
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

export async function createPost(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in to create a post' }
  }

  const title = formData.get('title') as string
  const body = formData.get('body') as string
  const lockerSharePercentage = parseFloat(formData.get('lockerSharePercentage') as string) || 10
  const imageUrl = formData.get('imageUrl') as string | null
  const videoUrl = formData.get('videoUrl') as string | null

  // Inscription data (required for mainnet)
  const inscriptionTxid = formData.get('inscriptionTxid') as string | null
  const inscriptionId = formData.get('inscriptionId') as string | null
  const contentHash = formData.get('contentHash') as string | null

  // Reply/link parameter (optional)
  const replyToPostId = formData.get('replyToPostId') as string | null

  if (!body) {
    return { error: 'Body is required' }
  }

  // Title is optional for replies
  if (!title && !replyToPostId) {
    return { error: 'Title is required' }
  }

  if (title && title.length > 200) {
    return { error: 'Title must be 200 characters or less' }
  }

  // Require inscription for mainnet posts
  if (!inscriptionTxid || !inscriptionId) {
    return { error: 'Posts must be inscribed on-chain. Please connect your wallet.' }
  }

  // Use inscriptionTxid as idempotency key - prevents duplicate posts for same inscription
  const idempotencyKey = generateIdempotencyKey('createPost', inscriptionTxid)
  const idempotencyResult = await withIdempotencyAndLocking(idempotencyKey, async () => {
    // Check if post with this inscription already exists
    const existingPost = await prisma.post.findFirst({
      where: { inscriptionTxid }
    })
    if (existingPost) {
      return { postId: existingPost.id, duplicate: true }
    }

    // Verify reply target exists if specified
    let replyToPost = null
    if (replyToPostId) {
      replyToPost = await prisma.post.findUnique({
        where: { id: replyToPostId },
        select: { id: true, title: true, ownerId: true }
      })
      if (!replyToPost) {
        return { error: 'Reply target post not found' }
      }
    }

    if (body.length > MAX_POST_LENGTH) {
      return { error: `Post body must be ${MAX_POST_LENGTH} characters or less` }
    }

    if (lockerSharePercentage < 0 || lockerSharePercentage > 100) {
      return { error: 'Locker share percentage must be between 0 and 100' }
    }

    // Create the post with inscription data
    const post = await prisma.post.create({
      data: {
        title: title || '',  // Empty title allowed for replies
        body,
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        lockerSharePercentage,
        totalTu: 0,  // Starts with no wrootz until someone locks
        inscriptionTxid,
        inscriptionId,
        contentHash,
        creatorId: session.userId,
        ownerId: session.userId // Creator is initial owner
      }
    })

    // Create post link if this is a reply
    if (replyToPost) {
      await prisma.postLink.create({
        data: {
          type: 'reply',
          sourcePostId: post.id,
          targetPostId: replyToPost.id,
          creatorId: session.userId
        }
      })
    }

    // Record create transaction (with inscription txid)
    await prisma.transaction.create({
      data: {
        action: 'Create',
        amount: 0,
        txid: inscriptionTxid,
        confirmed: false,  // Will be confirmed on-chain
        description: `Created post: ${title || 'Reply'}`,
        userId: session.userId,
        postId: post.id
      }
    })

    // Notify followers of new post
    const creator = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { username: true }
    })
    if (creator) {
      // For replies, notify the parent post owner
      if (replyToPost) {
        await notifyReplyCreated(replyToPost.id, post.id, session.userId, creator.username)
      } else {
        // For regular posts, notify followers
        await notifyFollowersOfNewPost(session.userId, creator.username, post.id, title || '', body)
      }
    }

    return { postId: post.id }
  })

  // Handle idempotency result
  if (!idempotencyResult.success) {
    // Return cached result if duplicate with valid postId
    if (idempotencyResult.cached && 'postId' in idempotencyResult.cached) {
      revalidatePath('/')
      redirect(`/post/${idempotencyResult.cached.postId}`)
    }
    return { error: idempotencyResult.error }
  }

  // Check for error in result
  if ('error' in idempotencyResult.result) {
    return idempotencyResult.result
  }

  revalidatePath('/')
  redirect(`/post/${idempotencyResult.result.postId}`)
}

// DEPRECATED: This function uses simulated balance.
// Use recordLock() instead for real BSV on-chain locks.
// Keeping for reference during migration.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function lockBSV(_formData: FormData) {
  return { error: 'Direct locking is disabled. Please use wallet-based locking via recordLock().' }
}

// Record a lock that was created on-chain via wallet
// This is for REAL BSV transactions
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

  const { postId, amount, satoshis, durationBlocks, tag, txid, lockAddress } = params

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

  if (durationBlocks < 1 || durationBlocks > MAX_LOCK_DURATION_BLOCKS) {
    return { error: 'Invalid lock duration' }
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

    // Get current block from blockchain
    const blockchainState = await prisma.blockchainState.findUnique({
      where: { id: 'singleton' }
    })
    const currentBlock = blockchainState?.currentBlock || 0

    // Calculate initial wrootz
    const initialTu = calculateWrootz(amount, durationBlocks)

    // Create lock record (no balance deduction since it's on-chain)
    await prisma.$transaction([
      prisma.lock.create({
        data: {
          amount,
          satoshis,
          durationBlocks,
          startBlock: currentBlock,
          remainingBlocks: durationBlocks,
          initialTu,
          currentTu: initialTu,
          tag,
          txid,
          lockAddress,
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
          amount,
          satoshis,
          txid,
          confirmed: false, // Will be updated when confirmed on-chain
          description: `Locked ${satoshis.toLocaleString()} sats for ${durationBlocks} blocks${tag ? ` with tag: ${tag}` : ''}`,
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

// TODO: Tipping on mainnet requires wallet integration
// Tips should be sent directly via wallet using sendBSV
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function tipPost(_formData: FormData) {
  return { error: 'Tipping is being updated for mainnet. Please use your wallet to send BSV directly.' }
}

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

// TODO: Buying posts on mainnet requires wallet integration
// The purchase flow should:
// 1. Buyer sends BSV to a smart contract/escrow
// 2. Contract distributes to owner and lockers based on locker share percentage
// 3. Ownership is transferred in the database
// For now, this is disabled until the escrow contract is implemented
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function buyPost(_formData: FormData) {
  return { error: 'Post purchases are being updated for mainnet. Coming soon!' }
}

export async function getPostsWithTU(options?: {
  search?: string
  limit?: number
  filter?: 'all' | 'following' | 'rising' | 'for-sale' | 'discover'
  archive?: boolean
  showHidden?: boolean
}) {
  // Update simulation first
  await updateLockStatuses()

  const session = await getSession()

  // Get hidden post IDs for the current user (unless showing hidden)
  let hiddenPostIds: string[] = []
  if (session && !options?.showHidden) {
    const hidden = await prisma.hiddenPost.findMany({
      where: { userId: session.userId },
      select: { postId: true }
    })
    hiddenPostIds = hidden.map(h => h.postId)
  }

  // Build where clause based on filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  // Exclude hidden posts (unless showing hidden only)
  if (hiddenPostIds.length > 0 && !options?.showHidden) {
    conditions.push({ id: { notIn: hiddenPostIds } })
  }

  // Show only hidden posts when showHidden is true
  if (options?.showHidden && session) {
    const hidden = await prisma.hiddenPost.findMany({
      where: { userId: session.userId },
      select: { postId: true }
    })
    const hiddenIds = hidden.map(h => h.postId)
    if (hiddenIds.length === 0) {
      return [] // No hidden posts
    }
    conditions.push({ id: { in: hiddenIds } })
  }

  // Archive mode: only show posts with expired locks (no active wrootz)
  if (options?.archive) {
    conditions.push({
      AND: [
        { totalTu: 0 },
        { locks: { some: { expired: true } } }
      ]
    })
  }

  // Search filter
  if (options?.search) {
    // In archive mode, search in expired locks' tags
    if (options?.archive) {
      conditions.push({
        OR: [
          { title: { contains: options.search } },
          { body: { contains: options.search } },
          { locks: { some: { tag: { contains: options.search }, expired: true } } }
        ]
      })
    } else {
      conditions.push({
        OR: [
          { title: { contains: options.search } },
          { body: { contains: options.search } },
          { locks: { some: { tag: { contains: options.search } } } }
        ]
      })
    }
  }

  // Filter by type
  if (options?.filter === 'rising') {
    // Special handling for rising - we need to get posts sorted by recent wrootz gains
    const risingPosts = await getRisingPosts(options?.limit || 50)
    if (risingPosts.length === 0) return []

    // Filter out hidden posts from rising
    const risingPostIds = risingPosts
      .filter(p => !hiddenPostIds.includes(p.id))
      .map(p => p.id)

    if (risingPostIds.length === 0) return []

    // Add search filter if present
    const risingWhere = options?.search
      ? {
          AND: [
            { id: { in: risingPostIds } },
            {
              OR: [
                { title: { contains: options.search } },
                { body: { contains: options.search } },
                { locks: { some: { tag: { contains: options.search } } } }
              ]
            }
          ]
        }
      : { id: { in: risingPostIds } }

    const posts = await prisma.post.findMany({
      where: risingWhere,
      include: {
        creator: { select: { id: true, username: true } },
        owner: { select: { id: true, username: true } },
        locks: {
          where: { expired: false },
          include: { user: { select: { id: true, username: true } } }
        }
      }
    })

    // Sort by the rising order (most recent wrootz gains first)
    const postMap = new Map(posts.map(p => [p.id, p]))
    return risingPostIds
      .filter(id => postMap.has(id))
      .map(id => postMap.get(id)!)
  } else if (options?.filter === 'for-sale') {
    conditions.push({ forSale: true })
  } else if (options?.filter === 'discover') {
    // Posts with no active wrootz (totalTu = 0)
    conditions.push({ totalTu: 0 })
  } else if (options?.filter === 'following' && session) {
    // Get followed tags and users
    const [followedTags, followedUsers] = await Promise.all([
      prisma.followedTag.findMany({
        where: { userId: session.userId },
        select: { tag: true }
      }),
      prisma.followedUser.findMany({
        where: { followerId: session.userId },
        select: { followingId: true }
      })
    ])

    const tagNames = followedTags.map(f => f.tag)
    const userIds = followedUsers.map(f => f.followingId)

    if (tagNames.length === 0 && userIds.length === 0) {
      // Not following anything, return empty
      return []
    }

    conditions.push({
      OR: [
        // Posts with locks that have followed tags
        ...(tagNames.length > 0 ? [{
          locks: {
            some: {
              expired: false,
              tag: { in: tagNames }
            }
          }
        }] : []),
        // Posts by followed users (creator or owner)
        ...(userIds.length > 0 ? [
          { creatorId: { in: userIds } },
          { ownerId: { in: userIds } }
        ] : [])
      ]
    })
  }

  const where = conditions.length > 0 ? { AND: conditions } : {}

  // Determine sort order
  const orderBy = options?.filter === 'discover' || options?.archive
    ? { createdAt: 'desc' as const }  // Newest first for discover and archive
    : { totalTu: 'desc' as const }     // Most wrootz first otherwise

  const posts = await prisma.post.findMany({
    where,
    include: {
      creator: {
        select: { id: true, username: true }
      },
      owner: {
        select: { id: true, username: true }
      },
      locks: {
        where: options?.archive ? { expired: true } : { expired: false },
        include: {
          user: { select: { id: true, username: true } }
        }
      },
      incomingLinks: {
        where: { type: 'reply' },
        select: { id: true }
      },
      outgoingLinks: {
        where: { type: 'reply' },
        include: {
          targetPost: {
            select: { id: true, title: true }
          }
        },
        take: 1
      }
    },
    orderBy,
    take: options?.limit || 50
  })

  // Add computed fields
  return posts.map(post => {
    // Calculate actual wrootz from active locks (more accurate than post.totalTu which may be stale)
    const actualTotalTu = post.locks.reduce((sum, lock) => sum + lock.currentTu, 0)

    return {
      ...post,
      // Override totalTu with the calculated value from active locks
      totalTu: actualTotalTu,
      replyCount: post.incomingLinks.length,
      replyTo: post.outgoingLinks[0]?.targetPost || null
    }
  })
}

export async function getPostById(id: string) {
  // Update simulation first
  await updateLockStatuses()

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      creator: {
        select: { id: true, username: true }
      },
      owner: {
        select: { id: true, username: true }
      },
      locks: {
        include: {
          user: { select: { id: true, username: true } }
        },
        orderBy: { currentTu: 'desc' }
      },
      transactions: {
        include: {
          user: { select: { id: true, username: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }
    }
  })

  if (!post) return null

  // Calculate actual wrootz from active locks (more accurate than post.totalTu which may be stale)
  const activeLocks = post.locks.filter(lock => !lock.expired)
  const actualTotalTu = activeLocks.reduce((sum, lock) => sum + lock.currentTu, 0)

  return {
    ...post,
    // Override totalTu with the calculated value from active locks
    totalTu: actualTotalTu
  }
}

export async function getTopTags(limit: number = 5) {
  // Get all active locks with tags
  const locks = await prisma.lock.findMany({
    where: {
      expired: false,
      tag: { not: null }
    },
    select: {
      tag: true,
      currentTu: true
    }
  })

  // Aggregate by tag
  const tagWrootz: Record<string, number> = {}
  for (const lock of locks) {
    if (lock.tag) {
      tagWrootz[lock.tag] = (tagWrootz[lock.tag] || 0) + lock.currentTu
    }
  }

  // Sort and return top tags
  return Object.entries(tagWrootz)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, wrootz]) => ({ tag, wrootz }))
}

export async function getTrendingTags(limit: number = 5) {
  // Get current block
  const currentBlock = await getCurrentBlock()
  const recentBlockThreshold = currentBlock - 144 // ~24 hours (144 blocks at 10min each)

  // Get locks created in the last 24 hours with tags
  const recentLocks = await prisma.lock.findMany({
    where: {
      startBlock: { gte: recentBlockThreshold },
      tag: { not: null }
    },
    select: {
      tag: true,
      initialTu: true
    }
  })

  // Aggregate by tag - count recent wrootz added
  const tagWrootz: Record<string, number> = {}
  for (const lock of recentLocks) {
    if (lock.tag) {
      tagWrootz[lock.tag] = (tagWrootz[lock.tag] || 0) + lock.initialTu
    }
  }

  // Sort and return trending tags (by wrootz added in last 24h)
  return Object.entries(tagWrootz)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, wrootz]) => ({ tag, wrootz }))
}

export async function getTopLockers(limit: number = 5) {
  // Get all active locks grouped by user
  const locks = await prisma.lock.findMany({
    where: { expired: false },
    select: {
      currentTu: true,
      user: {
        select: { id: true, username: true }
      }
    }
  })

  // Aggregate by user
  const userWrootz: Record<string, { username: string; wrootz: number }> = {}
  for (const lock of locks) {
    if (!userWrootz[lock.user.id]) {
      userWrootz[lock.user.id] = { username: lock.user.username, wrootz: 0 }
    }
    userWrootz[lock.user.id].wrootz += lock.currentTu
  }

  // Sort and return top lockers
  return Object.values(userWrootz)
    .sort((a, b) => b.wrootz - a.wrootz)
    .slice(0, limit)
}

export async function getPlatformStats() {
  const [postCount, lockStats, userCount] = await Promise.all([
    prisma.post.count(),
    prisma.lock.aggregate({
      where: { expired: false },
      _sum: { currentTu: true, amount: true },
      _count: true
    }),
    prisma.user.count()
  ])

  return {
    totalPosts: postCount,
    totalWrootz: lockStats._sum.currentTu || 0,
    totalLockedBSV: lockStats._sum.amount || 0,
    activeLocks: lockStats._count,
    totalUsers: userCount
  }
}

export async function getRecentActivity(limit: number = 5) {
  // Get recent locks with user and post info
  const locks = await prisma.lock.findMany({
    where: { expired: false },
    include: {
      user: { select: { username: true } },
      post: { select: { id: true, title: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  })

  return locks.map(lock => ({
    username: lock.user.username,
    postId: lock.post.id,
    postTitle: lock.post.title,
    wrootz: lock.initialTu,
    tag: lock.tag
  }))
}

export async function getRisingPosts(limit: number = 5) {
  // Get posts with recent lock activity (last 24 hours worth of blocks)
  // We'll calculate which posts gained the most wrootz recently
  const currentBlock = await getCurrentBlock()
  const recentBlockThreshold = currentBlock - 144 // ~24 hours

  // Get all recent locks
  const recentLocks = await prisma.lock.findMany({
    where: {
      startBlock: { gte: recentBlockThreshold }
    },
    select: {
      postId: true,
      initialTu: true,
      post: {
        select: {
          id: true,
          title: true,
          totalTu: true
        }
      }
    }
  })

  // Aggregate recent wrootz by post
  const postWrootz: Record<string, { id: string; title: string; totalTu: number; recentWrootz: number }> = {}
  for (const lock of recentLocks) {
    if (!postWrootz[lock.postId]) {
      postWrootz[lock.postId] = {
        id: lock.post.id,
        title: lock.post.title,
        totalTu: lock.post.totalTu,
        recentWrootz: 0
      }
    }
    postWrootz[lock.postId].recentWrootz += lock.initialTu
  }

  // Sort by recent wrootz and return top posts
  return Object.values(postWrootz)
    .sort((a, b) => b.recentWrootz - a.recentWrootz)
    .slice(0, limit)
}

// Get replies to a post (posts that link TO this post with type 'reply')
export async function getReplies(postId: string, sortBy: 'wrootz' | 'newest' = 'wrootz') {
  const links = await prisma.postLink.findMany({
    where: {
      targetPostId: postId,
      type: 'reply'
    },
    include: {
      sourcePost: {
        include: {
          creator: { select: { id: true, username: true } },
          owner: { select: { id: true, username: true } },
          locks: {
            where: { expired: false },
            select: { currentTu: true }
          },
          incomingLinks: {
            where: { type: 'reply' },
            select: { id: true }
          }
        }
      }
    }
  })

  // Map to posts with computed fields
  const replies = links.map(link => ({
    ...link.sourcePost,
    replyCount: link.sourcePost.incomingLinks.length,
    linkCreatedAt: link.createdAt
  }))

  // Sort by wrootz or creation time
  if (sortBy === 'wrootz') {
    return replies.sort((a, b) => b.totalTu - a.totalTu)
  }
  return replies.sort((a, b) =>
    new Date(b.linkCreatedAt).getTime() - new Date(a.linkCreatedAt).getTime()
  )
}

// Get what post this is replying to (if any)
export async function getReplyParent(postId: string) {
  const link = await prisma.postLink.findFirst({
    where: {
      sourcePostId: postId,
      type: 'reply'
    },
    include: {
      targetPost: {
        select: {
          id: true,
          title: true,
          creator: { select: { username: true } }
        }
      }
    }
  })

  return link?.targetPost || null
}

// Get all backlinks (non-reply links) to a post
export async function getBacklinks(postId: string) {
  const links = await prisma.postLink.findMany({
    where: {
      targetPostId: postId,
      type: { not: 'reply' }
    },
    include: {
      sourcePost: {
        include: {
          creator: { select: { id: true, username: true } },
          owner: { select: { id: true, username: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return links.map(link => ({
    ...link.sourcePost,
    linkType: link.type,
    linkCreatedAt: link.createdAt
  }))
}

// Hide a post for the current user
export async function hidePost(postId: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in to hide posts' }
  }

  try {
    await prisma.hiddenPost.create({
      data: {
        userId: session.userId,
        postId
      }
    })
    revalidatePath('/')
    return { success: true }
  } catch {
    // Already hidden or post doesn't exist
    return { error: 'Could not hide post' }
  }
}

// Unhide a post for the current user
export async function unhidePost(postId: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in to unhide posts' }
  }

  await prisma.hiddenPost.deleteMany({
    where: {
      userId: session.userId,
      postId
    }
  })

  revalidatePath('/')
  return { success: true }
}

// Get hidden post IDs for the current user
export async function getHiddenPostIds(): Promise<string[]> {
  const session = await getSession()
  if (!session) {
    return []
  }

  const hidden = await prisma.hiddenPost.findMany({
    where: { userId: session.userId },
    select: { postId: true }
  })

  return hidden.map(h => h.postId)
}
