/**
 * Secure wallet session management
 *
 * Stores wallet session tokens in httpOnly cookies (not localStorage)
 * to protect against XSS attacks.
 *
 * TODO (L14): Consider additional session hardening:
 * - Forced re-auth after sensitive operations (lock, send, inscribe)
 * - Sliding window expiry that extends on activity but caps at an absolute max
 * - connectedAt is tracked but not currently used for TTL enforcement
 */
'use server'

import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

interface WalletSessionData {
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
    maxAge: 60 * 60 * 8, // 8 hours
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
 * Get the stored wallet session token
 */
export async function getWalletToken(): Promise<string | null> {
  const session = await getWalletSession()
  return session.sessionToken || null
}

/**
 * Get the stored identity key
 */
export async function getWalletIdentityKey(): Promise<string | null> {
  const session = await getWalletSession()
  return session.identityKey || null
}

/**
 * Get full wallet connection info
 */
export async function getWalletConnectionInfo(): Promise<{
  connected: boolean
  walletType?: 'simplysats' | 'brc100'
  identityKey?: string
  connectedAt?: number
}> {
  const session = await getWalletSession()
  if (!session.sessionToken || !session.identityKey) {
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
