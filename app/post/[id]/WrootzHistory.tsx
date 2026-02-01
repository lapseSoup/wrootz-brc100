'use client'

import { useState, useMemo } from 'react'
import { formatWrootz, formatSats, bsvToSats } from '@/app/lib/constants'
import CollapsibleSection from '@/app/components/CollapsibleSection'
import Link from 'next/link'

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

interface WrootzHistoryProps {
  activeLocks: Lock[]
  expiredLocks: Lock[]
  currentBlock: number
  embedded?: boolean
}

interface DataPoint {
  block: number
  wrootz: number
}

export default function WrootzHistory({ activeLocks, expiredLocks, currentBlock, embedded = false }: WrootzHistoryProps) {
  const [showAllExpired, setShowAllExpired] = useState(false)
  const allLocks = useMemo(() => [...activeLocks, ...expiredLocks], [activeLocks, expiredLocks])

  // Calculate total expired wrootz
  const totalExpiredWrootz = expiredLocks.reduce((sum, lock) => sum + lock.initialTu, 0)
  const totalExpiredSats = expiredLocks.reduce((sum, lock) => sum + lock.amount, 0)

  // Calculate historical wrootz data for graph
  const graphData = useMemo(() => {
    if (allLocks.length === 0) return []

    // Find the earliest start block and create timeline
    const earliestBlock = Math.min(...allLocks.map(l => l.startBlock))
    const dataPoints: DataPoint[] = []

    // Sample at reasonable intervals (every 6 blocks = 1 hour, or fewer points for long histories)
    const blockRange = currentBlock - earliestBlock
    const sampleInterval = Math.max(1, Math.floor(blockRange / 50)) // Max 50 data points

    for (let block = earliestBlock; block <= currentBlock; block += sampleInterval) {
      let totalWrootz = 0

      for (const lock of allLocks) {
        if (block >= lock.startBlock) {
          const blocksElapsed = block - lock.startBlock
          const blocksRemaining = Math.max(0, lock.durationBlocks - blocksElapsed)

          if (blocksRemaining > 0) {
            // Lock is still active at this block
            // wrootz decays linearly: currentTu = initialTu * (remainingBlocks / durationBlocks)
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

    // Create area path (line + close to bottom)
    const linePath = points.join(' L ')
    const lastX = ((graphData[graphData.length - 1].block - minBlock) / blockRange) * width
    const firstX = 0

    return `M ${firstX},${height} L ${linePath} L ${lastX},${height} Z`
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

  // Calculate expired tags for search
  const expiredTagWrootz: Record<string, number> = {}
  for (const lock of expiredLocks) {
    if (lock.tag) {
      expiredTagWrootz[lock.tag] = (expiredTagWrootz[lock.tag] || 0) + lock.initialTu
    }
  }
  const sortedExpiredTags = Object.entries(expiredTagWrootz).sort((a, b) => b[1] - a[1])

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
