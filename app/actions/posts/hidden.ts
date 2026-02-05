'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { revalidatePath } from 'next/cache'

/**
 * Hide a post for the current user.
 */
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

/**
 * Unhide a post for the current user.
 */
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

/**
 * Get hidden post IDs for the current user.
 */
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
