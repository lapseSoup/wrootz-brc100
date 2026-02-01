'use client'

import Link from 'next/link'
import { formatSats, bsvToSats, formatRelativeTime } from '@/app/lib/constants'

interface Transaction {
  id: string
  action: string
  amount: number
  description: string | null
  createdAt: string
  user: { id: string; username: string }
}

interface TransactionHistoryProps {
  transactions: Transaction[]
}

// Get icon and color based on transaction action
function getTransactionStyle(action: string) {
  switch (action) {
    case 'Buy':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        color: 'var(--primary)',
        bgColor: 'var(--primary-light)',
        label: 'Bought'
      }
    case 'Sell':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
        color: 'var(--accent)',
        bgColor: 'var(--accent-light)',
        label: 'Listed'
      }
    case 'Profit':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: 'var(--success)',
        bgColor: 'rgba(34, 197, 94, 0.1)',
        label: 'Profit'
      }
    case 'Lock':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ),
        color: 'var(--primary)',
        bgColor: 'var(--primary-light)',
        label: 'Locked'
      }
    case 'Create':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
        color: 'var(--foreground-muted)',
        bgColor: 'var(--surface-2)',
        label: 'Created'
      }
    case 'Tip':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        ),
        color: 'var(--danger)',
        bgColor: 'rgba(239, 68, 68, 0.1)',
        label: 'Tipped'
      }
    default:
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: 'var(--foreground-muted)',
        bgColor: 'var(--surface-2)',
        label: action
      }
  }
}

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {transactions.map((tx) => {
        const style = getTransactionStyle(tx.action)
        return (
          <div key={tx.id} className="flex items-start gap-2 p-2 -mx-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: style.bgColor, color: style.color }}
            >
              {style.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium" style={{ color: style.color }}>
                  {style.label}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {formatRelativeTime(tx.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                <Link
                  href={`/profile/${tx.user.username}`}
                  className="font-medium hover:text-[var(--primary)] transition-colors"
                >
                  @{tx.user.username}
                </Link>
                <span className="text-[var(--muted)]">•</span>
                <span className="font-medium">{formatSats(bsvToSats(tx.amount))} sats</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
