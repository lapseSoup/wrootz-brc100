'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { revalidatePath } from 'next/cache'
import { notifyNewFollower } from './notifications'

// Tag validation constants
const MIN_TAG_LENGTH = 1
const MAX_TAG_LENGTH = 50
const TAG_PATTERN = /^[a-zA-Z0-9_-]+$/

/**
 * Validate and normalize a tag string
 * @returns validation result with normalized tag or error
 */
function validateTag(tag: string): { valid: boolean; normalized?: string; error?: string } {
  if (!tag || typeof tag !== 'string') {
    return { valid: false, error: 'Tag is required' }
  }

  const trimmed = tag.trim()

  if (trimmed.length < MIN_TAG_LENGTH) {
    return { valid: false, error: `Tag must be at least ${MIN_TAG_LENGTH} character` }
  }

  if (trimmed.length > MAX_TAG_LENGTH) {
    return { valid: false, error: `Tag must be ${MAX_TAG_LENGTH} characters or less` }
  }

  if (!TAG_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Tag can only contain letters, numbers, underscores, and hyphens' }
  }

  // Normalize to lowercase for consistency
  return { valid: true, normalized: trimmed.toLowerCase() }
}

// Tag following
export async function followTag(tag: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  // Validate tag input
  const validation = validateTag(tag)
  if (!validation.valid) {
    return { error: validation.error }
  }

  const normalizedTag = validation.normalized!

  try {
    await prisma.followedTag.create({
      data: {
        tag: normalizedTag,
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

  // Validate and normalize tag
  const validation = validateTag(tag)
  if (!validation.valid) {
    return { error: validation.error }
  }

  const normalizedTag = validation.normalized!

  await prisma.followedTag.deleteMany({
    where: {
      tag: normalizedTag,
      userId: session.userId
    }
  })

  revalidatePath('/')
  return { success: true }
}

export async function isFollowingTag(tag: string): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  // Validate and normalize tag
  const validation = validateTag(tag)
  if (!validation.valid) return false

  const normalizedTag = validation.normalized!

  const follow = await prisma.followedTag.findUnique({
    where: {
      userId_tag: {
        userId: session.userId,
        tag: normalizedTag
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

// Username validation constants
const MIN_USERNAME_LENGTH = 3
const MAX_USERNAME_LENGTH = 20
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/

/**
 * Validate a username string
 */
function validateUsername(username: string): { valid: boolean; normalized?: string; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' }
  }

  const trimmed = username.trim()

  if (trimmed.length < MIN_USERNAME_LENGTH) {
    return { valid: false, error: `Username must be at least ${MIN_USERNAME_LENGTH} characters` }
  }

  if (trimmed.length > MAX_USERNAME_LENGTH) {
    return { valid: false, error: `Username must be ${MAX_USERNAME_LENGTH} characters or less` }
  }

  if (!USERNAME_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' }
  }

  return { valid: true, normalized: trimmed.toLowerCase() }
}

// User following
export async function followUser(username: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  // Validate username
  const validation = validateUsername(username)
  if (!validation.valid) {
    return { error: validation.error }
  }

  const normalizedUsername = validation.normalized!

  const userToFollow = await prisma.user.findUnique({
    where: { username: normalizedUsername }
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
    revalidatePath(`/profile/${normalizedUsername}`)
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

  // Validate username
  const validation = validateUsername(username)
  if (!validation.valid) {
    return { error: validation.error }
  }

  const normalizedUsername = validation.normalized!

  const userToUnfollow = await prisma.user.findUnique({
    where: { username: normalizedUsername }
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
  revalidatePath(`/profile/${normalizedUsername}`)
  return { success: true }
}

export async function isFollowingUser(username: string): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  // Validate username
  const validation = validateUsername(username)
  if (!validation.valid) return false

  const normalizedUsername = validation.normalized!

  const userToCheck = await prisma.user.findUnique({
    where: { username: normalizedUsername }
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
  // Validate username
  const validation = validateUsername(username)
  if (!validation.valid) return 0

  const user = await prisma.user.findUnique({
    where: { username: validation.normalized }
  })

  if (!user) return 0

  return prisma.followedUser.count({
    where: { followingId: user.id }
  })
}

export async function getFollowingCount(username: string): Promise<number> {
  // Validate username
  const validation = validateUsername(username)
  if (!validation.valid) return 0

  const user = await prisma.user.findUnique({
    where: { username: validation.normalized }
  })

  if (!user) return 0

  return prisma.followedUser.count({
    where: { followerId: user.id }
  })
}

export async function getFollowers(username: string): Promise<{ username: string; createdAt: Date }[]> {
  // Validate username
  const validation = validateUsername(username)
  if (!validation.valid) return []

  const user = await prisma.user.findUnique({
    where: { username: validation.normalized }
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
  // Validate username
  const validation = validateUsername(username)
  if (!validation.valid) return []

  const user = await prisma.user.findUnique({
    where: { username: validation.normalized }
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
