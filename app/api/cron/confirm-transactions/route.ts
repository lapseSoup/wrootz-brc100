/**
 * Cron endpoint for transaction confirmation tracking
 *
 * Checks unconfirmed transactions against the blockchain
 * and updates their confirmed status when they have 1+ confirmations.
 *
 * This endpoint can be called by:
 * - Vercel Cron (configured in vercel.json)
 * - External cron services (e.g., cron-job.org)
 * - Manual triggers for debugging
 *
 * Protected by optional CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server'
import { confirmTransactions } from '@/app/lib/lock-updater'

// For Vercel Cron
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for processing

/**
 * GET /api/cron/confirm-transactions
 *
 * Checks and confirms unconfirmed transactions.
 * Optionally protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret - required in production
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret && process.env.NODE_ENV === 'production') {
    console.error('CRON_SECRET is required in production')
    return NextResponse.json(
      { error: 'Server misconfiguration' },
      { status: 500 }
    )
  }
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const providedSecret = authHeader?.replace('Bearer ', '')

    if (providedSecret !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  try {
    const startTime = Date.now()
    const result = await confirmTransactions()
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      ...result,
      durationMs: duration,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Cron confirm transactions error:', error)
    return NextResponse.json(
      {
        error: 'Confirmation check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
