import { getCurrentUser } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import prisma from '@/app/lib/db'
import ProfilePageClient from './ProfilePageClient'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
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

  return (
    <ProfilePageClient
      initialUser={{
        id: user.id,
        username: user.username,
        cachedBalance: user.cachedBalance,
        cachedLockedAmount: user.cachedLockedAmount,
        walletAddress: user.walletAddress,
        walletType: user.walletType,
        createdAt: user.createdAt.toISOString()
      }}
      initialOwnedPosts={ownedPosts}
      initialActiveLocks={activeLocks.map(lock => ({
        ...lock,
        post: lock.post
      }))}
      initialTransactions={transactions.map(tx => ({
        ...tx,
        createdAt: tx.createdAt.toISOString()
      }))}
    />
  )
}
