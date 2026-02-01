'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import type { WalletType, WalletState, WalletProvider as WalletProviderInterface } from '@/app/lib/wallet'
import { getWalletAdapter, getAvailableWallets, detectPreferredWallet } from '@/app/lib/wallet'

interface WalletContextValue extends WalletState {
  // Actions
  connect: (type?: WalletType) => Promise<string>
  disconnect: () => Promise<void>
  refreshBalance: () => Promise<void>

  // Wallet info
  availableWallets: { type: WalletType; name: string; installed: boolean; description?: string }[]
  currentWallet: WalletProviderInterface | null
}

const WalletContext = createContext<WalletContextValue | null>(null)

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

  // Check available wallets on mount
  useEffect(() => {
    // Check immediately
    setAvailableWallets(getAvailableWallets())

    // Check if we have a saved wallet preference
    const savedType = localStorage.getItem('walletType') as WalletType | null
    if (savedType && savedType !== 'none') {
      // Try to reconnect to saved wallet
      const adapter = getWalletAdapter(savedType)
      if (adapter && adapter.isInstalled()) {
        // Don't auto-connect, but remember the preference
        setState(prev => ({ ...prev, type: savedType }))
      }
    }

    // Recheck after delays for slow-loading extensions
    const timer1 = setTimeout(() => {
      setAvailableWallets(getAvailableWallets())
    }, 500)

    const timer2 = setTimeout(() => {
      setAvailableWallets(getAvailableWallets())
    }, 1500)

    // Listen for Yours Wallet ready event
    const handleYoursReady = () => {
      setAvailableWallets(getAvailableWallets())
    }
    window.addEventListener('yours#initialized', handleYoursReady)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      window.removeEventListener('yours#initialized', handleYoursReady)
    }
  }, [])

  const connect = useCallback(async (type?: WalletType): Promise<string> => {
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
      const balance = await adapter.getBalance()

      // Save preference
      localStorage.setItem('walletType', walletType)

      // Set up event listeners
      adapter.onAccountChange(async (newAddress) => {
        const newBalance = await adapter.getBalance()
        setState(prev => ({
          ...prev,
          address: newAddress,
          balance: newBalance
        }))
      })

      adapter.onDisconnect(() => {
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

      setState({
        type: walletType,
        address,
        balance,
        isConnected: true,
        isConnecting: false,
        error: null
      })

      setCurrentWallet(adapter)
      return address
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

  const value: WalletContextValue = {
    ...state,
    connect,
    disconnect,
    refreshBalance,
    availableWallets,
    currentWallet
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
