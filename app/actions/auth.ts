'use server'

import bcrypt from 'bcryptjs'
import prisma from '@/app/lib/db'
import { setSession, clearSession, getSession } from '@/app/lib/session'
// NOTE: STARTING_BALANCE not used in mainnet - users fund with real BSV
// import { STARTING_BALANCE } from '@/app/lib/constants'
import { redirect } from 'next/navigation'

export async function register(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!username || !password) {
    return { error: 'Username and password are required' }
  }

  if (username.length < 3 || username.length > 20) {
    return { error: 'Username must be between 3 and 20 characters' }
  }

  if (password.length < 4) {
    return { error: 'Password must be at least 4 characters' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  // Check if username exists
  const existingUser = await prisma.user.findUnique({
    where: { username: username.toLowerCase() }
  })

  if (existingUser) {
    return { error: 'Username already taken' }
  }

  // Hash password and create user
  const hashedPassword = await bcrypt.hash(password, 10)

  // On mainnet, users start with 0 balance - they fund via connected wallet
  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      password: hashedPassword,
      cachedBalance: 0,
      cachedLockedAmount: 0
    }
  })

  // Set session
  await setSession({ userId: user.id, username: user.username })

  redirect('/')
}

export async function login(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username and password are required' }
  }

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() }
  })

  if (!user) {
    return { error: 'Invalid username or password' }
  }

  const validPassword = await bcrypt.compare(password, user.password)

  if (!validPassword) {
    return { error: 'Invalid username or password' }
  }

  // Set session
  await setSession({ userId: user.id, username: user.username })

  redirect('/')
}

export async function logout() {
  await clearSession()
  redirect('/')
}

export async function getCurrentUser() {
  const session = await getSession()

  if (!session) return null

  const [user, unreadNotifications] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        cachedBalance: true,
        cachedLockedAmount: true,
        walletAddress: true,
        walletType: true,
        isAdmin: true,
        createdAt: true
      }
    }),
    prisma.notification.count({
      where: { userId: session.userId, read: false }
    })
  ])

  if (!user) return null

  return { ...user, unreadNotifications }
}
