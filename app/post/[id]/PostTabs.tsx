'use client'

import { useState } from 'react'
import RepliesList from './RepliesList'
import ActiveLocksList from './ActiveLocksList'
import WrootzHistory from './WrootzHistory'
import type { Reply, Lock } from '@/app/lib/types'

interface PostTabsProps {
  replies: Reply[]
  activeLocks: Lock[]
  expiredLocks: Lock[]
  totalTu: number
  currentBlock: number
}

export default function PostTabs({ replies, activeLocks, expiredLocks, totalTu, currentBlock }: PostTabsProps) {
  const [activeTab, setActiveTab] = useState<'replies' | 'locks' | 'history'>('replies')

  const tabs = [
    { id: 'replies' as const, label: 'Replies', count: replies.length },
    { id: 'locks' as const, label: 'Locks', count: activeLocks.length },
    { id: 'history' as const, label: 'History', count: null },
  ]

  return (
    <div className="card-flush overflow-hidden">
      {/* Tab Navigation */}
      <div className="tab-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? 'tab-button-active' : 'tab-button'}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-[var(--surface-2)]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {activeTab === 'replies' && (
          <div className="animate-fade-in">
            {replies.length > 0 ? (
              <RepliesList replies={replies} />
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-[var(--foreground-muted)] text-sm">No replies yet</p>
                <p className="text-[var(--foreground-muted)] text-xs mt-1">Be the first to reply!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'locks' && (
          <div className="animate-fade-in">
            <ActiveLocksList locks={activeLocks} totalTu={totalTu} embedded />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-fade-in">
            <WrootzHistory
              activeLocks={activeLocks}
              expiredLocks={expiredLocks}
              currentBlock={currentBlock}
              embedded
            />
          </div>
        )}
      </div>
    </div>
  )
}
