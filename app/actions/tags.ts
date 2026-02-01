'use server'

import prisma from '@/app/lib/db'

export async function getTagStats(tag: string) {
  // Get all locks for this tag (active and expired)
  const [activeLocks, expiredLocks, followerCount] = await Promise.all([
    prisma.lock.findMany({
      where: { tag, expired: false },
      include: {
        user: { select: { username: true } },
        post: { select: { id: true, title: true, totalTu: true } }
      },
      orderBy: { currentTu: 'desc' }
    }),
    prisma.lock.findMany({
      where: { tag, expired: true },
      include: {
        user: { select: { username: true } },
        post: { select: { id: true, title: true } }
      }
    }),
    prisma.followedTag.count({
      where: { tag }
    })
  ])

  // Calculate stats
  const totalWrootz = activeLocks.reduce((sum, lock) => sum + lock.currentTu, 0)
  const totalLockedSats = activeLocks.reduce((sum, lock) => sum + lock.amount, 0)
  const peakWrootz = [...activeLocks, ...expiredLocks].reduce((max, lock) =>
    Math.max(max, lock.initialTu), 0
  )

  // Get unique posts
  const postIds = new Set([
    ...activeLocks.map(l => l.postId),
    ...expiredLocks.map(l => l.postId)
  ])

  // Get unique lockers
  const lockerUsernames = new Set([
    ...activeLocks.map(l => l.user.username),
    ...expiredLocks.map(l => l.user.username)
  ])

  // Top lockers by current wrootz
  const lockerWrootz: Record<string, number> = {}
  for (const lock of activeLocks) {
    lockerWrootz[lock.user.username] = (lockerWrootz[lock.user.username] || 0) + lock.currentTu
  }
  const topLockers = Object.entries(lockerWrootz)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([username, wrootz]) => ({ username, wrootz }))

  // Top posts by wrootz in this tag
  const postWrootz: Record<string, { id: string; title: string; wrootz: number }> = {}
  for (const lock of activeLocks) {
    if (!postWrootz[lock.postId]) {
      postWrootz[lock.postId] = { id: lock.postId, title: lock.post.title, wrootz: 0 }
    }
    postWrootz[lock.postId].wrootz += lock.currentTu
  }
  const topPosts = Object.values(postWrootz)
    .sort((a, b) => b.wrootz - a.wrootz)
    .slice(0, 10)

  return {
    tag,
    totalWrootz,
    totalLockedSats,
    peakWrootz,
    activeLockCount: activeLocks.length,
    expiredLockCount: expiredLocks.length,
    totalPosts: postIds.size,
    totalLockers: lockerUsernames.size,
    followerCount,
    topLockers,
    topPosts
  }
}

export async function getTagWrootzHistory(tag: string) {
  // Get all locks for this tag to build history
  const locks = await prisma.lock.findMany({
    where: { tag },
    select: {
      startBlock: true,
      durationBlocks: true,
      initialTu: true,
      expired: true
    },
    orderBy: { startBlock: 'asc' }
  })

  if (locks.length === 0) return []

  // Get current block
  const blockRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/block`, {
    cache: 'no-store'
  }).catch(() => null)

  let currentBlock = 880000 // fallback
  if (blockRes?.ok) {
    const data = await blockRes.json()
    currentBlock = data.currentBlock
  }

  // Find the earliest start block
  const earliestBlock = Math.min(...locks.map(l => l.startBlock))
  const blockRange = currentBlock - earliestBlock

  if (blockRange <= 0) return []

  // Sample at reasonable intervals (max 50 data points)
  const sampleInterval = Math.max(1, Math.floor(blockRange / 50))
  const dataPoints: { block: number; wrootz: number }[] = []

  for (let block = earliestBlock; block <= currentBlock; block += sampleInterval) {
    let totalWrootz = 0

    for (const lock of locks) {
      if (block >= lock.startBlock) {
        const blocksElapsed = block - lock.startBlock
        const blocksRemaining = Math.max(0, lock.durationBlocks - blocksElapsed)

        if (blocksRemaining > 0) {
          const wrootzAtBlock = lock.initialTu * (blocksRemaining / lock.durationBlocks)
          totalWrootz += wrootzAtBlock
        }
      }
    }

    dataPoints.push({ block, wrootz: totalWrootz })
  }

  // Always include current block
  if (dataPoints.length === 0 || dataPoints[dataPoints.length - 1].block !== currentBlock) {
    let currentWrootz = 0
    for (const lock of locks) {
      if (!lock.expired) {
        const blocksElapsed = currentBlock - lock.startBlock
        const blocksRemaining = Math.max(0, lock.durationBlocks - blocksElapsed)
        if (blocksRemaining > 0) {
          currentWrootz += lock.initialTu * (blocksRemaining / lock.durationBlocks)
        }
      }
    }
    dataPoints.push({ block: currentBlock, wrootz: currentWrootz })
  }

  return dataPoints
}

export async function getRecentTagActivity(tag: string, limit: number = 10) {
  const locks = await prisma.lock.findMany({
    where: { tag },
    include: {
      user: { select: { username: true } },
      post: { select: { id: true, title: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  })

  return locks.map(lock => ({
    id: lock.id,
    username: lock.user.username,
    postId: lock.postId,
    postTitle: lock.post.title,
    wrootz: lock.expired ? lock.initialTu : lock.currentTu,
    sats: lock.amount,
    expired: lock.expired,
    createdAt: lock.createdAt
  }))
}

export async function getTagFollowerCount(tag: string) {
  return prisma.followedTag.count({
    where: { tag }
  })
}

// Get posts for specific tag(s), ranked by tag-specific wrootz
// When multiple tags are provided, combines wrootz from all specified tags
export async function getPostsByTag(tags: string | string[], limit: number = 50) {
  const tagArray = Array.isArray(tags) ? tags : [tags]

  if (tagArray.length === 0) return []

  // Convert to lowercase for case-insensitive matching
  const lowerTags = tagArray.map(t => t.toLowerCase())

  // Get all active locks with tags (SQLite doesn't support case-insensitive IN)
  // We'll filter in JavaScript for case-insensitive matching
  const allActiveLocks = await prisma.lock.findMany({
    where: {
      expired: false,
      tag: { not: null }
    },
    include: {
      user: { select: { id: true, username: true } },
      post: {
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
      }
    }
  })

  // Filter locks that match any of the search tags (case-insensitive)
  const activeLocks = allActiveLocks.filter(lock =>
    lock.tag && lowerTags.includes(lock.tag.toLowerCase())
  )

  // Aggregate wrootz per post for these specific tags (combined)
  const postTagWrootz: Record<string, number> = {}
  const postMap: Record<string, typeof activeLocks[0]['post']> = {}

  for (const lock of activeLocks) {
    if (!postTagWrootz[lock.postId]) {
      postTagWrootz[lock.postId] = 0
      postMap[lock.postId] = lock.post
    }
    postTagWrootz[lock.postId] += lock.currentTu
  }

  // Sort posts by tag-specific wrootz and add computed fields
  const sortedPosts = Object.entries(postTagWrootz)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([postId, tagWrootz]) => {
      const post = postMap[postId]
      // Calculate actual totalTu from active locks (more accurate than post.totalTu which may be stale)
      const actualTotalTu = post.locks.reduce((sum, lock) => sum + lock.currentTu, 0)
      return {
        ...post,
        totalTu: actualTotalTu, // Override with calculated value
        tagWrootz, // combined wrootz for the specified tag(s)
        replyCount: post.incomingLinks.length,
        replyTo: post.outgoingLinks[0]?.targetPost || null
      }
    })

  return sortedPosts
}

export async function getRelatedTags(tags: string | string[], limit: number = 8) {
  const tagArray = Array.isArray(tags) ? tags : [tags]
  const lowerTags = tagArray.map(t => t.toLowerCase())

  if (tagArray.length === 0) return []

  // Find posts that have locks with any of these tags (case-insensitive)
  const allLocksWithTags = await prisma.lock.findMany({
    where: { tag: { not: null } },
    select: { postId: true, tag: true }
  })

  // Filter to posts that have any of the search tags
  const locksWithTag = allLocksWithTags.filter(l =>
    l.tag && lowerTags.includes(l.tag.toLowerCase())
  )

  const postIds = Array.from(new Set(locksWithTag.map(l => l.postId)))

  if (postIds.length === 0) return []

  // Find other tags on these same posts (excluding the search tags)
  const relatedLocks = await prisma.lock.findMany({
    where: {
      postId: { in: postIds },
      expired: false,
      tag: { not: null }
    },
    select: {
      tag: true,
      currentTu: true
    }
  })

  // Aggregate wrootz by tag, excluding the search tags
  const tagWrootz: Record<string, number> = {}
  for (const lock of relatedLocks) {
    if (lock.tag && !lowerTags.includes(lock.tag.toLowerCase())) {
      tagWrootz[lock.tag] = (tagWrootz[lock.tag] || 0) + lock.currentTu
    }
  }

  // Sort by wrootz and return top tags
  return Object.entries(tagWrootz)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([relatedTag, wrootz]) => ({ tag: relatedTag, wrootz }))
}
