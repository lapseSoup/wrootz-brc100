'use client'

import { useEffect, useRef } from 'react'

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export default function MobileDrawer({ isOpen, onClose, children }: MobileDrawerProps) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on escape key — use ref to avoid re-attaching on every onClose change
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 right-0 h-full w-[300px] max-w-[85vw] bg-[var(--surface-1)] z-[101] shadow-2xl transform transition-transform duration-300 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Close button */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <span className="font-semibold text-[var(--foreground)]">Menu</span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer content */}
        <div className="p-4 overflow-y-auto h-[calc(100%-65px)]">
          {children}
        </div>
      </div>
    </>
  )
}
