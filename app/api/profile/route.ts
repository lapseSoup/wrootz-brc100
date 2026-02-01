import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import prisma from '@/app/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Get user with latest data
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      cachedBalance: true,
      cachedLockedAmount: true,
      walletAddress: true,
      walletType: true,
      createdAt: true
    }
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Get user's owned posts
  const ownedPosts = await prisma.post.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      title: true,
      body: true,
      totalTu: true,
      forSale: true,
      salePrice: true,
      locks: { where: { expired: false }, select: { id: true } }
    },
    orderBy: { totalTu: 'desc' }
  })

  // Get user's active locks
  const activeLocks = await prisma.lock.findMany({
    where: { userId: user.id, expired: false },
    include: {
      post: { select: { id: true, title: true, body: true, totalTu: true } }
    },
    orderBy: { currentTu: 'desc' }
  })

  // Get user's transaction history
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    include: {
      post: { select: { id: true, title: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  })

  return NextResponse.json({
    user,
    ownedPosts,
    activeLocks,
    transactions
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  })
}
