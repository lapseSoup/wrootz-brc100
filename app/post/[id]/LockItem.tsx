'use client'

import { useState } from 'react'
import { formatWrootz, formatSats, bsvToSats, blocksToTimeString, BLOCKS_PER_HOUR, BLOCKS_PER_DAY } from '@/app/lib/constants'

interface LockItemProps {
  lock: {
    id: string
    amount: number
    initialTu: number
    currentTu: number
    durationBlocks: number
    remainingBlocks: number
    tag: string | null
    user: { username: string }
  }
  totalTu: number
  forceExpand?: boolean
}

export default function LockItem({ lock, totalTu, forceExpand = false }: LockItemProps) {
  // null = follow forceExpand, true = force open, false = force closed
  const [localOverride, setLocalOverride] = useState<boolean | null>(null)

  // If user has clicked, use their preference; otherwise follow forceExpand
  const showDetails = localOverride !== null ? localOverride : forceExpand

  const handleClick = () => {
    // Toggle: if currently showing, hide it; if hidden, show it
    setLocalOverride(!showDetails)
  }

  const wrootzShare = totalTu > 0 ? (lock.currentTu / totalTu) * 100 : 0

  // Calculate decay rate: wrootz lost per block
  const decayRatePerBlock = lock.initialTu / lock.durationBlocks
  // Wrootz lost per hour
  const decayRatePerHour = decayRatePerBlock * BLOCKS_PER_HOUR
  // Wrootz lost per day
  const decayRatePerDay = decayRatePerBlock * BLOCKS_PER_DAY

  // Percentage of original wrootz remaining
  const percentRemaining = lock.initialTu > 0 ? (lock.currentTu / lock.initialTu) * 100 : 0

  return (
    <button
      type="button"
      className="w-full text-left p-3 rounded-lg bg-[var(--background)] cursor-pointer transition-all hover:ring-1 hover:ring-[var(--primary)]"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">@{lock.user.username}</span>
            {lock.tag && <span className="tag">#{lock.tag}</span>}
          </div>
          <div className="text-xs text-[var(--muted)] mt-1">
            {formatSats(bsvToSats(lock.amount))} sats | {blocksToTimeString(lock.remainingBlocks)} remaining
          </div>
        </div>
        <div className="text-right">
          <div className="wrootz-badge text-sm">{formatWrootz(lock.currentTu)} wrootz</div>
          <div className="text-xs text-[var(--muted)] mt-1">{wrootzShare.toFixed(1)}% share</div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-[var(--card-border)] text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[var(--muted)]">Started with:</span>
              <span className="ml-1 font-medium">{formatWrootz(lock.initialTu)} wrootz</span>
            </div>
            <div>
              <span className="text-[var(--muted)]">Remaining:</span>
              <span className="ml-1 font-medium">{percentRemaining.toFixed(1)}%</span>
            </div>
          </div>
          <div className="p-2 rounded bg-[var(--card)] space-y-1">
            <p className="text-[var(--muted)] font-medium">Decay Rate:</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[var(--danger)]">-{formatWrootz(decayRatePerBlock)}</p>
                <p className="text-[var(--muted)]">per block</p>
              </div>
              <div>
                <p className="text-[var(--danger)]">-{formatWrootz(decayRatePerHour)}</p>
                <p className="text-[var(--muted)]">per hour</p>
              </div>
              <div>
                <p className="text-[var(--danger)]">-{formatWrootz(decayRatePerDay)}</p>
                <p className="text-[var(--muted)]">per day</p>
              </div>
            </div>
          </div>
          <p className="text-[var(--muted)] italic">
            Lock duration: {blocksToTimeString(lock.durationBlocks)} total
          </p>
        </div>
      )}
    </button>
  )
}
