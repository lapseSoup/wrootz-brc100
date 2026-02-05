'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatWrootz } from '@/app/lib/constants'
import type { Lock } from '@/app/lib/types'
import {
  calculateWrootzHistory,
  generateAreaPath,
  generateLinePath
} from '@/app/lib/utils/wrootz-calculations'

interface SidebarHistoryProps {
  activeLocks: Lock[]
  expiredLocks: Lock[]
  currentBlock: number
}

export default function SidebarHistory({ activeLocks, expiredLocks, currentBlock }: SidebarHistoryProps) {
  const [showAllExpired, setShowAllExpired] = useState(false)
  const allLocks = useMemo(() => [...activeLocks, ...expiredLocks], [activeLocks, expiredLocks])

  // Calculate total expired wrootz
  const totalExpiredWrootz = expiredLocks.reduce((sum, lock) => sum + lock.initialTu, 0)

  // Calculate historical wrootz data for graph using shared utility (30 points for compact graph)
  const graphData = useMemo(
    () => calculateWrootzHistory(allLocks, activeLocks, currentBlock, 30),
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

  if (allLocks.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-[var(--foreground-muted)]">No history yet</p>
      </div>
    )
  }

  const displayedExpiredLocks = showAllExpired ? expiredLocks : expiredLocks.slice(0, 3)
  const currentWrootz = activeLocks.reduce((sum, l) => sum + l.currentTu, 0)

  return (
    <div className="space-y-3">
      {/* Compact Graph */}
      {graphData.length >= 2 && (
        <div>
          <div className="relative h-20 bg-[var(--surface-2)] rounded-lg p-1.5">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {/* Grid line */}
              <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" />

              {/* Area fill */}
              <path
                d={pathData}
                fill="var(--primary)"
                fillOpacity="0.15"
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
          </div>
          <div className="flex justify-between text-[9px] text-[var(--foreground-muted)] mt-1">
            <span>#{minBlock}</span>
            <span>#{currentBlock}</span>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex justify-between text-xs">
        <div>
          <span className="text-[var(--foreground-muted)]">Current: </span>
          <span className="font-medium text-[var(--primary)]">{formatWrootz(currentWrootz)}</span>
        </div>
        <div>
          <span className="text-[var(--foreground-muted)]">Expired: </span>
          <span className="font-medium text-[var(--foreground-muted)]">{formatWrootz(totalExpiredWrootz)}</span>
        </div>
      </div>

      {/* Expired Locks List */}
      {expiredLocks.length > 0 && (
        <div>
          <p className="text-[10px] text-[var(--foreground-muted)] mb-1.5">
            Expired ({expiredLocks.length})
          </p>
          <div className="space-y-1">
            {displayedExpiredLocks.map((lock) => (
              <div
                key={lock.id}
                className="flex items-center justify-between text-xs py-1 opacity-60"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <Link
                    href={`/profile/${lock.user.username}`}
                    className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] truncate"
                  >
                    @{lock.user.username}
                  </Link>
                  {lock.tag && (
                    <span className="text-[10px] text-[var(--primary)]">#{lock.tag}</span>
                  )}
                </div>
                <span className="text-[10px] text-[var(--foreground-muted)] flex-shrink-0">
                  {formatWrootz(lock.initialTu)}
                </span>
              </div>
            ))}
          </div>

          {expiredLocks.length > 3 && (
            <button
              onClick={() => setShowAllExpired(!showAllExpired)}
              className="text-[10px] text-[var(--primary)] hover:underline w-full text-center mt-1"
            >
              {showAllExpired ? 'Show less' : `+${expiredLocks.length - 3} more`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
