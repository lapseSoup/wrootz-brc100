'use client'

import useSWR from 'swr'

/**
 * Centralized data fetching hooks for the Wrootz application
 * Uses SWR for caching, deduplication, and automatic revalidation
 */

// Generic fetcher for JSON endpoints
const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const error = new Error('An error occurred while fetching data')
    throw error
  }
  return res.json()
}

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
  block: 30000,      // Block height: every 30 seconds (slower, reduces API calls)
  feed: 30000,       // Feed updates: every 30 seconds
  notifications: 15000, // Notifications: every 15 seconds (more responsive)
  balance: 60000,    // Wallet balance: every 60 seconds
} as const

/**
 * Hook for fetching current block height
 * Used by Header and other components
 */
export function useBlockHeight() {
  const { data, error, isLoading, mutate } = useSWR<{
    currentBlock: number
    secondsUntilNext: number
    network: string
    cached?: boolean
  }>(
    '/api/block',
    fetcher,
    {
      refreshInterval: POLLING_INTERVALS.block,
      revalidateOnFocus: false,
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
    }
  )

  return {
    blockInfo: data,
    isLoading,
    error,
    refresh: mutate,
  }
}

/**
 * Hook for fetching unread notification count
 */
export function useNotificationCount(enabled: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR<{ count: number }>(
    enabled ? '/api/notifications/unread' : null,
    fetcher,
    {
      refreshInterval: POLLING_INTERVALS.notifications,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  )

  return {
    count: data?.count ?? 0,
    isLoading,
    error,
    refresh: mutate,
  }
}

/**
 * Hook for fetching feed posts
 */
export function useFeed(options?: {
  search?: string
  filter?: 'all' | 'following' | 'rising' | 'for-sale' | 'discover'
  archive?: boolean
  showHidden?: boolean
  limit?: number
}) {
  // Build query string
  const params = new URLSearchParams()
  if (options?.search) params.set('search', options.search)
  if (options?.filter && options.filter !== 'all') params.set('filter', options.filter)
  if (options?.archive) params.set('archive', 'true')
  if (options?.showHidden) params.set('hidden', 'true')
  if (options?.limit) params.set('limit', String(options.limit))

  const queryString = params.toString()
  const url = `/api/feed${queryString ? `?${queryString}` : ''}`

  // Using unknown[] since post shape is defined in FeedClient
  const { data, error, isLoading, mutate, isValidating } = useSWR<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    posts: any[]
    searchTags?: string[]
  }>(
    url,
    fetcher,
    {
      refreshInterval: POLLING_INTERVALS.feed,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    posts: data?.posts ?? [],
    searchTags: data?.searchTags,
    isLoading,
    isValidating,
    error,
    refresh: mutate,
  }
}

/**
 * Hook for fetching user balance
 */
export function useUserBalance(enabled: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR<{
    balance: number
    lockedAmount: number
  }>(
    enabled ? '/api/user/balance' : null,
    fetcher,
    {
      refreshInterval: POLLING_INTERVALS.balance,
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  )

  return {
    balance: data?.balance ?? 0,
    lockedAmount: data?.lockedAmount ?? 0,
    isLoading,
    error,
    refresh: mutate,
  }
}

/**
 * Hook for fetching post details
 */
export function usePost(postId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    postId ? `/api/posts/${postId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    post: data?.post,
    isLoading,
    error,
    refresh: mutate,
  }
}

/**
 * Global configuration provider for SWR
 * Wrap your app with this for consistent error handling
 */
export const swrConfig = {
  onError: (error: Error) => {
    // Don't log rate limit errors to console spam
    if (error.message.includes('429')) return
    console.error('SWR Error:', error)
  },
  shouldRetryOnError: (error: Error) => {
    // Don't retry on auth errors
    if (error.message.includes('401')) return false
    return true
  },
}
