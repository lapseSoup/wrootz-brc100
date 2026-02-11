/**
 * Cron endpoint for lock status updates
 *
 * This endpoint can be called by:
 * - Vercel Cron (configured in vercel.json)
 * - External cron services (e.g., cron-job.org)
 * - Manual triggers for debugging
 *
 * Protected by optional CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server'
import { forceUpdateLockStatuses } from '@/app/lib/lock-updater'

// For Vercel Cron
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for processing

/**
 * GET /api/cron/update-locks
 *
 * Triggers a lock status update.
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
  // L3: Warn when cron endpoint is unprotected in development
  if (!cronSecret && process.env.NODE_ENV !== 'production') {
    console.warn('WARNING: Cron endpoint is unprotected. Set CRON_SECRET for security.')
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
    const result = await forceUpdateLockStatuses()
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      ...result,
      durationMs: duration,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Cron lock update error:', error)
    return NextResponse.json(
      {
        error: 'Update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
