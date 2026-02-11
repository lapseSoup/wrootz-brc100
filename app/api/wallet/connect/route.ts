/**
 * Wallet connection API endpoints
 *
 * POST: Save wallet session token securely
 * DELETE: Clear wallet session (disconnect)
 * GET: Check wallet connection status
 */

import { NextRequest, NextResponse } from 'next/server'
import { saveWalletConnection, clearWalletSession, getWalletConnectionInfo } from '@/app/lib/wallet-session'
import { getSession } from '@/app/lib/session'

/**
 * Save wallet connection (POST)
 * Called after wallet authentication to store session token securely
 */
export async function POST(request: NextRequest) {
  // Require user authentication
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { walletType, sessionToken, identityKey } = body

    if (!walletType || !sessionToken || !identityKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['simplysats', 'brc100'].includes(walletType)) {
      return NextResponse.json({ error: 'Invalid wallet type' }, { status: 400 })
    }

    await saveWalletConnection({
      walletType,
      sessionToken,
      identityKey,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save wallet connection:', error)
    return NextResponse.json({ error: 'Failed to save wallet connection' }, { status: 500 })
  }
}

/**
 * Clear wallet connection (DELETE)
 * Called when disconnecting wallet
 */
export async function DELETE() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    await clearWalletSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to clear wallet session:', error)
    return NextResponse.json({ error: 'Failed to disconnect wallet' }, { status: 500 })
  }
}

/**
 * Get wallet connection status (GET)
 * Returns whether a wallet is connected and basic info
 */
export async function GET() {
  try {
    const info = await getWalletConnectionInfo()
    return NextResponse.json(info)
  } catch (error) {
    console.error('Failed to get wallet info:', error)
    return NextResponse.json({ connected: false })
  }
}
