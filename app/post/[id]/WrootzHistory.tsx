'use client'

import { useState, useMemo } from 'react'
import { formatWrootz, formatSats, bsvToSats } from '@/app/lib/constants'
import CollapsibleSection from '@/app/components/CollapsibleSection'
import Link from 'next/link'
import type { Lock } from '@/app/lib/types'
import {
  calculateWrootzHistory,
  generateAreaPath,
  generateLinePath,
  getSortedTags
} from '@/app/lib/utils/wrootz-calculations'

interface WrootzHistoryProps {
  activeLocks: Lock[]
  expiredLocks: Lock[]
  currentBlock: number
  embedded?: boolean
}

export default function WrootzHistory({ activeLocks, expiredLocks, currentBlock, embedded = false }: WrootzHistoryProps) {
  const [showAllExpired, setShowAllExpired] = useState(false)
  const allLocks = useMemo(() => [...activeLocks, ...expiredLocks], [activeLocks, expiredLocks])

  // Calculate total expired wrootz
  const totalExpiredWrootz = expiredLocks.reduce((sum, lock) => sum + lock.initialTu, 0)
  const totalExpiredSats = expiredLocks.reduce((sum, lock) => sum + lock.amount, 0)

  // Calculate historical wrootz data for graph using shared utility
  const graphData = useMemo(
    () => calculateWrootzHistory(allLocks, activeLocks, currentBlock, 50),
    [allLocks, activeLocks, currentBlock]
  )

  // Calculate graph dimensions
  const maxWrootz = Math.max(...graphData.map(d => d.wrootz), 1)
  const minBlock = graphData.length > 0 ? graphData[0].block : currentBlock

  // SVG paths using shared utilities
  const pathData = useMemo(
    () => generateAreaPath(graphData, minBlock, currentBlock, maxWrootz),
    [graphData, minBlock, currentBlock, maxWrootz]
  )

  const linePath = useMemo(
    () => generateLinePath(graphData, minBlock, currentBlock, maxWrootz),
    [graphData, minBlock, currentBlock, maxWrootz]
  )

  // Calculate expired tags using shared utility
  const sortedExpiredTags = useMemo(
    () => getSortedTags(expiredLocks, true),
    [expiredLocks]
  )

  if (allLocks.length === 0) {
    if (embedded) {
      return (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-[var(--foreground-muted)] text-sm">No history yet</p>
          <p className="text-[var(--foreground-muted)] text-xs mt-1">Lock BSV to start building history</p>
        </div>
      )
    }
    return null
  }

  const displayedExpiredLocks = showAllExpired ? expiredLocks : expiredLocks.slice(0, 5)

  const content = (
    <>
      {/* Graph */}
      {graphData.length >= 2 && (
        <div className="mb-4">
          <div className="relative h-32 bg-[var(--surface-2)] rounded-lg p-2">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {/* Grid lines */}
              <line x1="0" y1="25" x2="100" y2="25" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="75" x2="100" y2="75" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" />

              {/* Area fill */}
              <path
                d={pathData}
                fill="var(--primary)"
                fillOpacity="0.2"
              />

              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-[var(--foreground-muted)] -ml-1">
              <span>{formatWrootz(maxWrootz)}</span>
              <span>{formatWrootz(maxWrootz / 2)}</span>
              <span>0</span>
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between text-[10px] text-[var(--foreground-muted)] mt-1 px-2">
            <span>Block #{minBlock}</span>
            <span>Block #{currentBlock}</span>
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-[var(--surface-2)]">
          <p className="text-xs text-[var(--foreground-muted)]">Current Wrootz</p>
          <p className="text-lg font-bold text-[var(--primary)]">
            {formatWrootz(activeLocks.reduce((sum, l) => sum + l.currentTu, 0))}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-[var(--surface-2)]">
          <p className="text-xs text-[var(--foreground-muted)]">Expired Wrootz</p>
          <p className="text-lg font-bold text-[var(--foreground-muted)]">
            {formatWrootz(totalExpiredWrootz)}
          </p>
        </div>
      </div>

      {/* Expired Tags */}
      {sortedExpiredTags.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-[var(--foreground-muted)] mb-2">Historical Tags</p>
          <div className="flex flex-wrap gap-2">
            {sortedExpiredTags.map(([tag, wrootz]) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag)}`}
                className="tag-muted text-xs opacity-60 hover:opacity-100 transition-opacity"
              >
                #{tag} ({formatWrootz(wrootz)})
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Expired Locks List */}
      {expiredLocks.length > 0 && (
        <div>
          <p className="text-xs text-[var(--foreground-muted)] mb-2">
            Expired Locks ({expiredLocks.length}) - {formatSats(bsvToSats(totalExpiredSats))} sats
          </p>
          <div className="space-y-2">
            {displayedExpiredLocks.map((lock) => (
              <div
                key={lock.id}
                className="flex items-center justify-between text-sm p-2 rounded-lg bg-[var(--surface-2)] opacity-60"
              >
                <div>
                  <Link
                    href={`/profile/${lock.user.username}`}
                    className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:underline"
                  >
                    @{lock.user.username}
                  </Link>
                  {lock.tag && (
                    <Link
                      href={`/tag/${encodeURIComponent(lock.tag)}`}
                      className="ml-2 text-xs text-[var(--primary)] hover:underline"
                    >
                      #{lock.tag}
                    </Link>
                  )}
                </div>
                <div className="text-right text-xs text-[var(--foreground-muted)]">
                  <div>{formatWrootz(lock.initialTu)} wrootz</div>
                  <div>{formatSats(bsvToSats(lock.amount))} sats</div>
                </div>
              </div>
            ))}
          </div>

          {expiredLocks.length > 5 && (
            <button
              onClick={() => setShowAllExpired(!showAllExpired)}
              className="text-xs text-[var(--primary)] hover:underline mt-2"
            >
              {showAllExpired ? 'Show less' : `Show all ${expiredLocks.length} expired locks`}
            </button>
          )}
        </div>
      )}
    </>
  )

  if (embedded) {
    return <div>{content}</div>
  }

  return (
    <CollapsibleSection title="Wrootz History" defaultOpen={false}>
      {content}
    </CollapsibleSection>
  )
}
