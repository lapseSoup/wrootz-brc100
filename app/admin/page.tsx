'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  checkIsAdmin,
  getAllUsers,
  getAllPosts,
  getAllLocks,
  grantBSV,
  deletePost,
  deleteLock,
  setAdminStatus,
  resetUserBalance,
  advanceBlocks,
  setBlockHeight,
  getBlockInfo
} from '@/app/actions/admin'
import { formatSats, bsvToSats, formatWrootz, blocksToTimeString } from '@/app/lib/constants'

interface User {
  id: string
  username: string
  cachedBalance: number
  cachedLockedAmount: number
  walletAddress: string | null
  walletType: string | null
  isAdmin: boolean
  createdAt: Date
  _count: {
    posts: number
    locks: number
  }
}

interface Post {
  id: string
  title: string
  totalTu: number
  forSale: boolean
  salePrice: number
  inscriptionId: string | null
  inscriptionTxid: string | null
  createdAt: Date
  creator: { username: string }
  owner: { username: string }
  _count: {
    locks: number
  }
}

interface Lock {
  id: string
  amount: number
  satoshis: number | null
  durationBlocks: number
  remainingBlocks: number
  initialTu: number
  currentTu: number
  tag: string | null
  txid: string | null
  lockAddress: string | null
  expired: boolean
  createdAt: Date
  user: { username: string }
  post: { id: string; title: string }
}

export default function AdminPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [locks, setLocks] = useState<Lock[]>([])
  const [currentBlock, setCurrentBlock] = useState(1)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Form states
  const [grantUsername, setGrantUsername] = useState('')
  const [grantAmount, setGrantAmount] = useState('10')
  const [resetUsername, setResetUsername] = useState('')
  const [resetBalance, setResetBalance] = useState('10')
  const [adminUsername, setAdminUsername] = useState('')
  const [blocksToAdvance, setBlocksToAdvance] = useState('1')
  const [newBlockHeight, setNewBlockHeight] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const adminCheck = await checkIsAdmin()
    setIsAdmin(adminCheck.isAdmin)

    if (adminCheck.isAdmin) {
      const [usersResult, postsResult, locksResult, blockInfo] = await Promise.all([
        getAllUsers(),
        getAllPosts(),
        getAllLocks(),
        getBlockInfo()
      ])
      if (usersResult.users) setUsers(usersResult.users)
      if (postsResult.posts) setPosts(postsResult.posts)
      if (locksResult.locks) setLocks(locksResult.locks)
      setCurrentBlock(blockInfo.currentBlock)
      setNewBlockHeight(String(blockInfo.currentBlock))
    }
  }

  async function handleAction(action: () => Promise<{ success?: boolean; error?: string; message?: string }>) {
    setLoading(true)
    setError('')
    setMessage('')

    const result = await action()

    if (result.error) {
      setError(result.error)
    } else if (result.message) {
      setMessage(result.message)
      loadData() // Refresh data
    }

    setLoading(false)
  }

  if (isAdmin === null) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold text-[var(--danger)] mb-4">Access Denied</h1>
        <p className="text-[var(--muted)] mb-4">You need admin privileges to access this page.</p>
        <button onClick={() => router.push('/')} className="btn btn-primary">
          Go Home
        </button>
      </div>
    )
  }

  const activeLocks = locks.filter(l => !l.expired)
  const expiredLocks = locks.filter(l => l.expired)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <span className="px-3 py-1 bg-[var(--danger)] text-white text-sm rounded-full font-medium">
          Admin Mode
        </span>
      </div>

      {/* Messages */}
      {message && (
        <div className="p-4 bg-[var(--accent)] text-white rounded-lg">
          {message}
        </div>
      )}
      {error && (
        <div className="p-4 bg-[var(--danger)] text-white rounded-lg">
          {error}
        </div>
      )}

      {/* Current Block Display */}
      <div className="card bg-[var(--primary)] text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Current Block Height</h2>
            <p className="text-3xl font-bold">#{currentBlock}</p>
            <p className="text-sm opacity-75">1 block = 10 minutes (like Bitcoin)</p>
          </div>
          <button
            onClick={() => {
              const formData = new FormData()
              formData.set('blocks', '1')
              handleAction(() => advanceBlocks(formData))
            }}
            disabled={loading}
            className="btn bg-white text-[var(--primary)] hover:bg-opacity-90 text-lg px-6 py-3"
          >
            +1 Block
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Block Controls */}
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Block Controls</h2>
          <div className="space-y-4">
            {/* Set Block Height */}
            <div>
              <label className="label">Set Block Height Directly</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newBlockHeight}
                  onChange={(e) => setNewBlockHeight(e.target.value)}
                  className="input flex-1"
                  placeholder="Enter block height"
                  min="1"
                />
                <button
                  onClick={() => {
                    const formData = new FormData()
                    formData.set('blockHeight', newBlockHeight)
                    handleAction(() => setBlockHeight(formData))
                  }}
                  disabled={loading || !newBlockHeight || parseInt(newBlockHeight) <= 0}
                  className="btn btn-primary"
                >
                  Set
                </button>
              </div>
            </div>

            {/* Advance Multiple Blocks */}
            <div>
              <label className="label">Advance Multiple Blocks</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={blocksToAdvance}
                  onChange={(e) => setBlocksToAdvance(e.target.value)}
                  className="input flex-1"
                  placeholder="Number of blocks"
                  min="1"
                />
                <button
                  onClick={() => {
                    const formData = new FormData()
                    formData.set('blocks', blocksToAdvance)
                    handleAction(() => advanceBlocks(formData))
                  }}
                  disabled={loading || !blocksToAdvance}
                  className="btn btn-accent"
                >
                  Advance
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="label">Quick Advance</label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    const formData = new FormData()
                    formData.set('blocks', '6')
                    handleAction(() => advanceBlocks(formData))
                  }}
                  disabled={loading}
                  className="btn btn-secondary text-xs"
                >
                  +1 hr
                </button>
                <button
                  onClick={() => {
                    const formData = new FormData()
                    formData.set('blocks', '144')
                    handleAction(() => advanceBlocks(formData))
                  }}
                  disabled={loading}
                  className="btn btn-secondary text-xs"
                >
                  +1 day
                </button>
                <button
                  onClick={() => {
                    const formData = new FormData()
                    formData.set('blocks', '1008')
                    handleAction(() => advanceBlocks(formData))
                  }}
                  disabled={loading}
                  className="btn btn-secondary text-xs"
                >
                  +1 week
                </button>
                <button
                  onClick={() => {
                    const formData = new FormData()
                    formData.set('blocks', '4320')
                    handleAction(() => advanceBlocks(formData))
                  }}
                  disabled={loading}
                  className="btn btn-secondary text-xs"
                >
                  +1 month
                </button>
              </div>
            </div>

            <p className="text-xs text-[var(--muted)]">
              Advancing blocks will expire locks and update wrootz accordingly. Expired locks get refunded.
            </p>
          </div>
        </div>

        {/* Grant BSV */}
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Grant BSV</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={grantUsername}
              onChange={(e) => setGrantUsername(e.target.value)}
              className="input"
              placeholder="Username"
            />
            <input
              type="number"
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value)}
              className="input"
              placeholder="Amount (BSV)"
              step="0.1"
              min="0.1"
            />
            <button
              onClick={() => {
                const formData = new FormData()
                formData.set('username', grantUsername)
                formData.set('amount', grantAmount)
                handleAction(() => grantBSV(formData))
              }}
              disabled={loading || !grantUsername || !grantAmount}
              className="btn btn-accent w-full"
            >
              Grant BSV
            </button>
          </div>
        </div>

        {/* Reset Balance */}
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Reset User Balance</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={resetUsername}
              onChange={(e) => setResetUsername(e.target.value)}
              className="input"
              placeholder="Username"
            />
            <input
              type="number"
              value={resetBalance}
              onChange={(e) => setResetBalance(e.target.value)}
              className="input"
              placeholder="New Balance (BSV)"
              step="0.1"
              min="0"
            />
            <button
              onClick={() => {
                const formData = new FormData()
                formData.set('username', resetUsername)
                formData.set('balance', resetBalance)
                handleAction(() => resetUserBalance(formData))
              }}
              disabled={loading || !resetUsername}
              className="btn btn-primary w-full"
            >
              Reset Balance
            </button>
          </div>
        </div>

        {/* Set Admin */}
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Manage Admin Status</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              className="input"
              placeholder="Username"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const formData = new FormData()
                  formData.set('username', adminUsername)
                  formData.set('isAdmin', 'true')
                  handleAction(() => setAdminStatus(formData))
                }}
                disabled={loading || !adminUsername}
                className="btn btn-accent flex-1"
              >
                Make Admin
              </button>
              <button
                onClick={() => {
                  const formData = new FormData()
                  formData.set('username', adminUsername)
                  formData.set('isAdmin', 'false')
                  handleAction(() => setAdminStatus(formData))
                }}
                disabled={loading || !adminUsername}
                className="btn btn-danger flex-1"
              >
                Remove Admin
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">All Users ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                <th className="text-left py-2 px-2">Username</th>
                <th className="text-right py-2 px-2">Balance</th>
                <th className="text-right py-2 px-2">Locked</th>
                <th className="text-right py-2 px-2">Posts</th>
                <th className="text-right py-2 px-2">Locks</th>
                <th className="text-center py-2 px-2">Admin</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[var(--card-border)] hover:bg-[var(--background)]">
                  <td className="py-2 px-2 font-medium">@{user.username}</td>
                  <td className="py-2 px-2 text-right text-[var(--accent)]">{formatSats(bsvToSats(user.cachedBalance || 0))} sats</td>
                  <td className="py-2 px-2 text-right">{formatSats(bsvToSats(user.cachedLockedAmount || 0))} sats</td>
                  <td className="py-2 px-2 text-right">{user._count.posts}</td>
                  <td className="py-2 px-2 text-right">{user._count.locks}</td>
                  <td className="py-2 px-2 text-center">
                    {user.isAdmin && (
                      <span className="px-2 py-0.5 bg-[var(--danger)] text-white text-xs rounded-full">
                        Admin
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Posts Table */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">All Posts ({posts.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                <th className="text-left py-2 px-2">Title</th>
                <th className="text-right py-2 px-2">Wrootz</th>
                <th className="text-right py-2 px-2">Locks</th>
                <th className="text-left py-2 px-2">Owner</th>
                <th className="text-center py-2 px-2">For Sale</th>
                <th className="text-center py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-[var(--card-border)] hover:bg-[var(--background)]">
                  <td className="py-2 px-2">
                    <a href={`/post/${post.id}`} className="text-[var(--primary)] hover:underline">
                      {post.title.slice(0, 30)}{post.title.length > 30 ? '...' : ''}
                    </a>
                  </td>
                  <td className="py-2 px-2 text-right text-[var(--accent)] font-medium">{formatWrootz(post.totalTu)}</td>
                  <td className="py-2 px-2 text-right">{post._count.locks}</td>
                  <td className="py-2 px-2">@{post.owner.username}</td>
                  <td className="py-2 px-2 text-center">
                    {post.forSale && (
                      <span className="text-[var(--accent)]">{formatSats(bsvToSats(post.salePrice))} sats</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => {
                        if (confirm(`Delete post "${post.title}"? All active locks will be refunded.`)) {
                          const formData = new FormData()
                          formData.set('postId', post.id)
                          handleAction(() => deletePost(formData))
                        }
                      }}
                      className="text-xs text-[var(--danger)] hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Locks Table */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Active Locks ({activeLocks.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                <th className="text-left py-2 px-2">User</th>
                <th className="text-left py-2 px-2">Post</th>
                <th className="text-right py-2 px-2">Amount</th>
                <th className="text-right py-2 px-2">Wrootz</th>
                <th className="text-right py-2 px-2">Remaining</th>
                <th className="text-left py-2 px-2">Tag</th>
                <th className="text-center py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeLocks.map((lock) => (
                <tr key={lock.id} className="border-b border-[var(--card-border)] hover:bg-[var(--background)]">
                  <td className="py-2 px-2 font-medium">@{lock.user.username}</td>
                  <td className="py-2 px-2">
                    <a href={`/post/${lock.post.id}`} className="text-[var(--primary)] hover:underline">
                      {lock.post.title.slice(0, 20)}{lock.post.title.length > 20 ? '...' : ''}
                    </a>
                  </td>
                  <td className="py-2 px-2 text-right text-[var(--accent)]">{formatSats(bsvToSats(lock.amount))} sats</td>
                  <td className="py-2 px-2 text-right">{formatWrootz(lock.currentTu)}</td>
                  <td className="py-2 px-2 text-right text-[var(--muted)]">{blocksToTimeString(lock.remainingBlocks)}</td>
                  <td className="py-2 px-2">
                    {lock.tag && <span className="tag">#{lock.tag}</span>}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => {
                        if (confirm(`Delete lock by @${lock.user.username} on "${lock.post.title}"? ${formatSats(bsvToSats(lock.amount))} sats will be refunded to the user.`)) {
                          const formData = new FormData()
                          formData.set('lockId', lock.id)
                          handleAction(() => deleteLock(formData))
                        }
                      }}
                      className="text-xs text-[var(--danger)] hover:underline"
                    >
                      Delete & Refund
                    </button>
                  </td>
                </tr>
              ))}
              {activeLocks.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-[var(--muted)]">
                    No active locks
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expired Locks Table */}
      {expiredLocks.length > 0 && (
        <div className="card opacity-75">
          <h2 className="font-semibold text-lg mb-4 text-[var(--muted)]">Expired Locks ({expiredLocks.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  <th className="text-left py-2 px-2">User</th>
                  <th className="text-left py-2 px-2">Post</th>
                  <th className="text-right py-2 px-2">Amount</th>
                  <th className="text-left py-2 px-2">Tag</th>
                  <th className="text-center py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expiredLocks.slice(0, 10).map((lock) => (
                  <tr key={lock.id} className="border-b border-[var(--card-border)] hover:bg-[var(--background)]">
                    <td className="py-2 px-2 text-[var(--muted)]">@{lock.user.username}</td>
                    <td className="py-2 px-2 text-[var(--muted)]">
                      {lock.post.title.slice(0, 20)}{lock.post.title.length > 20 ? '...' : ''}
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--muted)]">{formatSats(bsvToSats(lock.amount))} sats</td>
                    <td className="py-2 px-2 text-[var(--muted)]">
                      {lock.tag && `#${lock.tag}`}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => {
                          if (confirm(`Delete expired lock record?`)) {
                            const formData = new FormData()
                            formData.set('lockId', lock.id)
                            handleAction(() => deleteLock(formData))
                          }
                        }}
                        className="text-xs text-[var(--muted)] hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expiredLocks.length > 10 && (
              <p className="text-xs text-[var(--muted)] mt-2 text-center">
                Showing 10 of {expiredLocks.length} expired locks
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
