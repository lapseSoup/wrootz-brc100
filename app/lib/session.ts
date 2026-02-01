import { cookies } from 'next/headers'

const SESSION_COOKIE_NAME = 'wrootz_session'

export interface SessionData {
  userId: string
  username: string
}

// Simple session management using cookies
// In production, use a proper session library like iron-session

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (!sessionCookie) return null

  try {
    return JSON.parse(sessionCookie.value) as SessionData
  } catch {
    return null
  }
}

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  })
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}
