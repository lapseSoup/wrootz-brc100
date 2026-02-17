'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react'
import type { WalletType, WalletState, WalletProvider as WalletProviderInterface } from '@/app/lib/wallet'
import { getWalletAdapter, getAvailableWallets, detectPreferredWallet } from '@/app/lib/wallet'

interface ConnectResult {
  address: string
  wallet: WalletProviderInterface
}

// State context — reactive values that change (balance, connection status, etc.)
interface WalletStateContextValue extends WalletState {
  availableWallets: { type: WalletType; name: string; installed: boolean; description?: string }[]
  currentWallet: WalletProviderInterface | null
}

// Actions context — stable callbacks that rarely change
interface WalletActionsContextValue {
  connect: (type?: WalletType) => Promise<ConnectResult>
  disconnect: () => Promise<void>
  refreshBalance: () => Promise<void>
  clearError: () => void
}

const WalletStateContext = createContext<WalletStateContextValue | null>(null)
const WalletActionsContext = createContext<WalletActionsContextValue | null>(null)

interface WalletProviderProps {
  children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [state, setState] = useState<WalletState>({
    type: 'none',
    address: null,
    balance: null,
    isConnected: false,
    isConnecting: false,
    error: null
  })

  const [currentWallet, setCurrentWallet] = useState<WalletProviderInterface | null>(null)
  const [availableWallets, setAvailableWallets] = useState<{ type: WalletType; name: string; installed: boolean; description?: string }[]>([])
  const autoConnectAttempted = useRef(false)
  const listenerCleanup = useRef<(() => void)[]>([])

  const connect = useCallback(async (type?: WalletType): Promise<ConnectResult> => {
    const walletType = type || detectPreferredWallet()
    const adapter = getWalletAdapter(walletType)

    if (!adapter) {
      throw new Error('No wallet adapter found')
    }

    setState(prev => ({
      ...prev,
      isConnecting: true,
      error: null
    }))

    try {
      const address = await adapter.connect()

      // L7: Validate network after connection
      try {
        const network = await adapter.getNetwork?.()
        if (network && network !== 'mainnet') {
          await adapter.disconnect()
          throw new Error('Wrong network. Please switch your wallet to mainnet.')
        }
      } catch (e) {
        // getNetwork may not be available on all adapters - only reject if it returns non-mainnet
        if (e instanceof Error && e.message.includes('Wrong network')) throw e
      }

      const balance = await adapter.getBalance()

      // Save preference
      localStorage.setItem('walletType', walletType)

      // Set up new event listeners into a local array first so that if either
      // setup throws the old cleanups are still intact and no listeners leak.
      const newCleanups: (() => void)[] = []
      try {
        const unsubAccount = adapter.onAccountChange(async (newAddress) => {
          const newBalance = await adapter.getBalance()
          setState(prev => ({
            ...prev,
            address: newAddress,
            balance: newBalance
          }))
        })
        if (unsubAccount) newCleanups.push(unsubAccount)

        const unsubDisconnect = adapter.onDisconnect(() => {
          setState({
            type: 'none',
            address: null,
            balance: null,
            isConnected: false,
            isConnecting: false,
            error: null
          })
          setCurrentWallet(null)
          localStorage.removeItem('walletType')
        })
        if (unsubDisconnect) newCleanups.push(unsubDisconnect)
      } catch (listenerErr) {
        // Clean up any partially registered new listeners before re-throwing
        newCleanups.forEach(fn => fn())
        throw listenerErr
      }

      // Both listeners registered successfully — now swap out the old ones
      listenerCleanup.current.forEach(fn => fn())
      listenerCleanup.current = newCleanups

      setState({
        type: walletType,
        address,
        balance,
        isConnected: true,
        isConnecting: false,
        error: null
      })

      setCurrentWallet(adapter)
      return { address, wallet: adapter }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect wallet'
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: message
      }))
      throw error
    }
  }, [])

  // Check available wallets and auto-reconnect on mount
  useEffect(() => {
    // Check immediately
    setAvailableWallets(getAvailableWallets())

    // Auto-reconnect if we have a saved wallet preference.
    // The identity key is no longer read from localStorage; each adapter
    // restores it from the server-side httpOnly wallet session on init.
    const savedType = localStorage.getItem('walletType') as WalletType | null

    if (savedType && savedType !== 'none' && !autoConnectAttempted.current) {
      autoConnectAttempted.current = true

      // Auto-connect silently in the background
      console.log('Auto-reconnecting to saved wallet...')
      connect(savedType).catch(err => {
        console.warn('Auto-reconnect failed:', err)
        // Clear saved state if auto-connect fails
        localStorage.removeItem('walletType')
      })
    }
  }, [connect])

  const disconnect = useCallback(async () => {
    if (currentWallet) {
      await currentWallet.disconnect()
    }

    setState({
      type: 'none',
      address: null,
      balance: null,
      isConnected: false,
      isConnecting: false,
      error: null
    })

    setCurrentWallet(null)
    localStorage.removeItem('walletType')
  }, [currentWallet])

  const refreshBalance = useCallback(async () => {
    if (!currentWallet || !state.isConnected) return

    try {
      const balance = await currentWallet.getBalance()
      setState(prev => ({ ...prev, balance }))
    } catch (error) {
      console.error('Failed to refresh balance:', error)
    }
  }, [currentWallet, state.isConnected])

  // Store refreshBalance in a ref to avoid dependency issues in useEffect
  const refreshBalanceRef = useRef(refreshBalance)
  refreshBalanceRef.current = refreshBalance

  // Refresh balance periodically when connected
  useEffect(() => {
    if (!state.isConnected) return

    const interval = setInterval(() => refreshBalanceRef.current(), 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [state.isConnected])

  // Clean up all wallet event listeners on unmount
  useEffect(() => {
    return () => {
      listenerCleanup.current.forEach(fn => fn())
      listenerCleanup.current = []
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const stateValue: WalletStateContextValue = {
    ...state,
    availableWallets,
    currentWallet
  }

  // Actions are memoized so consumers of WalletActionsContext don't re-render
  // when balance/connection state changes — only when the callbacks themselves change.
  const actionsValue = useMemo<WalletActionsContextValue>(() => ({
    connect,
    disconnect,
    refreshBalance,
    clearError
  }), [connect, disconnect, refreshBalance, clearError])

  return (
    <WalletStateContext.Provider value={stateValue}>
      <WalletActionsContext.Provider value={actionsValue}>
        {children}
      </WalletActionsContext.Provider>
    </WalletStateContext.Provider>
  )
}

/**
 * Returns combined state + actions. Use for components that need both.
 * Backwards-compatible with the original useWallet() hook.
 */
export function useWallet() {
  const stateCtx = useContext(WalletStateContext)
  const actionsCtx = useContext(WalletActionsContext)
  if (!stateCtx || !actionsCtx) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return { ...stateCtx, ...actionsCtx }
}

/**
 * Returns only the stable action callbacks (connect, disconnect, refreshBalance, clearError).
 * Components that only call wallet actions won't re-render when balance or connection
 * state changes — only when the callbacks themselves change.
 */
export function useWalletActions() {
  const ctx = useContext(WalletActionsContext)
  if (!ctx) {
    throw new Error('useWalletActions must be used within a WalletProvider')
  }
  return ctx
}
