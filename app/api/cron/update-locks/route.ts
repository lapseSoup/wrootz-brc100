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
import { timingSafeEqual, createHash } from 'crypto'
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
  // Verify cron secret - required in all environments
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET is required. Set it in your environment variables.')
    return NextResponse.json(
      { error: 'CRON_SECRET is required' },
      { status: 401 }
    )
  }

  const authHeader = request.headers.get('authorization')
  const providedSecret = authHeader?.replace('Bearer ', '')

  const hashA = createHash('sha256').update(providedSecret ?? '').digest()
  const hashB = createHash('sha256').update(cronSecret).digest()
  if (!timingSafeEqual(hashA, hashB)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
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
