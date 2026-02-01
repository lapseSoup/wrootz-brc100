'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { listForSale, cancelSale, buyPost } from '@/app/actions/posts'
import { formatSats, bsvToSats, satsToBsv } from '@/app/lib/constants'
import SatsInput from '@/app/components/SatsInput'

interface SaleActionsProps {
  postId: string
  action: 'list' | 'cancel' | 'buy'
  salePrice?: number // in BSV
  currentLockerShare?: number // current locker share percentage
}

export default function SaleActions({ postId, action, salePrice, currentLockerShare = 10 }: SaleActionsProps) {
  const router = useRouter()
  const [priceSats, setPriceSats] = useState('')
  const [lockerShare, setLockerShare] = useState(currentLockerShare)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleList = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const sats = parseInt(priceSats)
    if (isNaN(sats) || sats < 1) {
      setError('Please enter a valid amount in sats')
      setLoading(false)
      return
    }

    const formData = new FormData()
    formData.set('postId', postId)
    formData.set('salePrice', String(satsToBsv(sats)))
    formData.set('lockerSharePercentage', String(lockerShare))

    const result = await listForSale(formData)

    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
    router.refresh()
  }

  const handleCancel = async () => {
    setError('')
    setLoading(true)

    const formData = new FormData()
    formData.set('postId', postId)

    const result = await cancelSale(formData)

    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
    router.refresh()
  }

  const handleBuy = async () => {
    setError('')
    setLoading(true)

    const formData = new FormData()
    formData.set('postId', postId)

    const result = await buyPost(formData)

    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
    router.refresh()
  }

  if (action === 'list') {
    return (
      <form onSubmit={handleList} className="space-y-3">
        {error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
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
          <p className="text-sm text-[var(--danger)]">{error}</p>
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
    return (
      <div className="space-y-3">
        {error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        <button
          onClick={handleBuy}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Buying...' : `Buy for ${formatSats(salePriceSats)} sats`}
        </button>
      </div>
    )
  }

  return null
}
