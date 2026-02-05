'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from './WalletProvider'
import { formatSats, blocksToTimeString } from '@/app/lib/constants'
import type { LockedOutput } from '@/app/lib/wallet/types'
import { getErrorDetails } from '@/app/lib/wallet/errors'

export default function MyLocks() {
  const { isConnected, currentWallet, connect, refreshBalance } = useWallet()
  const [locks, setLocks] = useState<LockedOutput[]>([])
  const [loading, setLoading] = useState(false)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorAction, setErrorAction] = useState<string | undefined>()
  const [success, setSuccess] = useState<string | null>(null)
  const [currentBlock, setCurrentBlock] = useState<number>(0)

  const loadLocks = useCallback(async () => {
    if (!currentWallet || !isConnected) return

    setLoading(true)
    setError(null)

    try {
      // Get current block height (BRC-100 specific method)
      if (currentWallet.getBlockHeight) {
        const height = await currentWallet.getBlockHeight()
        setCurrentBlock(height)
      }

      // List all locks (BRC-100 specific method)
      if (currentWallet.listLocks) {
        const locksList = await currentWallet.listLocks()
        setLocks(locksList)
      } else {
        setError('This wallet does not support listing locks')
      }
    } catch (err) {
      console.error('Failed to load locks:', err)
      setError(err instanceof Error ? err.message : 'Failed to load locks')
    } finally {
      setLoading(false)
    }
  }, [currentWallet, isConnected])

  useEffect(() => {
    if (isConnected && currentWallet) {
      loadLocks()
    }
  }, [isConnected, currentWallet, loadLocks])

  const handleUnlock = async (outpoint: string) => {
    if (!currentWallet || !currentWallet.unlockBSV) return

    setUnlocking(outpoint)
    setError(null)
    setErrorAction(undefined)
    setSuccess(null)

    try {
      const result = await currentWallet.unlockBSV(outpoint)
      setSuccess(`Successfully unlocked! Transaction: ${result.txid.slice(0, 8)}...${result.txid.slice(-8)}`)
      // Immediately refresh balance after successful unlock
      refreshBalance()
      // Refresh the locks list
      await loadLocks()
    } catch (err) {
      console.error('Unlock failed:', err)
      const errorDetails = getErrorDetails(err)
      setError(errorDetails.message)
      setErrorAction(errorDetails.action)
    } finally {
      setUnlocking(null)
    }
  }

  if (!isConnected) {
    return (
      <div className="p-6 bg-[var(--surface-1)] rounded-lg border border-[var(--border)]">
        <h3 className="text-lg font-semibold mb-4">My Locked BSV</h3>
        <p className="text-[var(--foreground-muted)] mb-4">Connect your wallet to view your locked BSV.</p>
        <button onClick={() => connect()} className="btn btn-primary">
          Connect Wallet
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 bg-[var(--surface-1)] rounded-lg border border-[var(--border)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">My Locked BSV</h3>
        <button
          onClick={loadLocks}
          disabled={loading}
          className="text-sm text-[var(--primary)] hover:underline disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {currentBlock > 0 && (
        <p className="text-xs text-[var(--foreground-muted)] mb-4">
          Current block: {currentBlock.toLocaleString()}
        </p>
      )}

      {error && (
        <div className="p-3 mb-4 bg-[var(--danger)]/10 text-[var(--danger)] rounded-lg text-sm">
          <div>{error}</div>
          {errorAction && (
            <div className="mt-1 opacity-80 text-xs">{errorAction}</div>
          )}
        </div>
      )}

      {success && (
        <div className="p-3 mb-4 bg-[var(--success)]/10 text-[var(--success)] rounded-lg text-sm">
          {success}
        </div>
      )}

      {loading && locks.length === 0 ? (
        <div className="py-8 text-center text-[var(--foreground-muted)]">
          <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading locks...
        </div>
      ) : locks.length === 0 ? (
        <div className="py-8 text-center text-[var(--foreground-muted)]">
          <p>No locked BSV found.</p>
          <p className="text-xs mt-2">Lock BSV on posts to earn wrootz!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          <div className="p-3 bg-[var(--surface-2)] rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-[var(--foreground-muted)]">Total Locked</p>
                <p className="font-semibold">{formatSats(locks.reduce((sum, l) => sum + l.satoshis, 0))} sats</p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-muted)]">Unlockable</p>
                <p className="font-semibold text-[var(--success)]">
                  {formatSats(locks.filter(l => l.spendable).reduce((sum, l) => sum + l.satoshis, 0))} sats
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--foreground-muted)]">Still Locked</p>
                <p className="font-semibold text-[var(--warning)]">
                  {formatSats(locks.filter(l => !l.spendable).reduce((sum, l) => sum + l.satoshis, 0))} sats
                </p>
              </div>
            </div>
          </div>

          {/* Lock list */}
          {locks.map((lock) => (
            <div
              key={lock.outpoint}
              className={`p-4 rounded-lg border ${
                lock.spendable
                  ? 'border-[var(--success)] bg-[var(--success)]/5'
                  : 'border-[var(--border)] bg-[var(--surface-2)]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{formatSats(lock.satoshis)} sats</span>
                    {lock.spendable ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--success)]/20 text-[var(--success)]">
                        Unlockable
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--warning)]/20 text-[var(--warning)]">
                        Locked
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[var(--foreground-muted)] space-y-0.5">
                    <p>
                      {lock.spendable
                        ? `Unlocked at block ${lock.unlockBlock.toLocaleString()}`
                        : `Unlocks at block ${lock.unlockBlock.toLocaleString()} (~${blocksToTimeString(lock.blocksRemaining)} remaining)`
                      }
                    </p>
                    <p className="font-mono truncate" title={lock.txid}>
                      TX: {lock.txid.slice(0, 12)}...{lock.txid.slice(-8)}
                    </p>
                  </div>
                </div>

                {lock.spendable && (
                  <button
                    onClick={() => handleUnlock(lock.outpoint)}
                    disabled={unlocking === lock.outpoint}
                    className="btn btn-primary btn-sm whitespace-nowrap"
                  >
                    {unlocking === lock.outpoint ? (
                      <>
                        <svg className="w-4 h-4 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Unlocking...
                      </>
                    ) : (
                      'Unlock'
                    )}
                  </button>
                )}
              </div>

              {/* WhatsOnChain link */}
              <a
                href={`https://whatsonchain.com/tx/${lock.txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--primary)] hover:underline mt-2 inline-block"
              >
                View on WhatsOnChain →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
