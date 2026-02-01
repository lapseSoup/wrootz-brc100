'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatWrootz } from '@/app/lib/constants'

interface Reply {
  id: string
  title: string
  body: string
  totalTu: number
  createdAt: Date
  creator: { id: string; username: string }
  owner: { id: string; username: string }
  locks: { currentTu: number }[]
  replyCount: number
}

interface RepliesListProps {
  replies: Reply[]
}

export default function RepliesList({ replies }: RepliesListProps) {
  const [sortBy, setSortBy] = useState<'wrootz' | 'newest'>('wrootz')

  if (replies.length === 0) {
    return null
  }

  const sortedReplies = [...replies].sort((a, b) => {
    if (sortBy === 'wrootz') {
      return b.totalTu - a.totalTu
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - new Date(date).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return new Date(date).toLocaleDateString()
  }

  return (
    <div>
      {/* Sort controls */}
      <div className="flex justify-end mb-4">
        <div className="inline-flex p-1 bg-[var(--surface-2)] rounded-lg">
          <button
            onClick={() => setSortBy('wrootz')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              sortBy === 'wrootz'
                ? 'bg-[var(--surface-1)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Top
          </button>
          <button
            onClick={() => setSortBy('newest')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              sortBy === 'newest'
                ? 'bg-[var(--surface-1)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Newest
          </button>
        </div>
      </div>

      {/* Replies list - cleaner styling */}
      <div className="space-y-1">
        {sortedReplies.map((reply) => (
          <Link
            key={reply.id}
            href={`/post/${reply.id}`}
            className="block group"
          >
            <div className="flex gap-3 p-3 -mx-3 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-sm font-medium">
                  {reply.creator.username[0].toUpperCase()}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">@{reply.creator.username}</span>
                  <span className="text-xs text-[var(--foreground-muted)]">
                    {formatRelativeTime(reply.createdAt)}
                  </span>
                  {reply.creator.username !== reply.owner.username && (
                    <span className="text-xs text-[var(--foreground-muted)]">
                      • owned by @{reply.owner.username}
                    </span>
                  )}
                </div>

                {/* Title if present */}
                {reply.title && (
                  <h4 className="font-medium text-sm mb-1 group-hover:text-[var(--primary)] transition-colors">
                    {reply.title}
                  </h4>
                )}

                {/* Body preview */}
                <p className="text-sm text-[var(--foreground-secondary)] line-clamp-2">
                  {reply.body}
                </p>

                {/* Meta footer */}
                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--foreground-muted)]">
                  {reply.totalTu > 0 && (
                    <span className="text-[var(--accent)] font-semibold">
                      {formatWrootz(reply.totalTu)} wrootz
                    </span>
                  )}
                  {reply.replyCount > 0 && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {reply.replyCount}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {reply.locks.length}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
