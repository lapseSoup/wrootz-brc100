'use client'

import { useState, useEffect, useRef } from 'react'
import { useWallet } from './WalletProvider'

export default function WalletButton() {
  const {
    isConnected,
    isConnecting,
    address,
    error,
    connect,
    disconnect,
    clearError,
    availableWallets
  } = useWallet()

  const [showDropdown, setShowDropdown] = useState(false)
  const [showWalletSelect, setShowWalletSelect] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const walletSelectRef = useRef<HTMLDivElement>(null)

  // Move focus to the first interactive item when the connected dropdown opens
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const firstItem = dropdownRef.current.querySelector<HTMLElement>(
        'button, a, [role="menuitem"]'
      )
      firstItem?.focus()
    }
  }, [showDropdown])

  // Move focus to the first interactive item when the wallet-select dropdown opens
  useEffect(() => {
    if (showWalletSelect && walletSelectRef.current) {
      const firstItem = walletSelectRef.current.querySelector<HTMLElement>(
        'button, a, [role="menuitem"]'
      )
      firstItem?.focus()
    }
  }, [showWalletSelect])

  const handleConnect = async (walletType: 'brc100' | 'simplysats') => {
    // L8: Clear both local and global wallet errors before retrying
    setConnectError(null)
    clearError()

    try {
      await connect(walletType)
      setShowWalletSelect(false)
    } catch (e) {
      console.error('Failed to connect wallet:', e)
      setConnectError(e instanceof Error ? e.message : 'Failed to connect')
    }
  }

  const handleCopyIdentityKey = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Close dropdown when focus leaves the container entirely
  const handleDropdownBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setShowDropdown(false)
    }
  }

  // Close wallet-select dropdown when focus leaves the container entirely
  const handleWalletSelectBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setShowWalletSelect(false)
    }
  }

  // Connected state - show connected status
  if (isConnected && address) {
    return (
      <div className="relative" onBlur={handleDropdownBlur}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          aria-haspopup="menu"
          aria-expanded={showDropdown}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors"
        >
          {/* Connected indicator */}
          <div className="w-2 h-2 rounded-full bg-[var(--success)]" />

          {/* Connected text */}
          <span className="text-sm font-medium">Connected</span>

          {/* Dropdown arrow */}
          <svg className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            <div
              ref={dropdownRef}
              role="menu"
              className="absolute right-0 mt-2 w-72 bg-[var(--surface-1)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-2"
            >
              {/* Wallet Type Badge */}
              <div className="px-4 py-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)]">
                    BRC-100
                  </span>
                  <span className="text-xs text-[var(--success)]">Connected</span>
                </div>
              </div>

              {/* Identity Key */}
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-xs text-[var(--foreground-muted)] mb-1">Identity Key</p>
                <p className="font-mono text-xs break-all select-all">{address}</p>
              </div>

              {/* Copy Identity Key */}
              <button
                role="menuitem"
                onClick={handleCopyIdentityKey}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? 'Copied!' : 'Copy Identity Key'}
              </button>

              {/* Disconnect */}
              <button
                role="menuitem"
                onClick={() => {
                  disconnect()
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Disconnect Wallet
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // Connecting state
  if (isConnecting) {
    return (
      <button disabled className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[var(--primary)] text-white opacity-70">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Connecting...
      </button>
    )
  }

  // Disconnected state - show connect button
  return (
    <>
      <div className="relative" onBlur={handleWalletSelectBlur}>
        <button
          onClick={() => setShowWalletSelect(!showWalletSelect)}
          aria-haspopup="menu"
          aria-expanded={showWalletSelect}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Connect Wallet
        </button>

        {/* Wallet selection dropdown */}
        {showWalletSelect && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowWalletSelect(false)} />
            <div
              ref={walletSelectRef}
              role="menu"
              className="absolute right-0 mt-2 w-80 bg-[var(--surface-1)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-2"
            >
              <p className="px-4 py-2 text-sm font-semibold border-b border-[var(--border)]">
                Connect Wallet
              </p>

              {availableWallets.map((wallet) => (
                <button
                  key={wallet.type}
                  role="menuitem"
                  onClick={() => wallet.installed && handleConnect(wallet.type as 'brc100' | 'simplysats')}
                  disabled={!wallet.installed}
                  className={`w-full px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors flex items-center gap-3 ${
                    !wallet.installed ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {/* Wallet icon */}
                  <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>

                  <div className="flex-1">
                    <p className="font-medium">{wallet.name}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {wallet.description || (wallet.installed ? 'Ready to connect' : 'Not available')}
                    </p>
                  </div>

                  {wallet.installed && (
                    <svg className="w-5 h-5 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}

              <div className="px-4 py-2 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--foreground-muted)]">
                  BRC-100 wallets include: Metanet Desktop, SPV Wallet Extension
                </p>
                <div className="mt-2 flex gap-2">
                  <a
                    href="https://github.com/bsv-blockchain/metanet-desktop/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    Download Metanet Desktop →
                  </a>
                </div>
              </div>

              {(error || connectError) && (
                <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--danger)]/10">
                  <p className="text-xs text-[var(--danger)] whitespace-pre-wrap">
                    {error || connectError}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
