'use server'

import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

// Session configuration
const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_for_development_only',
  cookieName: 'wrootz_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  },
}

export interface SessionData {
  userId: string
  username: string
  isLoggedIn: boolean
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS)

  if (!session.isLoggedIn || !session.userId) {
    return null
  }

  return {
    userId: session.userId,
    username: session.username,
    isLoggedIn: session.isLoggedIn,
  }
}

export async function getIronSessionInstance(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS)
}

export async function setSession(data: { userId: string; username: string }): Promise<void> {
  const session = await getIronSessionInstance()
  session.userId = data.userId
  session.username = data.username
  session.isLoggedIn = true
  await session.save()
}

export async function clearSession(): Promise<void> {
  const session = await getIronSessionInstance()
  session.destroy()
}

// Helper to require authentication - returns session or throws
export async function requireAuth(): Promise<SessionData> {
  const session = await getSession()
  if (!session) {
    throw new Error('Authentication required')
  }
  return session
}
