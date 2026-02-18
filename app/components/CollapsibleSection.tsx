'use client'

import { useState, ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  children: ReactNode
  className?: string
  headerRight?: ReactNode
}

export default function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
  className = '',
  headerRight
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 cursor-pointer select-none"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsOpen(!isOpen)
            }
          }}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="font-semibold">
            {title}
            {count !== undefined && (
              <span className="text-sm font-normal text-[var(--muted)] ml-2">({count})</span>
            )}
          </h3>
        </div>
        {headerRight && isOpen && headerRight}
      </div>
      {isOpen && (
        <div className="mt-3">
          {children}
        </div>
      )}
    </div>
  )
}
