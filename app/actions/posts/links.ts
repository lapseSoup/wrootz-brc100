'use server'

import prisma from '@/app/lib/db'

/**
 * Get replies to a post (posts that link TO this post with type 'reply').
 */
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

/**
 * Get what post this is replying to (if any).
 */
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

/**
 * Get all backlinks (non-reply links) to a post.
 */
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
