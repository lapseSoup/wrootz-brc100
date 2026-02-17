'use client'

import { useState, useTransition } from 'react'
import { tipPost } from '@/app/actions/posts'
import { formatSats, bsvToSats, satsToBsv } from '@/app/lib/constants'
import SatsInput from './SatsInput'
import Spinner from './Spinner'
import { useMountedRef } from '@/app/hooks/useMountedRef'

interface TipFormProps {
  postId: string
  ownerUsername: string
  userBalance: number
}

export default function TipForm({ postId, ownerUsername, userBalance }: TipFormProps) {
  const [amount, setAmount] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const mountedRef = useMountedRef()

  const amountNum = parseInt(amount) || 0
  const amountBsv = satsToBsv(amountNum)
  const maxSats = bsvToSats(userBalance)

  const quickAmounts = [1000, 5000, 10000, 50000]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (amountNum <= 0) {
      setError('Enter an amount to tip')
      return
    }

    if (amountNum > maxSats) {
      setError('Insufficient balance')
      return
    }

    const formData = new FormData()
    formData.set('postId', postId)
    formData.set('amount', amountBsv.toString())

    startTransition(async () => {
      const result = await tipPost(formData)
      if (!mountedRef.current) return
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setAmount('')
        // Reset success message after 3 seconds
        setTimeout(() => {
          if (mountedRef.current) setSuccess(false)
        }, 3000)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Quick amount buttons */}
      <div className="flex flex-wrap gap-1.5">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => setAmount(amt.toString())}
            disabled={amt > maxSats}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
              parseInt(amount) === amt
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : amt > maxSats
                ? 'bg-[var(--surface-2)] text-[var(--foreground-muted)] border-[var(--border)] opacity-50 cursor-not-allowed'
                : 'bg-[var(--surface-2)] text-[var(--foreground-secondary)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            {formatSats(amt)}
          </button>
        ))}
      </div>

      {/* Custom amount input */}
      <div className="flex gap-2">
        <SatsInput
          value={amount}
          onChange={setAmount}
          placeholder="Custom amount"
          className="flex-1 text-sm"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || amountNum <= 0 || amountNum > maxSats}
          className="btn btn-accent btn-sm px-4"
        >
          {isPending ? (
            <span className="flex items-center gap-1.5">
              <Spinner className="w-3.5 h-3.5" />
              Sending
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tip
            </span>
          )}
        </button>
      </div>

      {/* Feedback messages */}
      {error && (
        <p className="text-xs text-[var(--danger)]" role="alert">{error}</p>
      )}
      {success && (
        <p className="text-xs text-[var(--accent)]">
          Tip sent to @{ownerUsername}!
        </p>
      )}

      {/* Balance reminder */}
      <p className="text-[10px] text-[var(--foreground-muted)]">
        Your balance: {formatSats(maxSats)} sats
      </p>
    </form>
  )
}
