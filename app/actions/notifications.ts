'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { revalidatePath } from 'next/cache'

// Helper to get a display name for a post (title or truncated body)
function getPostDisplayName(title: string, body?: string): string {
  if (title && title.trim()) {
    return title
  }
  if (body) {
    const truncated = body.slice(0, 50).trim()
    return truncated.length < body.length ? `${truncated}...` : truncated
  }
  return 'Untitled post'
}

export async function getNotifications(limit: number = 20) {
  const session = await getSession()
  if (!session) return []

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    include: {
      post: {
        select: { id: true, title: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  })

  return notifications
}

export async function getUnreadCount() {
  const session = await getSession()
  if (!session) return 0

  return prisma.notification.count({
    where: { userId: session.userId, read: false }
  })
}

export async function markAsRead(notificationId: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  await prisma.notification.update({
    where: { id: notificationId, userId: session.userId },
    data: { read: true }
  })

  revalidatePath('/notifications')
  return { success: true }
}

export async function markAllAsRead() {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  await prisma.notification.updateMany({
    where: { userId: session.userId, read: false },
    data: { read: true }
  })

  revalidatePath('/notifications')
  return { success: true }
}

// Helper to create notifications - called from other actions
export async function createNotification({
  userId,
  type,
  message,
  postId,
  actorId
}: {
  userId: string
  type: 'lock_on_post' | 'followed_user_post' | 'followed_tag_activity' | 'new_follower' | 'reply_created' | 'post_sold' | 'locker_profit'
  message: string
  postId?: string
  actorId?: string
}) {
  // Don't notify yourself
  if (actorId && userId === actorId) return

  await prisma.notification.create({
    data: {
      userId,
      type,
      message,
      postId,
      actorId
    }
  })
}

// Notify post owner when someone locks on their post
export async function notifyLockOnPost(postId: string, lockerUsername: string, lockerId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { ownerId: true, title: true, body: true }
  })

  if (!post || post.ownerId === lockerId) return

  const displayName = getPostDisplayName(post.title, post.body)

  await createNotification({
    userId: post.ownerId,
    type: 'lock_on_post',
    message: `@${lockerUsername} locked on your post "${displayName}"`,
    postId,
    actorId: lockerId
  })
}

// Notify followers when a user creates a new post
export async function notifyFollowersOfNewPost(creatorId: string, creatorUsername: string, postId: string, postTitle: string, postBody?: string) {
  const followers = await prisma.followedUser.findMany({
    where: { followingId: creatorId },
    select: { followerId: true }
  })

  const displayName = getPostDisplayName(postTitle, postBody)

  // M7: Batch notification creation instead of sequential writes
  const notifications = followers
    .filter(f => f.followerId !== creatorId)
    .map(f => ({
      userId: f.followerId,
      type: 'followed_user_post' as const,
      message: `@${creatorUsername} created a new post: "${displayName}"`,
      postId,
      actorId: creatorId
    }))
  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications })
  }
}

// Notify users following a tag when it gets activity
export async function notifyTagFollowers(tag: string, postId: string, postTitle: string, actorId: string, actorUsername: string, postBody?: string) {
  const tagFollowers = await prisma.followedTag.findMany({
    where: { tag },
    select: { userId: true }
  })

  const displayName = getPostDisplayName(postTitle, postBody)

  // M7: Batch notification creation instead of sequential writes
  const notifications = tagFollowers
    .filter(f => f.userId !== actorId)
    .map(f => ({
      userId: f.userId,
      type: 'followed_tag_activity' as const,
      message: `New activity on #${tag}: "${displayName}" by @${actorUsername}`,
      postId,
      actorId
    }))
  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications })
  }
}

// Notify user when they get a new follower
export async function notifyNewFollower(followedUserId: string, followerUsername: string, followerId: string) {
  await createNotification({
    userId: followedUserId,
    type: 'new_follower',
    message: `@${followerUsername} started following you`,
    actorId: followerId
  })
}

// Notify post owner when someone replies to their post
export async function notifyReplyCreated(targetPostId: string, replyPostId: string, replierId: string, replierUsername: string) {
  const targetPost = await prisma.post.findUnique({
    where: { id: targetPostId },
    select: { ownerId: true, title: true, body: true }
  })

  if (!targetPost || targetPost.ownerId === replierId) return

  const displayName = getPostDisplayName(targetPost.title, targetPost.body)

  await createNotification({
    userId: targetPost.ownerId,
    type: 'reply_created',
    message: `@${replierUsername} replied to your post "${displayName}"`,
    postId: replyPostId, // Link to the reply, not the parent
    actorId: replierId
  })
}

// Notify seller when their post is sold
export async function notifyPostSold(sellerId: string, buyerUsername: string, buyerId: string, postId: string, postTitle: string, salePrice: number, postBody?: string) {
  const { formatSats, bsvToSats } = await import('@/app/lib/constants')

  const displayName = getPostDisplayName(postTitle, postBody)

  await createNotification({
    userId: sellerId,
    type: 'post_sold',
    message: `Your post "${displayName}" was purchased by @${buyerUsername} for ${formatSats(bsvToSats(salePrice))} sats`,
    postId,
    actorId: buyerId
  })
}

// Notify locker when they receive profit from a sale
export async function notifyLockerProfit(lockerId: string, postId: string, postTitle: string, profitAmount: number, postBody?: string) {
  const { formatSats, bsvToSats } = await import('@/app/lib/constants')

  const displayName = getPostDisplayName(postTitle, postBody)

  await createNotification({
    userId: lockerId,
    type: 'locker_profit',
    message: `You earned ${formatSats(bsvToSats(profitAmount))} sats from the sale of "${displayName}"`,
    postId
  })
}
