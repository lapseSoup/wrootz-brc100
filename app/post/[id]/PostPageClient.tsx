'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatWrootz, formatSats, bsvToSats, formatRelativeTime } from '@/app/lib/constants'
import LockForm from '@/app/components/LockForm'
import ReplyForm from '@/app/components/ReplyForm'
import TipForm from '@/app/components/TipForm'
import SaleActions from './SaleActions'
import SidebarLocks from './SidebarLocks'
import SidebarHistory from './SidebarHistory'
import TransactionHistory from './TransactionHistory'
import RepliesList from './RepliesList'
import YouTubeEmbed from '@/app/components/YouTubeEmbed'
import VerificationBadge from '@/app/components/VerificationBadge'
import type { Lock, Reply, Post, User, ReplyParent, Transaction } from '@/app/lib/types'

interface PostPageClientProps {
  initialPost: Post
  initialActiveLocks: Lock[]
  initialExpiredLocks: Lock[]
  initialSortedTags: [string, number][]
  initialReplies: Reply[]
  initialTransactions: Transaction[]
  initialCurrentBlock: number
  user: User | null
  replyParent: ReplyParent | null
}

export default function PostPageClient({
  initialPost,
  initialActiveLocks,
  initialExpiredLocks,
  initialSortedTags,
  initialReplies,
  initialTransactions,
  initialCurrentBlock,
  user,
  replyParent
}: PostPageClientProps) {
  const [post, setPost] = useState(initialPost)
  const [activeLocks, setActiveLocks] = useState(initialActiveLocks)
  const [expiredLocks, setExpiredLocks] = useState(initialExpiredLocks)
  const [sortedTags, setSortedTags] = useState(initialSortedTags)
  const [replies, setReplies] = useState(initialReplies)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [currentBlock, setCurrentBlock] = useState(initialCurrentBlock)
  const [userBalance, setUserBalance] = useState(user?.cachedBalance ?? 0)

  const isOwner = user?.id === post.ownerId

  // Calculate actual wrootz from active locks (more accurate than post.totalTu which may be stale)
  const actualTotalWrootz = useMemo(
    () => activeLocks.reduce((sum, lock) => sum + lock.currentTu, 0),
    [activeLocks]
  )

  // Fetch updated data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${post.id}`, { cache: 'no-store' })
      if (!res.ok) return

      const data = await res.json()

      setPost({
        id: data.id,
        title: data.title,
        body: data.body,
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        totalTu: data.totalTu,
        forSale: data.forSale,
        salePrice: data.salePrice,
        lockerSharePercentage: data.lockerSharePercentage,
        createdAt: data.createdAt,
        creator: data.creator,
        owner: data.owner,
        ownerId: data.ownerId,
        inscriptionId: data.inscriptionId,
        inscriptionTxid: data.inscriptionTxid,
        contentHash: data.contentHash,
        listedAt: data.listedAt ?? null
      })
      setActiveLocks(data.activeLocks)
      setExpiredLocks(data.expiredLocks)
      setSortedTags(data.sortedTags)
      setReplies(data.replies)
      setTransactions(data.transactions || [])
      setCurrentBlock(data.currentBlock)
    } catch (err) {
      console.error('Failed to fetch post updates:', err)
    }
  }, [post.id])

  // Also fetch user balance updates
  const fetchUserBalance = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch('/api/user/balance', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setUserBalance(data.cachedBalance || 0)
      }
    } catch {
      // Silently fail - balance API might not exist yet
    }
  }, [user])

  // Poll for updates only when tab is visible
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (interval) return
      interval = setInterval(() => {
        fetchData()
        fetchUserBalance()
      }, 10000) // 10 seconds instead of 5
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        fetchData() // Immediate refresh on tab focus
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchData, fetchUserBalance])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-5">
          {/* Reply parent indicator */}
          {replyParent && (
            <Link
              href={`/post/${replyParent.id}`}
              className="inline-flex items-center gap-2 text-sm text-[var(--foreground-muted)] hover:text-[var(--primary)] transition-colors px-3 py-1.5 rounded-lg bg-[var(--surface-2)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Replying to: <span className="text-[var(--foreground)] font-medium">{replyParent.title || `Post by @${replyParent.creator.username}`}</span>
            </Link>
          )}

          {/* Article Card */}
          <article className="card">
            {/* Header with title and wrootz */}
            <div className="flex items-start justify-between gap-4">
              {post.title && (
                <h1 className="text-headline flex-1">{post.title}</h1>
              )}
              <div className={`wrootz-badge-lg flex-shrink-0 ${!post.title ? 'ml-auto' : ''}`}>
                {formatWrootz(actualTotalWrootz)} wrootz
              </div>
            </div>

            {/* YouTube Video */}
            {post.videoUrl && (
              <div className="mt-5">
                <YouTubeEmbed url={post.videoUrl} title={post.title} />
              </div>
            )}

            {/* Image - show full image without cropping */}
            {post.imageUrl && (
              <div className="mt-5 -mx-5 bg-[var(--surface-2)] flex justify-center">
                <Image
                  src={post.imageUrl}
                  alt={post.title}
                  width={800}
                  height={600}
                  className="max-w-full max-h-[800px] w-auto h-auto object-contain"
                  unoptimized
                />
              </div>
            )}

            {/* Body */}
            <div className="mt-5 text-body text-[var(--foreground-secondary)] whitespace-pre-wrap leading-relaxed">
              {post.body}
            </div>


            {/* Meta footer */}
            <div className="mt-6 pt-5 border-t border-[var(--border)] flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-semibold">
                  {post.owner.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-[var(--foreground-muted)]">Owner</p>
                  <Link href={`/profile/${post.owner.username}`} className="font-medium hover:text-[var(--primary)] transition-colors">
                    @{post.owner.username}
                  </Link>
                </div>
              </div>
              {post.owner.username !== post.creator.username && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--foreground-muted)] flex items-center justify-center text-white font-semibold">
                    {post.creator.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs text-[var(--foreground-muted)]">Creator</p>
                    <Link href={`/profile/${post.creator.username}`} className="font-medium hover:text-[var(--primary)] transition-colors">
                      @{post.creator.username}
                    </Link>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-6 ml-auto">
                <div className="text-right">
                  <p className="text-xs text-[var(--foreground-muted)]">Posted</p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium">{formatRelativeTime(new Date(post.createdAt))}</p>
                    {post.inscriptionTxid && (
                      <a
                        href={`https://whatsonchain.com/tx/${post.inscriptionTxid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--foreground-muted)] hover:text-[var(--primary)] transition-colors"
                        title="View on blockchain"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--foreground-muted)]">Locker Share</p>
                  <p className="font-semibold text-[var(--accent)]">{post.lockerSharePercentage}%</p>
                </div>
              </div>
            </div>
          </article>

          {/* Sale status banner */}
          {post.forSale && (
            <div className="card border-2 border-[var(--accent)] bg-[var(--accent-light)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="font-semibold text-[var(--accent)]">For Sale</h3>
                  </div>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{formatSats(bsvToSats(post.salePrice || 0))} sats</p>
                  <p className="text-sm text-[var(--accent)] mt-1">
                    Lockers receive {post.lockerSharePercentage}% ({formatSats(bsvToSats((post.salePrice || 0) * post.lockerSharePercentage / 100))} sats)
                  </p>
                </div>
                {user && !isOwner && (
                  <SaleActions postId={post.id} action="buy" salePrice={post.salePrice ?? undefined} />
                )}
              </div>
            </div>
          )}

          {/* Reply Form - collapsible */}
          {user && (
            <div className="card-compact">
              <ReplyForm parentPostId={post.id} parentPostTitle={post.title} />
            </div>
          )}

          {/* Replies Section */}
          <div className="card">
            <div className="section-header">
              <h3 className="section-title">
                Replies {replies.length > 0 && <span className="text-[var(--foreground-muted)]">({replies.length})</span>}
              </h3>
            </div>
            {replies.length > 0 ? (
              <RepliesList replies={replies} />
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-[var(--foreground-muted)] text-sm">No replies yet</p>
                <p className="text-[var(--foreground-muted)] text-xs mt-1">Be the first to reply!</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - sticky */}
        <div className="space-y-4 md:sticky md:top-24 md:self-start">
          {/* Tags - at top */}
          {sortedTags.length > 0 && (
            <div className="card-compact">
              <div className="section-header">
                <h3 className="section-title text-sm">Tags</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {sortedTags.map(([tag, wrootz]) => (
                  <Link
                    key={tag}
                    href={`/tag/${encodeURIComponent(tag)}`}
                    className="tag-accent text-xs"
                  >
                    #{tag} ({formatWrootz(wrootz)})
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Lock Form */}
          {user ? (
            <div className="card">
              <div className="section-header">
                <h3 className="section-title">Add Wrootz</h3>
              </div>
              <LockForm
                postId={post.id}
                ordinalOrigin={post.inscriptionTxid ? `${post.inscriptionTxid}_0` : undefined}
              />
            </div>
          ) : null}

          {/* Owner Actions - Sell Content */}
          {isOwner && !post.forSale && (
            <div className="card-compact">
              <div className="section-header">
                <h3 className="section-title text-sm">Sell This Content</h3>
              </div>
              <SaleActions
                postId={post.id}
                action="list"
                currentLockerShare={post.lockerSharePercentage}
              />
            </div>
          )}

          {isOwner && post.forSale && (
            <div className="card-compact">
              <div className="section-header">
                <h3 className="section-title text-sm">Sale Status</h3>
              </div>
              {activeLocks.filter(lock =>
                post.listedAt ? new Date(lock.createdAt) > new Date(post.listedAt) : false
              ).length > 0 ? (
                <p className="text-sm text-[var(--foreground-muted)]">
                  Sale cannot be canceled while there are active locks placed after the listing. This protects lockers.
                </p>
              ) : (
                <SaleActions postId={post.id} action="cancel" />
              )}
            </div>
          )}

          {/* Tip Form - show for logged in users who aren't the owner */}
          {user && !isOwner && (
            <div className="card-compact">
              <div className="section-header">
                <h3 className="section-title text-sm">Tip Owner</h3>
              </div>
              <TipForm
                postId={post.id}
                ownerUsername={post.owner.username}
                userBalance={userBalance}
              />
            </div>
          )}

          {/* Login prompt for non-users */}
          {!user && (
            <div className="card text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--primary-light)] flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Want to add wrootz?</h3>
              <p className="text-sm text-[var(--foreground-muted)] mb-4">
                Login to lock BSV and earn from this content
              </p>
              <Link href="/login" className="btn btn-primary w-full">
                Login
              </Link>
            </div>
          )}

          {/* Active Locks */}
          {activeLocks.length > 0 && (
            <div className="card-compact">
              <div className="section-header">
                <h3 className="section-title text-sm">Active Locks ({activeLocks.length})</h3>
              </div>
              <SidebarLocks locks={activeLocks} totalTu={post.totalTu} />
            </div>
          )}

          {/* Wrootz History */}
          {(activeLocks.length > 0 || expiredLocks.length > 0) && (
            <div className="card-compact">
              <div className="section-header">
                <h3 className="section-title text-sm">Wrootz History</h3>
              </div>
              <SidebarHistory
                activeLocks={activeLocks}
                expiredLocks={expiredLocks}
                currentBlock={currentBlock}
              />
            </div>
          )}

          {/* Transaction History */}
          {transactions.length > 0 && (
            <div className="card-compact">
              <div className="section-header">
                <h3 className="section-title text-sm">Activity</h3>
              </div>
              <TransactionHistory transactions={transactions} />
            </div>
          )}

          {/* Blockchain Verification */}
          <div className="card-compact">
            <div className="section-header">
              <h3 className="section-title text-sm">On-Chain Verification</h3>
            </div>
            <VerificationBadge
              postId={post.id}
              inscriptionTxid={post.inscriptionTxid}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
