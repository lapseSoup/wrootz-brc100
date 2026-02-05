'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { updateLockStatusesIfNeeded } from '@/app/lib/lock-updater'
import { getCurrentBlock } from './helpers'

/**
 * Get posts with computed TU values and filters.
 * Supports cursor-based pagination for efficient infinite scroll.
 */
export async function getPostsWithTU(options?: {
  search?: string
  limit?: number
  filter?: 'all' | 'following' | 'rising' | 'for-sale' | 'discover'
  archive?: boolean
  showHidden?: boolean
  cursor?: string // Post ID for pagination
}): Promise<{ posts: ReturnType<typeof mapPost>[]; nextCursor: string | null }> {
  // Non-blocking update check - don't wait if recent update exists
  updateLockStatusesIfNeeded().catch(console.error)

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
      return { posts: [], nextCursor: null } // No hidden posts
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
    if (risingPosts.length === 0) return { posts: [], nextCursor: null }

    // Filter out hidden posts from rising
    const risingPostIds = risingPosts
      .filter(p => !hiddenPostIds.includes(p.id))
      .map(p => p.id)

    if (risingPostIds.length === 0) return { posts: [], nextCursor: null }

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
      }
    })

    // Sort by the rising order (most recent wrootz gains first)
    const postMap = new Map(posts.map(p => [p.id, p]))
    const resultPosts = risingPostIds
      .filter(id => postMap.has(id))
      .map(id => mapPost(postMap.get(id)!))
    return { posts: resultPosts, nextCursor: null } // Rising doesn't support pagination yet
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
      return { posts: [], nextCursor: null }
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

  // Fetch one extra for cursor pagination
  const take = (options?.limit || 50) + 1

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
    take,
    // Cursor-based pagination
    ...(options?.cursor && {
      cursor: { id: options.cursor },
      skip: 1 // Skip the cursor post itself
    })
  })

  // Check if there are more results
  const hasMore = posts.length > (options?.limit || 50)
  const resultPosts = hasMore ? posts.slice(0, -1) : posts
  const nextCursor = hasMore ? resultPosts[resultPosts.length - 1]?.id || null : null

  // Add computed fields
  return {
    posts: resultPosts.map(mapPost),
    nextCursor
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostWithRelations = any

/**
 * Helper function to map post data with computed fields
 */
function mapPost(post: PostWithRelations) {
  // Calculate actual wrootz from active locks (more accurate than post.totalTu which may be stale)
  const actualTotalTu = (post.locks || []).reduce((sum: number, lock: { currentTu: number }) => sum + lock.currentTu, 0)

  return {
    ...post,
    // Override totalTu with the calculated value from active locks
    totalTu: actualTotalTu,
    replyCount: (post.incomingLinks || []).length,
    replyTo: post.outgoingLinks?.[0]?.targetPost || null
  }
}

/**
 * Get a single post by ID with all related data.
 */
export async function getPostById(id: string) {
  // Non-blocking update check
  updateLockStatusesIfNeeded().catch(console.error)

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

/**
 * Get top tags by total wrootz.
 */
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

/**
 * Get trending tags by recent wrootz gains.
 */
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

/**
 * Get top lockers by total wrootz.
 */
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

/**
 * Get platform-wide statistics.
 */
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

/**
 * Get recent activity (locks).
 */
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

/**
 * Get rising posts (most wrootz gained recently).
 */
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
