'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface UsePollingOptions<T> {
  fetcher: (signal: AbortSignal) => Promise<T>
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
  const abortControllerRef = useRef<AbortController | null>(null)

  // Store onUpdate in a ref so fetchData doesn't need it as a dependency,
  // preventing an infinite re-render loop when callers pass inline functions.
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  const fetchData = useCallback(async () => {
    // L9: Abort any in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const result = await fetcher(controller.signal)
      // Only update state if this request was not aborted
      if (!controller.signal.aborted) {
        setData(result)
        setError(null)
        onUpdateRef.current?.(result)
      }
    } catch (err) {
      // Ignore abort errors — they are expected during cleanup/new requests
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error('Failed to fetch'))
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [fetcher])

  useEffect(() => {
    if (!enabled) return

    // Initial fetch
    fetchData()

    // Set up polling interval
    const pollInterval = setInterval(fetchData, interval)

    return () => {
      clearInterval(pollInterval)
      // L9: Abort any in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [enabled, interval, fetchData])

  // Manual refresh function
  const refresh = useCallback(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh }
}
