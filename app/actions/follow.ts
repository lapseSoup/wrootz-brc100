'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { revalidatePath } from 'next/cache'
import { notifyNewFollower } from './notifications'

// Tag following
export async function followTag(tag: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  try {
    await prisma.followedTag.create({
      data: {
        tag,
        userId: session.userId
      }
    })
    revalidatePath('/')
    return { success: true }
  } catch {
    // Already following
    return { error: 'Already following this tag' }
  }
}

export async function unfollowTag(tag: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  await prisma.followedTag.deleteMany({
    where: {
      tag,
      userId: session.userId
    }
  })

  revalidatePath('/')
  return { success: true }
}

export async function isFollowingTag(tag: string): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  const follow = await prisma.followedTag.findUnique({
    where: {
      userId_tag: {
        userId: session.userId,
        tag
      }
    }
  })

  return !!follow
}

export async function getFollowedTags(): Promise<string[]> {
  const session = await getSession()
  if (!session) return []

  const follows = await prisma.followedTag.findMany({
    where: { userId: session.userId },
    select: { tag: true }
  })

  return follows.map(f => f.tag)
}

// User following
export async function followUser(username: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  const userToFollow = await prisma.user.findUnique({
    where: { username }
  })

  if (!userToFollow) {
    return { error: 'User not found' }
  }

  if (userToFollow.id === session.userId) {
    return { error: 'You cannot follow yourself' }
  }

  try {
    await prisma.followedUser.create({
      data: {
        followerId: session.userId,
        followingId: userToFollow.id
      }
    })

    // Get current user's username for notification
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { username: true }
    })
    if (currentUser) {
      await notifyNewFollower(userToFollow.id, currentUser.username, session.userId)
    }

    revalidatePath('/')
    revalidatePath(`/profile/${username}`)
    return { success: true }
  } catch {
    return { error: 'Already following this user' }
  }
}

export async function unfollowUser(username: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  const userToUnfollow = await prisma.user.findUnique({
    where: { username }
  })

  if (!userToUnfollow) {
    return { error: 'User not found' }
  }

  await prisma.followedUser.deleteMany({
    where: {
      followerId: session.userId,
      followingId: userToUnfollow.id
    }
  })

  revalidatePath('/')
  revalidatePath(`/profile/${username}`)
  return { success: true }
}

export async function isFollowingUser(username: string): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  const userToCheck = await prisma.user.findUnique({
    where: { username }
  })

  if (!userToCheck) return false

  const follow = await prisma.followedUser.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.userId,
        followingId: userToCheck.id
      }
    }
  })

  return !!follow
}

export async function getFollowedUserIds(): Promise<string[]> {
  const session = await getSession()
  if (!session) return []

  const follows = await prisma.followedUser.findMany({
    where: { followerId: session.userId },
    select: { followingId: true }
  })

  return follows.map(f => f.followingId)
}

export async function getFollowerCount(username: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { username }
  })

  if (!user) return 0

  return prisma.followedUser.count({
    where: { followingId: user.id }
  })
}

export async function getFollowingCount(username: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { username }
  })

  if (!user) return 0

  return prisma.followedUser.count({
    where: { followerId: user.id }
  })
}

export async function getFollowers(username: string): Promise<{ username: string; createdAt: Date }[]> {
  const user = await prisma.user.findUnique({
    where: { username }
  })

  if (!user) return []

  const followers = await prisma.followedUser.findMany({
    where: { followingId: user.id },
    include: {
      follower: {
        select: { username: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return followers.map(f => ({
    username: f.follower.username,
    createdAt: f.createdAt
  }))
}

export async function getFollowing(username: string): Promise<{ username: string; createdAt: Date }[]> {
  const user = await prisma.user.findUnique({
    where: { username }
  })

  if (!user) return []

  const following = await prisma.followedUser.findMany({
    where: { followerId: user.id },
    include: {
      following: {
        select: { username: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return following.map(f => ({
    username: f.following.username,
    createdAt: f.createdAt
  }))
}
