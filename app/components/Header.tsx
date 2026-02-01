'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useMobileMenu } from './MobileMenuProvider'
import WalletButton from './WalletButton'

interface User {
  id: string
  username: string
  isAdmin?: boolean
  unreadNotifications?: number
}

interface BlockInfo {
  currentBlock: number
}

export default function Header({ user }: { user: User | null }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [blockInfo, setBlockInfo] = useState<BlockInfo | null>(null)
  const [unreadCount, setUnreadCount] = useState(user?.unreadNotifications ?? 0)
  const mobileMenu = useMobileMenu()

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('wrootz_theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }

    // Fetch block info
    const fetchBlockInfo = async () => {
      try {
        const res = await fetch('/api/block', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setBlockInfo(data)
        }
      } catch {
        console.error('Failed to fetch block info')
      }
    }

    // Fetch notification count
    const fetchUserData = async () => {
      if (!user) return
      try {
        const notifRes = await fetch('/api/notifications/unread', { cache: 'no-store' })
        if (notifRes.ok) {
          const data = await notifRes.json()
          setUnreadCount(data.count)
        }
      } catch {
        // Silently fail
      }
    }

    fetchBlockInfo()
    fetchUserData()
    const blockInterval = setInterval(fetchBlockInfo, 5000)
    const userInterval = setInterval(fetchUserData, 5000)

    return () => {
      clearInterval(blockInterval)
      clearInterval(userInterval)
    }
  }, [user])


  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('wrootz_theme', newTheme)
  }

  return (
    <header className="sticky top-0 z-50 bg-[var(--surface-1)]/95 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto">
        {/* Main header row */}
        <div className="flex items-center justify-between px-4 h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src={theme === 'dark' ? '/wrootz-logo-light.png' : '/wrootz-logo-dark.png'}
              alt="Wrootz"
              width={180}
              height={72}
              className="h-16 w-auto"
              priority
            />
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Block info + FAQ */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-[var(--foreground-muted)]">
              {blockInfo && (
                <>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    #{blockInfo.currentBlock.toLocaleString()}
                  </span>
                  <span className="w-px h-3 bg-[var(--border)]" />
                </>
              )}
              <Link
                href="/faq"
                className="hover:text-[var(--foreground)] transition-colors"
              >
                FAQ
              </Link>
            </div>

            <span className="hidden sm:block w-px h-4 bg-[var(--border)]" />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={mobileMenu.toggle}
              className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors md:hidden"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <span className="hidden sm:block w-px h-4 bg-[var(--border)]" />

            {user ? (
              <>
                {/* Admin Link */}
                {user.isAdmin && (
                  <Link href="/admin" className="text-xs px-2 py-1 bg-[var(--danger)] text-white rounded-md font-medium">
                    Admin
                  </Link>
                )}

                {/* Wallet Connection - Real BSV */}
                <div className="hidden md:block">
                  <WalletButton />
                </div>

                <div className="hidden md:block w-px h-6 bg-[var(--border)]" />

                {/* Notifications */}
                <Link
                  href="/notifications"
                  className="relative p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                  title="Notifications"
                >
                  <svg className="w-5 h-5 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[var(--danger)] text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                <span className="hidden sm:block w-px h-4 bg-[var(--border)]" />

                {/* Create Post */}
                <Link href="/create" className="btn btn-primary btn-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Post</span>
                </Link>

                <span className="hidden sm:block w-px h-4 bg-[var(--border)]" />

                {/* Profile */}
                <Link href="/profile" className="btn btn-ghost btn-sm">
                  <div className="w-6 h-6 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-medium">
                    {user.username[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">{user.username}</span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Login
                </Link>
                <span className="hidden sm:block w-px h-4 bg-[var(--border)]" />
                <Link href="/register" className="btn btn-primary btn-sm">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>

      </div>
    </header>
  )
}
