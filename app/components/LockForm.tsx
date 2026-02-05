'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordLock } from '@/app/actions/posts'
import { LOCK_DURATION_PRESETS, MAX_LOCK_DURATION_BLOCKS, formatSats, blocksToTimeString, formatWrootz, calculateWrootzFromSats } from '@/app/lib/constants'
import TagInput from './TagInput'
import SatsInput from './SatsInput'
import { useWallet } from './WalletProvider'
import { getErrorDetails } from '@/app/lib/wallet/errors'

interface LockFormProps {
  postId: string
  ordinalOrigin?: string // The ordinal's origin (txid_vout format, e.g., "abc123...def_0")
}

export default function LockForm({ postId, ordinalOrigin }: LockFormProps) {
  const router = useRouter()
  const { isConnected, balance, currentWallet, connect, refreshBalance } = useWallet()

  const userBalanceSats = balance?.satoshis ?? 0
  const [amountSats, setAmountSats] = useState('')
  const [durationBlocks, setDurationBlocks] = useState(LOCK_DURATION_PRESETS.find(p => p.default)?.blocks || 144)
  const [customBlocks, setCustomBlocks] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [tag, setTag] = useState('')
  const [error, setError] = useState('')
  const [errorAction, setErrorAction] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [txStatus, setTxStatus] = useState<'idle' | 'signing' | 'broadcasting' | 'confirming'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setErrorAction(undefined)

    // Check wallet connection
    if (!isConnected || !currentWallet) {
      try {
        await connect()
      } catch {
        setError('Please connect your wallet first')
        return
      }
    }

    const sats = parseInt(amountSats)
    if (isNaN(sats) || sats < 1) {
      setError('Please enter a valid amount in sats')
      return
    }

    const blocks = useCustom ? parseInt(customBlocks) : durationBlocks
    if (blocks < 1 || blocks > MAX_LOCK_DURATION_BLOCKS) {
      setError('Invalid lock duration')
      return
    }

    // Note: Balance check is advisory - wallet will reject if truly insufficient
    // We allow proceeding even if balance shows 0 since balance retrieval may fail
    if (userBalanceSats > 0 && sats > userBalanceSats) {
      setError('Insufficient balance')
      return
    }

    setLoading(true)
    setTxStatus('signing')

    try {
      // Call wallet to create the lock transaction
      // Pass ordinalOrigin to create an on-chain link between the lock and the content
      const lockResult = await currentWallet!.lockBSV(sats, blocks, ordinalOrigin)

      setTxStatus('broadcasting')

      // Record the lock in our database
      const result = await recordLock({
        postId,
        amount: sats / 100_000_000, // Convert to BSV
        satoshis: sats,
        durationBlocks: blocks,
        tag: tag || null,
        txid: lockResult.txid,
        lockAddress: lockResult.lockAddress
      })

      if (result?.error) {
        setError(result.error)
      } else {
        setTxStatus('confirming')
        // Immediately refresh balance after successful lock
        refreshBalance()
        // Success! Refresh the page to show updated data
        router.refresh()
        setAmountSats('')
        setTag('')
      }
    } catch (err) {
      console.error('Lock transaction failed:', err)
      const errorDetails = getErrorDetails(err)
      setError(errorDetails.message)
      setErrorAction(errorDetails.action)
    } finally {
      setLoading(false)
      setTxStatus('idle')
    }
  }

  const actualBlocks = useCustom ? parseInt(customBlocks) || 0 : durationBlocks
  const satsNum = parseInt(amountSats) || 0
  const exceedsMaxDuration = actualBlocks > MAX_LOCK_DURATION_BLOCKS

  // Calculate wrootz preview
  const wrootzValue = satsNum > 0 && actualBlocks > 0 && !exceedsMaxDuration
    ? calculateWrootzFromSats(satsNum, actualBlocks)
    : 0

  // Status messages for transaction progress
  const getStatusMessage = () => {
    switch (txStatus) {
      case 'signing':
        return 'Sign in wallet...'
      case 'broadcasting':
        return 'Broadcasting...'
      case 'confirming':
        return 'Confirming...'
      default:
        return null
    }
  }

  // Compact duration presets - just the most common ones
  const compactDurations = [
    { blocks: 6, label: '1h' },
    { blocks: 36, label: '6h' },
    { blocks: 144, label: '1d' },
    { blocks: 1008, label: '1w' },
    { blocks: 4320, label: '1mo' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-3 overflow-visible">
      {error && (
        <div className="p-2 bg-[var(--danger)] text-white rounded text-xs">
          <div>{error}</div>
          {errorAction && (
            <div className="mt-1 opacity-90 text-[10px]">{errorAction}</div>
          )}
        </div>
      )}

      {/* Transaction status */}
      {txStatus !== 'idle' && (
        <div className="p-2 bg-[var(--primary-light)] text-[var(--primary)] rounded text-xs flex items-center gap-2">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {getStatusMessage()}
        </div>
      )}

      {/* Wallet not connected */}
      {!isConnected && (
        <button
          type="button"
          onClick={() => connect()}
          className="btn btn-primary btn-sm w-full"
        >
          Connect Wallet to Lock
        </button>
      )}

      {isConnected && (
        <>
          {/* Amount - inline presets */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[var(--foreground-muted)]">Amount</label>
              {userBalanceSats > 0 && (
                <span className="text-[10px] text-[var(--foreground-muted)]">
                  {formatSats(userBalanceSats)} available
                </span>
              )}
            </div>
            <div className="flex gap-1 mb-1.5">
              {[
                { sats: 10000, label: '10K' },
                { sats: 50000, label: '50K' },
                { sats: 100000, label: '100K' },
                { sats: 1000000, label: '1M' },
              ].map(({ sats, label }) => {
                const exceedsBalance = userBalanceSats > 0 && sats > userBalanceSats
                return (
                  <button
                    key={sats}
                    type="button"
                    onClick={() => setAmountSats(String(sats))}
                    disabled={exceedsBalance}
                    className={`flex-1 py-1 text-[10px] rounded border transition-colors ${
                      parseInt(amountSats) === sats
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                        : exceedsBalance
                        ? 'bg-[var(--surface-2)] text-[var(--foreground-muted)] border-[var(--border)] opacity-40'
                        : 'bg-[var(--surface-2)] text-[var(--foreground-secondary)] border-[var(--border)] hover:border-[var(--primary)]'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <SatsInput
              value={amountSats}
              onChange={setAmountSats}
              max={userBalanceSats}
              placeholder="Custom sats"
              className="w-full text-sm"
            />
          </div>

          {/* Duration - compact row */}
          <div>
            <label className="text-xs font-medium text-[var(--foreground-muted)] mb-1 block">Duration</label>
            <div className="flex gap-1">
              {compactDurations.map((preset) => (
                <button
                  key={preset.blocks}
                  type="button"
                  onClick={() => {
                    setDurationBlocks(preset.blocks)
                    setUseCustom(false)
                  }}
                  className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                    !useCustom && durationBlocks === preset.blocks
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'bg-[var(--surface-2)] text-[var(--foreground-secondary)] border-[var(--border)] hover:border-[var(--primary)]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUseCustom(!useCustom)}
                className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                  useCustom
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--surface-2)] text-[var(--foreground-secondary)] border-[var(--border)] hover:border-[var(--primary)]'
                }`}
                title="Custom duration"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
              </button>
            </div>
            {useCustom && (
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  value={customBlocks}
                  onChange={(e) => setCustomBlocks(e.target.value)}
                  min="1"
                  max={MAX_LOCK_DURATION_BLOCKS}
                  className="input flex-1 text-sm py-1"
                  placeholder="Blocks"
                />
                <span className="text-[10px] text-[var(--foreground-muted)] whitespace-nowrap">
                  {parseInt(customBlocks) > 0 ? blocksToTimeString(parseInt(customBlocks)) : '~10min/block'}
                </span>
              </div>
            )}
            {exceedsMaxDuration && (
              <p className="text-[10px] text-[var(--danger)] mt-1">Max: 1 year</p>
            )}
          </div>

          {/* Tag - compact */}
          <div className="relative z-10">
            <label className="text-xs font-medium text-[var(--foreground-muted)] mb-1 block">Tag (optional)</label>
            <TagInput
              value={tag}
              onChange={setTag}
              placeholder="e.g., quality, funny"
            />
          </div>

          {/* Preview + Submit combined */}
          <div className="pt-1">
            {satsNum > 0 && actualBlocks > 0 && !exceedsMaxDuration && (
              <div className="text-center mb-2">
                <span className="text-xs text-[var(--foreground-muted)]">
                  {formatSats(satsNum)} × {blocksToTimeString(actualBlocks)} =
                </span>
                <span className="text-sm font-semibold text-[var(--accent)] ml-1">
                  {formatWrootz(wrootzValue)} wrootz
                </span>
              </div>
            )}
            <button
              type="submit"
              disabled={loading || satsNum <= 0 || (userBalanceSats > 0 && satsNum > userBalanceSats) || actualBlocks < 1 || exceedsMaxDuration}
              className="btn btn-primary w-full py-2 text-sm"
            >
              {loading ? getStatusMessage() : `Lock ${satsNum > 0 ? formatSats(satsNum) : '0'} sats`}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
