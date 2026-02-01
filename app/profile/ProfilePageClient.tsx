'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatSats, bsvToSats, formatWrootz, blocksToTimeString } from '@/app/lib/constants'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import MyLocks from '@/app/components/MyLocks'

interface User {
  id: string
  username: string
  cachedBalance: number
  cachedLockedAmount: number
  walletAddress: string | null
  walletType: string | null
  createdAt: string
}

interface OwnedPost {
  id: string
  title: string
  body: string
  totalTu: number
  forSale: boolean
  salePrice: number | null
  locks: { id: string }[]
}

interface Lock {
  id: string
  amount: number
  currentTu: number
  remainingBlocks: number
  tag: string | null
  postId: string
  post: {
    id: string
    title: string
    body: string
    totalTu: number
  } | null
}

interface Transaction {
  id: string
  action: string
  amount: number
  description: string | null
  createdAt: string
  post: { id: string; title: string } | null
}

interface ProfilePageClientProps {
  initialUser: User
  initialOwnedPosts: OwnedPost[]
  initialActiveLocks: Lock[]
  initialTransactions: Transaction[]
}

export default function ProfilePageClient({
  initialUser,
  initialOwnedPosts,
  initialActiveLocks,
  initialTransactions
}: ProfilePageClientProps) {
  const [user, setUser] = useState(initialUser)
  const [ownedPosts, setOwnedPosts] = useState(initialOwnedPosts)
  const [activeLocks, setActiveLocks] = useState(initialActiveLocks)
  const [transactions, setTransactions] = useState(initialTransactions)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) return

      const data = await res.json()
      setUser(data.user)
      setOwnedPosts(data.ownedPosts)
      setActiveLocks(data.activeLocks)
      setTransactions(data.transactions)
    } catch (err) {
      console.error('Failed to fetch profile updates:', err)
    }
  }, [])

  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">@{user.username}</h1>
            <p className="text-[var(--muted)] text-sm">
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
          <form action={logout}>
            <button type="submit" className="btn btn-secondary text-sm">
              Logout
            </button>
          </form>
        </div>

        {/* Wallet Info */}
        {user.walletAddress && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--foreground-muted)]">Wallet:</span>
              <span className="font-mono text-xs">{user.walletAddress.slice(0, 10)}...{user.walletAddress.slice(-8)}</span>
              <span className="text-xs text-[var(--primary)]">({user.walletType})</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Balance (cached)</p>
            <p className="text-xl font-bold text-[var(--accent)]">{formatSats(bsvToSats(user.cachedBalance))} sats</p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Locked (cached)</p>
            <p className="text-xl font-bold">{formatSats(bsvToSats(user.cachedLockedAmount))} sats</p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Posts Owned</p>
            <p className="text-xl font-bold">{ownedPosts.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Active Locks</p>
            <p className="text-xl font-bold">{activeLocks.length}</p>
          </div>
        </div>
      </div>

      {/* Owned Posts */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Posts I Own ({ownedPosts.length})</h2>
        {ownedPosts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[var(--muted)] mb-4">You don&apos;t own any posts yet</p>
            <Link href="/create" className="btn btn-primary">
              Create Post
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {ownedPosts.map((post) => {
              const displayTitle = post.title || 'Untitled post'
              const bodyPreview = post.body ? (post.body.length > 80 ? post.body.slice(0, 80) + '...' : post.body) : ''
              return (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)] hover:bg-opacity-75 transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <h3 className="font-medium truncate">{displayTitle}</h3>
                    {bodyPreview && (
                      <p className="text-sm text-[var(--foreground-muted)] truncate mt-0.5">
                        {bodyPreview}
                      </p>
                    )}
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {post.locks.length} active lock{post.locks.length !== 1 ? 's' : ''}
                      {post.forSale && ` | For sale: ${formatSats(bsvToSats(post.salePrice || 0))} sats`}
                    </p>
                  </div>
                  <div className="wrootz-badge flex-shrink-0">{formatWrootz(post.totalTu)} wrootz</div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* On-Chain Wallet Locks (BRC-100) */}
      <MyLocks />

      {/* Active Locks (Database) */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">My Active Locks ({activeLocks.length})</h2>
        {activeLocks.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-6">
            You haven&apos;t locked BSV on any posts yet
          </p>
        ) : (
          <div className="space-y-3">
            {activeLocks.map((lock) => {
              const wrootzShare = lock.post && lock.post.totalTu > 0
                ? (lock.currentTu / lock.post.totalTu) * 100
                : 0
              const postTitle = lock.post?.title
              const postBody = lock.post?.body || ''
              const displayTitle = postTitle || (postBody.length > 60 ? postBody.slice(0, 60) + '...' : postBody) || 'Unknown post'
              return (
                <Link
                  key={lock.id}
                  href={`/post/${lock.postId}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)] hover:bg-opacity-75 transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <h3 className="font-medium truncate">{displayTitle}</h3>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--muted)] mt-1">
                      <span>{formatSats(bsvToSats(lock.amount))} sats</span>
                      <span>|</span>
                      <span>{blocksToTimeString(lock.remainingBlocks)} remaining</span>
                      {lock.tag && (
                        <>
                          <span>|</span>
                          <span className="tag">#{lock.tag}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="wrootz-badge text-sm">{formatWrootz(lock.currentTu)} wrootz</div>
                    <p className="text-xs text-[var(--muted)] mt-1">{wrootzShare.toFixed(1)}% share</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Recent Transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-6">
            No transactions yet
          </p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: tx.action === 'Profit' ? 'rgba(16, 185, 129, 0.2)' :
                        tx.action === 'Lock' ? 'rgba(59, 130, 246, 0.2)' :
                        tx.action === 'Buy' ? 'rgba(249, 115, 22, 0.2)' :
                        tx.action === 'Create' ? 'rgba(168, 85, 247, 0.2)' :
                        'rgba(148, 163, 184, 0.2)',
                      color: tx.action === 'Profit' ? 'var(--accent)' :
                        tx.action === 'Lock' ? 'var(--primary)' :
                        tx.action === 'Buy' ? '#f97316' :
                        tx.action === 'Create' ? '#a855f7' :
                        'var(--muted)'
                    }}
                  >
                    {tx.action[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tx.action}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {tx.description || ''}
                      {tx.post && (
                        <Link href={`/post/${tx.post.id}`} className="text-[var(--primary)] hover:underline ml-1">
                          View post
                        </Link>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {tx.amount > 0 && (
                    <p className={`font-medium ${tx.action === 'Profit' ? 'text-[var(--accent)]' : ''}`}>
                      {tx.action === 'Profit' ? '+' : ''}{formatSats(bsvToSats(tx.amount))} sats
                    </p>
                  )}
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
