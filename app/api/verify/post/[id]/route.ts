import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/app/lib/db'
import { verifyLock, verifyInscription, type LockVerification } from '@/app/lib/blockchain-verify'

/**
 * GET /api/verify/post/[id]
 *
 * Verifies all locks for a post and the post's inscription.
 * This is FREE - no transaction costs, just API calls to WhatsOnChain.
 *
 * Returns verification status for:
 * - The post's inscription (is it a valid ordinal?)
 * - All locks on the post (do they exist with correct parameters?)
 * - Aggregate stats (total verified wrootz, verified lock count)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Find the post with its locks
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        locks: {
          where: { txid: { not: null } }, // Only locks with txids
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Verify inscription if exists
    let inscriptionVerification = null
    if (post.inscriptionTxid) {
      inscriptionVerification = await verifyInscription(post.inscriptionTxid)
    }

    // Verify each lock (with rate limiting to be nice to WhatsOnChain)
    const lockVerifications: Array<{
      lockId: string
      txid: string
      verification: LockVerification
    }> = []

    const ordinalOrigin = post.inscriptionTxid ? `${post.inscriptionTxid}_0` : null

    for (const lock of post.locks) {
      if (!lock.txid) continue

      const expectedUnlockBlock = lock.startBlock + lock.durationBlocks
      const verification = await verifyLock(
        lock.txid,
        lock.satoshis,
        expectedUnlockBlock,
        ordinalOrigin
      )

      lockVerifications.push({
        lockId: lock.id,
        txid: lock.txid,
        verification
      })

      // Update lock in database
      await prisma.lock.update({
        where: { id: lock.id },
        data: {
          verified: verification.verified,
          verifiedAt: new Date(),
          confirmed: verification.txExists,
          onChainAmount: verification.onChainAmount ?? null,
          onChainUnlock: verification.onChainUnlockBlock ?? null
        }
      })

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Calculate aggregate stats
    const verifiedLocks = lockVerifications.filter(lv => lv.verification.verified)
    const activeLocks = lockVerifications.filter(lv => lv.verification.isUnspent)

    // Sum verified wrootz (using on-chain amounts)
    const verifiedWrootz = verifiedLocks.reduce((sum, lv) => {
      const lock = post.locks.find((l: { id: string }) => l.id === lv.lockId)
      return sum + (lock?.currentTu ?? 0)
    }, 0)

    // Sum on-chain satoshis from verified unspent locks
    const verifiedActiveSatoshis = activeLocks
      .filter(lv => lv.verification.verified)
      .reduce((sum, lv) => sum + (lv.verification.onChainAmount ?? 0), 0)

    return NextResponse.json({
      postId: post.id,
      postTitle: post.title,

      inscription: inscriptionVerification
        ? {
            verified: inscriptionVerification.verified,
            txid: post.inscriptionTxid,
            details: inscriptionVerification
          }
        : null,

      locks: {
        total: post.locks.length,
        verified: verifiedLocks.length,
        active: activeLocks.length,
        verifiedWrootz,
        verifiedActiveSatoshis,
        details: lockVerifications
      },

      // Overall verification status
      fullyVerified:
        (!post.inscriptionTxid || inscriptionVerification?.verified) &&
        verifiedLocks.length === post.locks.length,

      verifiedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Post verification error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
