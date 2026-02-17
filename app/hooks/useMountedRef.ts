import { useRef, useEffect } from 'react'

/**
 * Returns a ref that tracks whether the component is still mounted.
 * Useful for preventing state updates after unmount in async operations.
 */
export function useMountedRef() {
  const mountedRef = useRef(true)
  useEffect(() => { return () => { mountedRef.current = false } }, [])
  return mountedRef
}
