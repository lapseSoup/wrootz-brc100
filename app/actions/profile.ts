'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { revalidatePath } from 'next/cache'
import { checkStrictRateLimit } from '@/app/lib/server-action-rate-limit'

const MAX_BIO_LENGTH = 160

export async function updateBio(bio: string) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  const rateLimit = await checkStrictRateLimit('updateProfile')
  if (!rateLimit.success) {
    return { error: `Too many attempts. Please try again in ${rateLimit.resetInSeconds} seconds.` }
  }

  if (bio.length > MAX_BIO_LENGTH) {
    return { error: `Bio must be ${MAX_BIO_LENGTH} characters or less` }
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { bio: bio.trim() || null }
  })

  revalidatePath(`/profile/${user.username}`)
  revalidatePath('/profile')

  return { success: true }
}

export async function updateAvatar(avatarUrl: string | null) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in' }
  }

  const rateLimit = await checkStrictRateLimit('updateProfile')
  if (!rateLimit.success) {
    return { error: `Too many attempts. Please try again in ${rateLimit.resetInSeconds} seconds.` }
  }

  // Only allow local avatar paths uploaded via our upload endpoint
  if (avatarUrl && !avatarUrl.startsWith('/avatars/')) {
    return { error: 'Invalid avatar URL. Only uploaded avatars are allowed.' }
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { avatarUrl }
  })

  revalidatePath(`/profile/${user.username}`)
  revalidatePath('/profile')

  return { success: true }
}

export async function getProfile(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      bio: true,
      avatarUrl: true,
      createdAt: true
    }
  })

  return user
}
