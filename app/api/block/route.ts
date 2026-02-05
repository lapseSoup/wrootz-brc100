import { NextRequest, NextResponse } from 'next/server'
import { getCurrentBlockHeight } from '@/app/lib/blockchain'
import prisma from '@/app/lib/db'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/app/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimit = await checkRateLimit(request, RATE_LIMITS.api)
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetIn)
  }

  try {
    // Get real BSV blockchain height
    const currentBlock = await getCurrentBlockHeight()

    // Update our cached block state
    await prisma.blockchainState.upsert({
      where: { id: 'singleton' },
      update: {
        currentBlock,
        lastSyncTime: new Date()
      },
      create: {
        id: 'singleton',
        currentBlock,
        lastSyncTime: new Date(),
        network: 'mainnet'
      }
    })

    // Estimate seconds until next block (~10 minutes average)
    // This is just an approximation since we don't know exactly when the last block was mined
    const secondsUntilNext = 600 // Default to 10 minutes

    return NextResponse.json(
      { currentBlock, secondsUntilNext, network: 'mainnet' },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        }
      }
    )
  } catch (error) {
    console.error('Error fetching block info:', error)

    // Try to return cached block from database
    try {
      const cached = await prisma.blockchainState.findUnique({
        where: { id: 'singleton' }
      })
      if (cached) {
        return NextResponse.json({
          currentBlock: cached.currentBlock,
          secondsUntilNext: 600,
          network: cached.network,
          cached: true
        })
      }
    } catch {
      // Database also failed
    }

    return NextResponse.json(
      { error: 'Failed to fetch block info' },
      { status: 500 }
    )
  }
}
