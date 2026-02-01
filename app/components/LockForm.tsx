'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordLock } from '@/app/actions/posts'
import { LOCK_DURATION_PRESETS, MAX_LOCK_DURATION_BLOCKS, formatSats, blocksToTimeString, formatWrootz, calculateWrootzFromSats } from '@/app/lib/constants'
import TagInput from './TagInput'
import SatsInput from './SatsInput'
import { useWallet } from './WalletProvider'

interface LockFormProps {
  postId: string
}

export default function LockForm({ postId }: LockFormProps) {
  const router = useRouter()
  const { isConnected, balance, currentWallet, connect } = useWallet()

  const userBalanceSats = balance?.satoshis ?? 0
  const [amountSats, setAmountSats] = useState('')
  const [durationBlocks, setDurationBlocks] = useState(LOCK_DURATION_PRESETS.find(p => p.default)?.blocks || 144)
  const [customBlocks, setCustomBlocks] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [tag, setTag] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [txStatus, setTxStatus] = useState<'idle' | 'signing' | 'broadcasting' | 'confirming'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

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

    if (sats > userBalanceSats) {
      setError('Insufficient balance')
      return
    }

    setLoading(true)
    setTxStatus('signing')

    try {
      // Call wallet to create the lock transaction
      const lockResult = await currentWallet!.lockBSV(sats, blocks)

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
        // Success! Refresh the page to show updated data
        router.refresh()
        setAmountSats('')
        setTag('')
      }
    } catch (err) {
      console.error('Lock transaction failed:', err)
      setError(err instanceof Error ? err.message : 'Transaction failed. Please try again.')
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
        return 'Please sign the transaction in your wallet...'
      case 'broadcasting':
        return 'Broadcasting transaction to BSV network...'
      case 'confirming':
        return 'Transaction sent! Waiting for confirmation...'
      default:
        return null
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 overflow-visible">
      {error && (
        <div className="p-3 bg-[var(--danger)] text-white rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Transaction status */}
      {txStatus !== 'idle' && (
        <div className="p-3 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg text-sm flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {getStatusMessage()}
        </div>
      )}

      {/* Wallet not connected warning */}
      {!isConnected && (
        <div className="p-3 bg-[var(--surface-2)] rounded-lg text-sm text-center">
          <p className="text-[var(--foreground-muted)] mb-2">Connect your wallet to lock real BSV</p>
          <button
            type="button"
            onClick={() => connect()}
            className="btn btn-primary btn-sm"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {/* Amount */}
      <div>
        <label className="label">Amount (sats)</label>
        {/* Quick amount presets */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[
            { sats: 10000, label: '10K' },
            { sats: 50000, label: '50K' },
            { sats: 100000, label: '100K' },
            { sats: 1000000, label: '1M' },
            { sats: 10000000, label: '10M' },
            { sats: 100000000, label: '1 BSV' },
          ].map(({ sats, label }) => (
            <button
              key={sats}
              type="button"
              onClick={() => setAmountSats(String(sats))}
              disabled={sats > userBalanceSats}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                parseInt(amountSats) === sats
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : sats > userBalanceSats
                  ? 'bg-[var(--surface-2)] text-[var(--foreground-muted)] border-[var(--border)] opacity-50 cursor-not-allowed'
                  : 'bg-[var(--surface-2)] text-[var(--foreground-secondary)] border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Custom amount</label>
          <SatsInput
            value={amountSats}
            onChange={setAmountSats}
            max={userBalanceSats}
            placeholder="Enter sats"
            className="w-full"
          />
        </div>
        <p className="text-xs text-[var(--muted)] mt-1">
          {isConnected
            ? `Wallet balance: ${formatSats(userBalanceSats)} sats`
            : 'Connect wallet to see balance'
          }
        </p>
      </div>

      {/* Duration */}
      <div>
        <label className="label">Lock Duration</label>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {LOCK_DURATION_PRESETS.map((preset) => (
            <button
              key={preset.blocks}
              type="button"
              onClick={() => {
                setDurationBlocks(preset.blocks)
                setUseCustom(false)
              }}
              className={`p-2 rounded-lg text-sm border-2 transition-colors ${
                !useCustom && durationBlocks === preset.blocks
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                  : 'border-[var(--card-border)] hover:border-[var(--primary)]'
              }`}
            >
              <div className="font-medium">{preset.label}</div>
              <div className={`text-xs ${!useCustom && durationBlocks === preset.blocks ? 'text-white opacity-75' : 'text-[var(--muted)]'}`}>
                {preset.description}
              </div>
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useCustom"
            checked={useCustom}
            onChange={(e) => setUseCustom(e.target.checked)}
            className="rounded accent-[var(--primary)] flex-shrink-0"
          />
          <label htmlFor="useCustom" className="text-sm flex-shrink-0">Custom:</label>
          <input
            type="number"
            value={customBlocks}
            onChange={(e) => setCustomBlocks(e.target.value)}
            disabled={!useCustom}
            min="1"
            className="input flex-1 min-w-0 disabled:opacity-50"
            placeholder="Blocks"
          />
        </div>
        {useCustom && parseInt(customBlocks) > 0 && (
          exceedsMaxDuration ? (
            <p className="text-xs text-[var(--danger)] mt-1 font-medium">
              Maximum lock duration is 1 year ({MAX_LOCK_DURATION_BLOCKS.toLocaleString()} blocks)
            </p>
          ) : (
            <p className="text-xs text-[var(--muted)] mt-1">
              Duration: {blocksToTimeString(parseInt(customBlocks))}
            </p>
          )
        )}
      </div>

      {/* Tag */}
      <div className="relative z-10">
        <label className="label">Tag (optional)</label>
        <TagInput
          value={tag}
          onChange={setTag}
          placeholder="e.g., quality, funny, informative"
        />
        <p className="text-xs text-[var(--muted)] mt-1">
          One tag per lock. Choose wisely!
        </p>
      </div>

      {/* Wrootz Preview - Only show when user has entered values */}
      {satsNum > 0 && actualBlocks > 0 && (
        <div className="p-2 rounded-lg text-center bg-[var(--accent-light)] border border-[var(--accent)]">
          <p className="text-xs text-[var(--accent)]">
            Locking {formatSats(satsNum)} sats for {blocksToTimeString(actualBlocks)} = <span className="font-semibold">{formatWrootz(wrootzValue)} wrootz</span>
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !isConnected || satsNum <= 0 || satsNum > userBalanceSats || actualBlocks < 1 || exceedsMaxDuration}
        className="btn btn-primary w-full text-lg py-3"
      >
        {loading ? 'Processing...' : isConnected ? `Lock ${formatSats(satsNum)} sats` : 'Connect Wallet to Lock'}
      </button>

      {/* Real BSV indicator */}
      <p className="text-xs text-center text-[var(--foreground-muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Real BSV on mainnet
        </span>
      </p>
    </form>
  )
}
