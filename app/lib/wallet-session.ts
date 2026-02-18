/**
 * Secure wallet session management
 *
 * Stores wallet session tokens in httpOnly cookies (not localStorage)
 * to protect against XSS attacks.
 *
 * Session TTL: cookie maxAge is 2 hours; an absolute max of 24 hours
 * is enforced via connectedAt in getValidWalletSession().
 */
'use server'

import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface WalletSessionData {
  walletType?: 'simplysats' | 'brc100'
  sessionToken?: string
  identityKey?: string
  connectedAt?: number
}

/**
 * Get session password with security validation
 */
const getSessionPassword = (): string => {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('CRITICAL: SESSION_SECRET is required for wallet session security')
  }
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters for wallet session security. Generate one with: openssl rand -hex 32')
  }
  return secret
}

const WALLET_SESSION_OPTIONS = {
  password: getSessionPassword(),
  cookieName: 'wrootz_wallet',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 2, // 2 hours
    path: '/',
  },
}

/**
 * Get the wallet session instance
 */
export async function getWalletSession(): Promise<IronSession<WalletSessionData>> {
  const cookieStore = await cookies()
  return getIronSession<WalletSessionData>(cookieStore, WALLET_SESSION_OPTIONS)
}

/** Absolute maximum session lifetime: 24 hours from initial connection */
const SESSION_ABSOLUTE_MAX_MS = 24 * 60 * 60 * 1000

/**
 * Get the wallet session with connectedAt TTL enforcement.
 *
 * Returns null (and destroys the session) when:
 * - The session has no connectedAt timestamp, or
 * - More than 24 hours have elapsed since connectedAt (absolute max TTL).
 *
 * Use this in preference to getWalletSession() whenever the session must
 * be trusted for security-sensitive operations.
 */
export async function getValidWalletSession(): Promise<IronSession<WalletSessionData> | null> {
  const session = await getWalletSession()

  if (!session.connectedAt) {
    // No connectedAt recorded — treat as invalid
    session.destroy()
    return null
  }

  if (Date.now() - session.connectedAt > SESSION_ABSOLUTE_MAX_MS) {
    // Session has exceeded the 24-hour absolute maximum
    session.destroy()
    return null
  }

  return session
}

/**
 * Save wallet connection data securely
 */
export async function saveWalletConnection(data: {
  walletType: 'simplysats' | 'brc100'
  sessionToken: string
  identityKey: string
}): Promise<void> {
  const session = await getWalletSession()
  session.walletType = data.walletType
  session.sessionToken = data.sessionToken
  session.identityKey = data.identityKey
  session.connectedAt = Date.now()
  await session.save()
}

/**
 * Get full wallet connection info.
 *
 * Returns { connected: false } when the session is absent, invalid, or has
 * exceeded the 24-hour absolute TTL enforced by getValidWalletSession().
 */
export async function getWalletConnectionInfo(): Promise<{
  connected: boolean
  walletType?: 'simplysats' | 'brc100'
  identityKey?: string
  connectedAt?: number
}> {
  const session = await getValidWalletSession()
  if (!session || !session.sessionToken || !session.identityKey) {
    return { connected: false }
  }
  return {
    connected: true,
    walletType: session.walletType,
    identityKey: session.identityKey,
    connectedAt: session.connectedAt,
  }
}

/**
 * Clear wallet session (disconnect)
 */
export async function clearWalletSession(): Promise<void> {
  const session = await getWalletSession()
  session.destroy()
}
