'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatWrootz, formatSats, bsvToSats, blocksToTimeString, BLOCKS_PER_HOUR, BLOCKS_PER_DAY } from '@/app/lib/constants'
import type { Lock } from '@/app/lib/types'

interface SidebarLocksProps {
  locks: Lock[]
  totalTu?: number // Deprecated - now calculated from locks
}

function CompactLockItem({ lock, totalTu }: { lock: Lock; totalTu: number }) {
  const [expanded, setExpanded] = useState(false)
  const share = totalTu > 0 ? (lock.currentTu / totalTu) * 100 : 0

  // Calculate decay rates
  const decayRatePerBlock = lock.initialTu / lock.durationBlocks
  const decayRatePerHour = decayRatePerBlock * BLOCKS_PER_HOUR
  const decayRatePerDay = decayRatePerBlock * BLOCKS_PER_DAY
  const percentRemaining = lock.initialTu > 0 ? (lock.currentTu / lock.initialTu) * 100 : 0

  return (
    <div
      className="py-2.5 px-2.5 -mx-2.5 rounded-lg cursor-pointer transition-colors hover:bg-[var(--surface-2)] border-b border-[var(--border)] last:border-b-0"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header: username and tag */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link
            href={`/profile/${lock.user.username}`}
            className="font-medium text-sm hover:text-[var(--primary)] truncate"
            onClick={(e) => e.stopPropagation()}
          >
            @{lock.user.username}
          </Link>
          {lock.tag && (
            <span className="text-xs text-[var(--accent)]">#{lock.tag}</span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-[var(--foreground-muted)] transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs">
        <div>
          <span className="text-[var(--foreground-muted)]">Wrootz: </span>
          <span className="font-semibold text-[var(--accent)]">{formatWrootz(lock.currentTu)}</span>
        </div>
        <div>
          <span className="text-[var(--foreground-muted)]">Share: </span>
          <span className="font-medium">{share.toFixed(1)}%</span>
        </div>
      </div>

      {/* Secondary info */}
      <div className="text-[10px] text-[var(--foreground-muted)] mt-1">
        {formatSats(bsvToSats(lock.amount))} sats locked · {blocksToTimeString(lock.remainingBlocks)} remaining
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-[var(--foreground-muted)]">Started with:</span>
            <span className="font-medium">{formatWrootz(lock.initialTu)} wrootz</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--foreground-muted)]">Decayed to:</span>
            <span className="font-medium">{percentRemaining.toFixed(1)}% of original</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--foreground-muted)]">Lock duration:</span>
            <span className="font-medium">{blocksToTimeString(lock.durationBlocks)}</span>
          </div>
          <div className="p-2 rounded bg-[var(--surface-2)]">
            <p className="text-[var(--foreground-muted)] font-medium mb-1">Decay Rate:</p>
            <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
              <div>
                <p className="text-[var(--danger)]">-{formatWrootz(decayRatePerBlock)}</p>
                <p className="text-[var(--foreground-muted)]">/ block</p>
              </div>
              <div>
                <p className="text-[var(--danger)]">-{formatWrootz(decayRatePerHour)}</p>
                <p className="text-[var(--foreground-muted)]">/ hour</p>
              </div>
              <div>
                <p className="text-[var(--danger)]">-{formatWrootz(decayRatePerDay)}</p>
                <p className="text-[var(--foreground-muted)]">/ day</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SidebarLocks({ locks }: SidebarLocksProps) {
  const [showAll, setShowAll] = useState(false)
  const sortedLocks = [...locks].sort((a, b) => b.currentTu - a.currentTu)
  const displayedLocks = showAll ? sortedLocks : sortedLocks.slice(0, 5)
  const hasMore = locks.length > 5

  // Calculate actual total from active locks (more accurate than post.totalTu which may not be synced)
  const actualTotalTu = locks.reduce((sum, lock) => sum + lock.currentTu, 0)

  return (
    <div>
      {/* Header explanation */}
      <p className="text-[10px] text-[var(--foreground-muted)] mb-2 pb-2 border-b border-[var(--border)]">
        Share = % of total wrootz on this post (determines profit split)
      </p>

      <div className="space-y-0">
        {displayedLocks.map((lock) => (
          <CompactLockItem key={lock.id} lock={lock} totalTu={actualTotalTu} />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-[var(--primary)] hover:underline w-full text-center pt-3"
        >
          {showAll ? 'Show less' : `Show all ${locks.length} locks`}
        </button>
      )}
      {locks.length === 0 && (
        <p className="text-xs text-[var(--foreground-muted)] text-center py-2">
          No active locks yet
        </p>
      )}
    </div>
  )
}
