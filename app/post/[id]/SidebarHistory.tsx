'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatWrootz } from '@/app/lib/constants'

interface Lock {
  id: string
  amount: number
  initialTu: number
  currentTu: number
  durationBlocks: number
  startBlock: number
  remainingBlocks: number
  tag: string | null
  expired: boolean
  user: { username: string }
}

interface SidebarHistoryProps {
  activeLocks: Lock[]
  expiredLocks: Lock[]
  currentBlock: number
}

interface DataPoint {
  block: number
  wrootz: number
}

export default function SidebarHistory({ activeLocks, expiredLocks, currentBlock }: SidebarHistoryProps) {
  const [showAllExpired, setShowAllExpired] = useState(false)
  const allLocks = useMemo(() => [...activeLocks, ...expiredLocks], [activeLocks, expiredLocks])

  // Calculate total expired wrootz
  const totalExpiredWrootz = expiredLocks.reduce((sum, lock) => sum + lock.initialTu, 0)

  // Calculate historical wrootz data for graph
  const graphData = useMemo(() => {
    if (allLocks.length === 0) return []

    const earliestBlock = Math.min(...allLocks.map(l => l.startBlock))
    const dataPoints: DataPoint[] = []

    const blockRange = currentBlock - earliestBlock
    const sampleInterval = Math.max(1, Math.floor(blockRange / 30)) // Max 30 data points for compact graph

    for (let block = earliestBlock; block <= currentBlock; block += sampleInterval) {
      let totalWrootz = 0

      for (const lock of allLocks) {
        if (block >= lock.startBlock) {
          const blocksElapsed = block - lock.startBlock
          const blocksRemaining = Math.max(0, lock.durationBlocks - blocksElapsed)

          if (blocksRemaining > 0) {
            const wrootzAtBlock = lock.initialTu * (blocksRemaining / lock.durationBlocks)
            totalWrootz += wrootzAtBlock
          }
        }
      }

      dataPoints.push({ block, wrootz: totalWrootz })
    }

    // Always include current block
    if (dataPoints.length === 0 || dataPoints[dataPoints.length - 1].block !== currentBlock) {
      const currentWrootz = activeLocks.reduce((sum, l) => sum + l.currentTu, 0)
      dataPoints.push({ block: currentBlock, wrootz: currentWrootz })
    }

    return dataPoints
  }, [allLocks, activeLocks, currentBlock])

  // Calculate graph dimensions
  const maxWrootz = Math.max(...graphData.map(d => d.wrootz), 1)
  const minBlock = graphData.length > 0 ? graphData[0].block : currentBlock
  const blockRange = currentBlock - minBlock || 1

  // SVG path for the area chart
  const pathData = useMemo(() => {
    if (graphData.length < 2) return ''

    const width = 100
    const height = 100

    const points = graphData.map((d) => {
      const x = ((d.block - minBlock) / blockRange) * width
      const y = height - (d.wrootz / maxWrootz) * height
      return `${x},${y}`
    })

    const linePath = points.join(' L ')
    const lastX = ((graphData[graphData.length - 1].block - minBlock) / blockRange) * width

    return `M 0,${height} L ${linePath} L ${lastX},${height} Z`
  }, [graphData, minBlock, blockRange, maxWrootz])

  // Line path (just the top edge)
  const linePath = useMemo(() => {
    if (graphData.length < 2) return ''

    const width = 100
    const height = 100

    const points = graphData.map((d) => {
      const x = ((d.block - minBlock) / blockRange) * width
      const y = height - (d.wrootz / maxWrootz) * height
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }, [graphData, minBlock, blockRange, maxWrootz])

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
