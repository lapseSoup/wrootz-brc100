'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { listForSale, cancelSale, buyPost } from '@/app/actions/posts'
import { getSellerAddress } from '@/app/actions/posts/sales'
import { formatSats, bsvToSats, satsToBsv } from '@/app/lib/constants'
import SatsInput from '@/app/components/SatsInput'
import Spinner from '@/app/components/Spinner'
import { useWallet } from '@/app/components/WalletProvider'
import { useMountedRef } from '@/app/hooks/useMountedRef'
import { getErrorDetails } from '@/app/lib/wallet/errors'

interface SaleActionsProps {
  postId: string
  action: 'list' | 'cancel' | 'buy'
  salePrice?: number // in BSV
  currentLockerShare?: number // current locker share percentage
}

export default function SaleActions({ postId, action, salePrice, currentLockerShare = 10 }: SaleActionsProps) {
  const router = useRouter()
  const { isConnected, currentWallet, connect } = useWallet()
  const [priceSats, setPriceSats] = useState('')
  const [lockerShare, setLockerShare] = useState(currentLockerShare)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [txStatus, setTxStatus] = useState<'idle' | 'signing' | 'broadcasting' | 'confirming'>('idle')
  const [completedTxid, setCompletedTxid] = useState<string | null>(null)

  const mountedRef = useMountedRef()

  // On mount, recover any pending purchase txid that survived a page refresh
  useEffect(() => {
    if (action === 'buy') {
      try {
        const savedTxid = localStorage.getItem(`pending-purchase-${postId}`)
        if (savedTxid) {
          setCompletedTxid(savedTxid)
          setError(`Previous purchase may be pending. txid: ${savedTxid}`)
        }
      } catch { /* ignore */ }
    }
  }, [action, postId])

  const handleList = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const sats = parseInt(priceSats)
      if (isNaN(sats) || sats < 1) {
        setError('Please enter a valid amount in sats')
        return
      }

      const formData = new FormData()
      formData.set('postId', postId)
      formData.set('salePrice', String(satsToBsv(sats)))
      formData.set('lockerSharePercentage', String(lockerShare))

      const result = await listForSale(formData)

      if (!mountedRef.current) return
      if (result?.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to list for sale')
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  const handleCancel = async () => {
    setError('')
    setLoading(true)

    try {
      const formData = new FormData()
      formData.set('postId', postId)

      const result = await cancelSale(formData)

      if (!mountedRef.current) return
      if (result?.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to cancel sale')
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  const handleBuy = async () => {
    setError('')
    setLoading(true)

    try {
      // Ensure wallet is connected
      let wallet = currentWallet
      if (!isConnected || !wallet) {
        try {
          const result = await connect()
          wallet = result.wallet
        } catch {
          if (mountedRef.current) setError('Please connect your wallet first')
          return
        }
      }

      const salePriceSats = salePrice ? bsvToSats(salePrice) : 0
      if (salePriceSats <= 0) {
        setError('Invalid sale price')
        return
      }

      if (!mountedRef.current) return

      // Fetch seller address server-side to prevent client-side tampering
      const sellerResult = await getSellerAddress(postId)
      if (sellerResult.error || !sellerResult.address) {
        setError(sellerResult.error || 'Could not determine seller address')
        return
      }

      if (!mountedRef.current) return
      setTxStatus('signing')

      // Send payment to seller via wallet
      const sendResult = await wallet.sendBSV(sellerResult.address, salePriceSats)

      if (!mountedRef.current) return
      setTxStatus('broadcasting')
      setCompletedTxid(sendResult.txid)
      // Persist txid so recovery survives a page refresh if server confirmation fails
      try { localStorage.setItem(`pending-purchase-${postId}`, sendResult.txid) } catch { /* ignore */ }

      // Submit txid to server for verification and ownership transfer
      const formData = new FormData()
      formData.set('postId', postId)
      formData.set('txid', sendResult.txid)

      if (!mountedRef.current) return
      setTxStatus('confirming')
      const result = await buyPost(formData)

      if (!mountedRef.current) return
      if (result?.error) {
        setError(`${result.error} (txid: ${sendResult.txid})`)
      } else {
        setCompletedTxid(null)
        try { localStorage.removeItem(`pending-purchase-${postId}`) } catch { /* ignore */ }
        router.refresh()
      }
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Buy transaction failed:', err)
      const errorDetails = getErrorDetails(err)
      const txidSuffix = completedTxid ? ` (txid: ${completedTxid})` : ''
      setError(errorDetails.message + txidSuffix)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setTxStatus('idle')
      }
    }
  }

  if (action === 'list') {
    return (
      <form onSubmit={handleList} className="space-y-3">
        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>
        )}
        <div>
          <label className="label">Sale Price (sats)</label>
          <SatsInput
            value={priceSats}
            onChange={setPriceSats}
            placeholder="100,000,000"
          />
          <p className="text-xs text-[var(--muted)] mt-1">
            1 BSV = 100,000,000 sats
          </p>
        </div>
        <div>
          <label className="label">Locker Share Percentage</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={lockerShare}
              onChange={(e) => setLockerShare(parseInt(e.target.value))}
              className="flex-1 accent-[var(--primary)]"
            />
            <span className="text-sm font-medium w-12 text-right">{lockerShare}%</span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Percentage of sale that goes to lockers
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn btn-accent w-full"
        >
          {loading ? 'Listing...' : 'List for Sale'}
        </button>
      </form>
    )
  }

  if (action === 'cancel') {
    return (
      <div className="space-y-3">
        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>
        )}
        <button
          onClick={handleCancel}
          disabled={loading}
          className="btn btn-danger w-full"
        >
          {loading ? 'Canceling...' : 'Cancel Sale'}
        </button>
      </div>
    )
  }

  if (action === 'buy') {
    const salePriceSats = salePrice ? bsvToSats(salePrice) : 0
    const getStatusMessage = () => {
      switch (txStatus) {
        case 'signing': return 'Sign in wallet...'
        case 'broadcasting': return 'Broadcasting...'
        case 'confirming': return 'Confirming...'
        default: return null
      }
    }
    return (
      <div className="space-y-3">
        {error && (
          <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>
        )}
        {txStatus !== 'idle' && (
          <div className="p-2 bg-[var(--primary-light)] text-[var(--primary)] rounded text-xs flex items-center gap-2" aria-live="polite">
            <Spinner className="w-3 h-3" />
            {getStatusMessage()}
          </div>
        )}
        {!isConnected ? (
          <button
            type="button"
            onClick={() => connect()}
            className="btn btn-primary"
          >
            Connect Wallet to Buy
          </button>
        ) : (
          <button
            onClick={handleBuy}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? getStatusMessage() || 'Buying...' : `Buy for ${formatSats(salePriceSats)} sats`}
          </button>
        )}
      </div>
    )
  }

  return null
}
