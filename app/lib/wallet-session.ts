/**
 * Secure wallet session management
 *
 * Stores wallet session tokens in httpOnly cookies (not localStorage)
 * to protect against XSS attacks.
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
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: SESSION_SECRET required for wallet session')
    }
    return 'dev_secret_32_chars_for_local_only!'
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
    maxAge: 60 * 60 * 24 * 30, // 30 days
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
