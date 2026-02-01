'use client'

import { useState } from 'react'

interface VerificationBadgeProps {
  postId: string
  inscriptionTxid?: string | null
}

interface VerificationResult {
  fullyVerified: boolean
  inscription?: {
    verified: boolean
    txid: string
  }
  locks: {
    total: number
    verified: number
    active: number
    verifiedWrootz: number
    verifiedActiveSatoshis: number
  }
  verifiedAt: string
}

export default function VerificationBadge({
  postId,
  inscriptionTxid
}: VerificationBadgeProps) {
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const verify = async () => {
    setVerifying(true)
    setError(null)

    try {
      const response = await fetch(`/api/verify/post/${postId}`)
      if (!response.ok) {
        throw new Error('Verification failed')
      }
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  // Not verified yet - show verify button
  if (!result) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={verify}
          disabled={verifying}
          className="btn btn-sm bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--foreground-secondary)] border border-[var(--border)] w-full"
        >
          {verifying ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Verifying...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify on Blockchain
            </>
          )}
        </button>
        {error && (
          <p className="text-xs text-[var(--danger)]">{error}</p>
        )}
        <p className="text-[10px] text-[var(--foreground-muted)] text-center">
          Free verification via WhatsOnChain API
        </p>
      </div>
    )
  }

  // Show verification results
  const allVerified = result.fullyVerified
  const verifiedAt = new Date(result.verifiedAt).toLocaleString()

  return (
    <div className="space-y-2">
      {/* Overall status */}
      <div className={`flex items-center gap-2 p-2 rounded-lg ${
        allVerified
          ? 'bg-green-500/10 border border-green-500/30'
          : 'bg-yellow-500/10 border border-yellow-500/30'
      }`}>
        {allVerified ? (
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${allVerified ? 'text-green-500' : 'text-yellow-500'}`}>
            {allVerified ? 'Fully Verified' : 'Partially Verified'}
          </p>
          <p className="text-[10px] text-[var(--foreground-muted)]">
            Checked on blockchain
          </p>
        </div>
      </div>

      {/* Inscription status */}
      {inscriptionTxid && result.inscription && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--foreground-muted)]">Ordinal:</span>
          <span className={`flex items-center gap-1 ${
            result.inscription.verified ? 'text-green-500' : 'text-yellow-500'
          }`}>
            {result.inscription.verified ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Verified
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Not verified
              </>
            )}
          </span>
        </div>
      )}

      {/* Locks status */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--foreground-muted)]">Locks:</span>
        <span className={`flex items-center gap-1 ${
          result.locks.verified === result.locks.total ? 'text-green-500' : 'text-yellow-500'
        }`}>
          {result.locks.verified === result.locks.total ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
          )}
          {result.locks.verified}/{result.locks.total} verified
        </span>
      </div>

      {/* Active locks with on-chain amounts */}
      {result.locks.active > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--foreground-muted)]">Active (unspent):</span>
          <span className="text-[var(--foreground)]">
            {result.locks.active} ({(result.locks.verifiedActiveSatoshis / 100_000_000).toFixed(8)} BSV)
          </span>
        </div>
      )}

      {/* Re-verify button */}
      <button
        onClick={verify}
        disabled={verifying}
        className="text-xs text-[var(--primary)] hover:underline w-full text-center"
      >
        {verifying ? 'Verifying...' : 'Re-verify'}
      </button>

      <p className="text-[10px] text-[var(--foreground-muted)] text-center">
        Last verified: {verifiedAt}
      </p>
    </div>
  )
}
