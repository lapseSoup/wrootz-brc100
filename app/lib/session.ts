'use server'

import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

/**
 * Get session password with security validation
 * - Fails fast in production if SESSION_SECRET is not set
 * - Warns and uses dev fallback in development only
 */
const getSessionPassword = (): string => {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: SESSION_SECRET environment variable is required in production')
    }
    console.warn('WARNING: Using development session secret. Set SESSION_SECRET in .env')
    return 'dev_secret_32_chars_for_local_only!'
  }
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters')
  }
  return secret
}

// Session configuration
const SESSION_OPTIONS = {
  password: getSessionPassword(),
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
  // M10: Destroy existing session before setting new data to prevent session fixation
  session.destroy()
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
