'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useWallet } from './WalletProvider'
import { formatSats } from '@/app/lib/constants'

export default function WalletButton() {
  const {
    isConnected,
    isConnecting,
    address,
    balance,
    error,
    connect,
    disconnect,
    availableWallets,
    refreshBalance,
    currentWallet,
    type: walletType
  } = useWallet()

  const [showDropdown, setShowDropdown] = useState(false)
  const [showWalletSelect, setShowWalletSelect] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConnect = async (type?: 'brc100' | 'yours') => {
    setConnectError(null)

    try {
      await connect(type || 'brc100')
      setShowWalletSelect(false)
    } catch (e) {
      console.error('Failed to connect wallet:', e)
      setConnectError(e instanceof Error ? e.message : 'Failed to connect')
    }
  }

  const truncateAddress = (addr: string) => {
    // For BRC-100, the address is a public key (66 chars hex)
    // Show more characters since it's longer
    if (addr.length > 20) {
      return `${addr.slice(0, 8)}...${addr.slice(-6)}`
    }
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const handleSendBSV = async () => {
    if (!sendTo || !sendAmount || !currentWallet) return

    const satoshis = parseInt(sendAmount)
    if (isNaN(satoshis) || satoshis <= 0) {
      setSendError('Invalid amount')
      return
    }

    setSending(true)
    setSendError(null)
    setSendSuccess(null)

    try {
      const result = await currentWallet.sendBSV(sendTo, satoshis)
      setSendSuccess(`Sent! TX: ${result.txid.slice(0, 8)}...`)
      setSendTo('')
      setSendAmount('')
      refreshBalance()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  // Connected state - show balance and dropdown
  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors"
        >
          {/* Wallet icon */}
          <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>

          {/* Balance */}
          <span className="font-medium text-sm">
            {balance ? formatSats(balance.satoshis) : '...'} sats
          </span>

          {/* Dropdown arrow */}
          <svg className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            <div className="absolute right-0 mt-2 w-64 bg-[var(--surface-1)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-2">
              {/* Wallet Type Badge */}
              <div className="px-4 py-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)]">
                    {walletType === 'brc100' ? 'BRC-100' : walletType === 'yours' ? 'Yours' : 'Wallet'}
                  </span>
                </div>
              </div>

              {/* Address */}
              <div className="px-4 py-2 border-b border-[var(--border)]">
                <p className="text-xs text-[var(--foreground-muted)]">Identity Key</p>
                <p className="font-mono text-sm">{truncateAddress(address)}</p>
              </div>

              {/* Balance details */}
              <div className="px-4 py-2 border-b border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--foreground-muted)]">Balance</p>
                  <button
                    onClick={() => refreshBalance()}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                <p className="font-semibold">
                  {balance ? formatSats(balance.satoshis) : '0'} sats
                </p>
                {balance?.usd && (
                  <p className="text-xs text-[var(--foreground-muted)]">
                    ~${balance.usd.toFixed(2)} USD
                  </p>
                )}
              </div>

              {/* Copy Identity Key */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(address)
                  // Could add a toast notification here
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Identity Key
              </button>

              {/* Send BSV */}
              <button
                onClick={() => {
                  setShowDropdown(false)
                  setShowSendModal(true)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send BSV
              </button>

              {/* Disconnect */}
              <button
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

        {/* Send BSV Modal - rendered via portal to escape header stacking context */}
        {mounted && showSendModal && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowSendModal(false)} />
            <div className="relative w-96 max-w-[90vw] bg-[var(--surface-1)] border border-[var(--border)] rounded-lg shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Send BSV</h3>
                <button onClick={() => setShowSendModal(false)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--foreground-muted)] mb-1">Recipient Address</label>
                  <input
                    type="text"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    placeholder="1ABC... (BSV address)"
                    className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--foreground-muted)] mb-1">Amount (satoshis)</label>
                  <input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="1000"
                    className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm"
                  />
                  <p className="text-xs text-[var(--foreground-muted)] mt-1">
                    Available: {balance ? formatSats(balance.satoshis) : '0'} sats
                  </p>
                </div>

                {sendError && (
                  <p className="text-sm text-[var(--danger)]">{sendError}</p>
                )}

                {sendSuccess && (
                  <p className="text-sm text-[var(--success)]">{sendSuccess}</p>
                )}

                <button
                  onClick={handleSendBSV}
                  disabled={sending || !sendTo || !sendAmount}
                  className="w-full py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>,
          document.body
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
      <div className="relative">
        <button
          onClick={() => setShowWalletSelect(!showWalletSelect)}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Connect Wallet
        </button>

        {/* Wallet selection dropdown */}
        {showWalletSelect && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowWalletSelect(false)} />
            <div className="absolute right-0 mt-2 w-80 bg-[var(--surface-1)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-2">
              <p className="px-4 py-2 text-sm font-semibold border-b border-[var(--border)]">
                Select Wallet
              </p>

              {availableWallets.map((wallet) => (
                <button
                  key={wallet.type}
                  onClick={() => wallet.installed && handleConnect(wallet.type as 'brc100' | 'yours')}
                  disabled={!wallet.installed}
                  className={`w-full px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors flex items-center gap-3 ${
                    !wallet.installed ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {/* Wallet icon */}
                  <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                    {wallet.type === 'brc100' ? (
                      <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    ) : wallet.type === 'yours' ? (
                      <span className="text-lg font-bold">Y</span>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    )}
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
              </div>

              {(error || connectError) && (
                <p className="px-4 py-2 text-xs text-[var(--danger)] border-t border-[var(--border)]">
                  {error || connectError}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
