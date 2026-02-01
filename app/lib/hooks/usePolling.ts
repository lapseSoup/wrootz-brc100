'use client'

import { useState, useEffect, useCallback } from 'react'

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>
  interval?: number // in milliseconds
  enabled?: boolean
  onUpdate?: (data: T) => void
}

export function usePolling<T>({
  fetcher,
  interval = 10000, // default 10 seconds
  enabled = true,
  onUpdate
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcher()
      setData(result)
      setError(null)
      onUpdate?.(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch'))
    } finally {
      setLoading(false)
    }
  }, [fetcher, onUpdate])

  useEffect(() => {
    if (!enabled) return

    // Initial fetch
    fetchData()

    // Set up polling interval
    const pollInterval = setInterval(fetchData, interval)

    return () => clearInterval(pollInterval)
  }, [enabled, interval, fetchData])

  // Manual refresh function
  const refresh = useCallback(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh }
}
