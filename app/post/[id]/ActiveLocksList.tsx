'use client'

import { useState } from 'react'
import CollapsibleSection from '@/app/components/CollapsibleSection'
import LockItem from './LockItem'

interface Lock {
  id: string
  amount: number
  initialTu: number
  currentTu: number
  durationBlocks: number
  remainingBlocks: number
  tag: string | null
  user: { username: string }
}

interface ActiveLocksListProps {
  locks: Lock[]
  totalTu: number
  embedded?: boolean
}

export default function ActiveLocksList({ locks, totalTu, embedded = false }: ActiveLocksListProps) {
  const [expandAll, setExpandAll] = useState(false)
  // Increment this to reset all local overrides when expand/collapse all is clicked
  const [resetKey, setResetKey] = useState(0)

  const handleToggleAll = () => {
    setExpandAll(!expandAll)
    setResetKey(prev => prev + 1) // Force remount to clear local overrides
  }

  const expandCollapseButton = locks.length > 0 ? (
    <button
      onClick={handleToggleAll}
      className="text-xs text-[var(--primary)] hover:underline"
    >
      {expandAll ? 'Collapse all' : 'Expand all decay rates'}
    </button>
  ) : null

  // When embedded in tabs, don't wrap in CollapsibleSection
  if (embedded) {
    return (
      <div>
        {locks.length > 0 && (
          <div className="flex justify-end mb-3">
            {expandCollapseButton}
          </div>
        )}
        {locks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-[var(--foreground-muted)] text-sm">No active locks yet</p>
            <p className="text-[var(--foreground-muted)] text-xs mt-1">Be the first to lock BSV!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {locks.map((lock) => (
              <LockItem
                key={`${lock.id}-${resetKey}`}
                lock={lock}
                totalTu={totalTu}
                forceExpand={expandAll}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <CollapsibleSection
      title="Active Locks"
      count={locks.length}
      headerRight={expandCollapseButton}
    >
      {locks.length === 0 ? (
        <p className="text-[var(--foreground-muted)] text-sm">No active locks yet. Be the first!</p>
      ) : (
        <div className="space-y-3">
          {locks.map((lock) => (
            <LockItem
              key={`${lock.id}-${resetKey}`}
              lock={lock}
              totalTu={totalTu}
              forceExpand={expandAll}
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}
