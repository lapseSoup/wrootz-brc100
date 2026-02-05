import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/app/lib/db'
import { getCurrentBlockHeight } from '@/app/lib/blockchain'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Get current block from blockchain
  let currentBlock = 0
  try {
    currentBlock = await getCurrentBlockHeight()
  } catch {
    // Fallback to cached value
    const cached = await prisma.blockchainState.findUnique({
      where: { id: 'singleton' }
    })
    currentBlock = cached?.currentBlock || 0
  }

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      creator: {
        select: { id: true, username: true }
      },
      owner: {
        select: { id: true, username: true }
      },
      locks: {
        include: {
          user: { select: { id: true, username: true } }
        },
        orderBy: { currentTu: 'desc' }
      },
      transactions: {
        include: {
          user: { select: { id: true, username: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 20 // Limit to recent transactions
      },
      incomingLinks: {
        where: { type: 'reply' },
        include: {
          sourcePost: {
            include: {
              creator: { select: { id: true, username: true } },
              owner: { select: { id: true, username: true } },
              locks: {
                where: { expired: false },
                select: { currentTu: true }
              },
              incomingLinks: {
                where: { type: 'reply' },
                select: { id: true }
              }
            }
          }
        }
      }
    }
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Separate active and expired locks
  const activeLocks = post.locks.filter(l => !l.expired)
  const expiredLocks = post.locks.filter(l => l.expired)

  // Calculate actual wrootz from active locks (more accurate than post.totalTu which may be stale)
  const actualTotalTu = activeLocks.reduce((sum, lock) => sum + lock.currentTu, 0)

  // Calculate tag wrootz
  const tagWrootz: Record<string, number> = {}
  for (const lock of activeLocks) {
    if (lock.tag) {
      tagWrootz[lock.tag] = (tagWrootz[lock.tag] || 0) + lock.currentTu
    }
  }
  const sortedTags = Object.entries(tagWrootz).sort((a, b) => b[1] - a[1])

  // Map replies with computed fields
  const replies = post.incomingLinks.map(link => ({
    ...link.sourcePost,
    replyCount: link.sourcePost.incomingLinks.length,
    linkCreatedAt: link.createdAt
  })).sort((a, b) => b.totalTu - a.totalTu)

  return NextResponse.json({
    ...post,
    // Override totalTu with the calculated value from active locks
    totalTu: actualTotalTu,
    activeLocks,
    expiredLocks,
    sortedTags,
    replies,
    transactions: post.transactions,
    currentBlock
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  })
}
