import { getPostById, getReplies, getReplyParent } from '@/app/actions/posts'
import { getCurrentUser } from '@/app/actions/auth'
import { getCurrentBlockHeight } from '@/app/lib/blockchain'
import { notFound } from 'next/navigation'
import PostPageClient from './PostPageClient'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const post = await getPostById(id)

  if (!post) {
    return { title: 'Post Not Found | Wrootz' }
  }

  const title = `${post.title || 'Post'} | Wrootz`
  const description = post.body
    ? post.body.length > 160 ? post.body.slice(0, 160) + '...' : post.body
    : 'A post on Wrootz'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(post.imageUrl ? { images: [post.imageUrl] } : {}),
    },
    twitter: {
      card: post.imageUrl ? 'summary_large_image' : 'summary',
    },
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [post, replies, replyParent, user, currentBlock] = await Promise.all([
    getPostById(id),
    getReplies(id),
    getReplyParent(id),
    getCurrentUser(),
    getCurrentBlockHeight().catch(() => 0)  // Fallback to 0 if API fails
  ])

  if (!post) {
    notFound()
  }

  // Separate active and expired locks
  const activeLocks = post.locks.filter(l => !l.expired)
  const expiredLocks = post.locks.filter(l => l.expired)

  // Calculate tag wrootz
  const tagWrootz: Record<string, number> = {}
  for (const lock of activeLocks) {
    if (lock.tag) {
      tagWrootz[lock.tag] = (tagWrootz[lock.tag] || 0) + lock.currentTu
    }
  }
  const sortedTags = Object.entries(tagWrootz).sort((a, b) => b[1] - a[1])

  // Map replies to expected format
  const formattedReplies = replies.map(reply => ({
    ...reply,
    createdAt: reply.createdAt.toISOString(),
    locks: reply.locks || []
  }))

  return (
    <PostPageClient
      initialPost={{
        id: post.id,
        title: post.title,
        body: post.body,
        imageUrl: post.imageUrl,
        videoUrl: post.videoUrl,
        totalTu: post.totalTu,
        forSale: post.forSale,
        salePrice: post.salePrice,
        lockerSharePercentage: post.lockerSharePercentage,
        createdAt: post.createdAt.toISOString(),
        creator: post.creator,
        owner: post.owner,
        ownerId: post.ownerId,
        // 1Sat Ordinal data
        inscriptionId: post.inscriptionId,
        inscriptionTxid: post.inscriptionTxid,
        contentHash: post.contentHash,
        listedAt: post.listedAt ? post.listedAt.toISOString() : null
      }}
      initialActiveLocks={activeLocks.map(l => ({
        ...l,
        createdAt: l.createdAt.toISOString()
      }))}
      initialExpiredLocks={expiredLocks.map(l => ({
        ...l,
        createdAt: l.createdAt.toISOString()
      }))}
      initialSortedTags={sortedTags}
      initialReplies={formattedReplies}
      initialTransactions={(post.transactions || []).map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString()
      }))}
      initialCurrentBlock={currentBlock}
      user={user ? {
        id: user.id,
        username: user.username,
        cachedBalance: user.cachedBalance
      } : null}
      replyParent={replyParent}
    />
  )
}
