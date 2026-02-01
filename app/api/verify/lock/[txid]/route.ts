import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/app/lib/db'
import { verifyLock, type LockVerification } from '@/app/lib/blockchain-verify'

/**
 * GET /api/verify/lock/[txid]
 *
 * Verifies a lock transaction against the blockchain.
 * This is FREE - no transaction costs, just API calls to WhatsOnChain.
 *
 * Returns:
 * - verified: boolean - whether all checks passed
 * - details: LockVerification - detailed verification results
 * - lock: database lock record (for comparison)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ txid: string }> }
) {
  try {
    const { txid } = await params

    if (!txid || txid.length !== 64) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      )
    }

    // Find the lock in our database
    const lock = await prisma.lock.findFirst({
      where: { txid },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            inscriptionTxid: true
          }
        }
      }
    })

    if (!lock) {
      return NextResponse.json(
        { error: 'Lock not found in database' },
        { status: 404 }
      )
    }

    // Calculate expected unlock block
    const expectedUnlockBlock = lock.startBlock + lock.durationBlocks

    // Construct expected ordinal origin if post has inscription
    const expectedOrdinalOrigin = lock.post?.inscriptionTxid
      ? `${lock.post.inscriptionTxid}_0`
      : null

    // Verify against blockchain
    const verification = await verifyLock(
      txid,
      lock.satoshis,
      expectedUnlockBlock,
      expectedOrdinalOrigin
    )

    // Update lock verification status in database
    await prisma.lock.update({
      where: { id: lock.id },
      data: {
        verified: verification.verified,
        verifiedAt: new Date(),
        // Update confirmed based on whether tx exists
        confirmed: verification.txExists,
        // Store actual on-chain values for transparency
        onChainAmount: verification.onChainAmount ?? null,
        onChainUnlock: verification.onChainUnlockBlock ?? null
      }
    })

    return NextResponse.json({
      verified: verification.verified,
      details: verification,
      lock: {
        id: lock.id,
        txid: lock.txid,
        satoshis: lock.satoshis,
        startBlock: lock.startBlock,
        durationBlocks: lock.durationBlocks,
        expectedUnlockBlock,
        expired: lock.expired,
        postId: lock.postId,
        postTitle: lock.post?.title
      }
    })
  } catch (error) {
    console.error('Lock verification error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
