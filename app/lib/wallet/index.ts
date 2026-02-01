// Wallet manager - unified interface for all wallet types

import type { WalletProvider, WalletType } from './types'
import { YoursWalletAdapter } from './yours-adapter'
import { BRC100WalletAdapter } from './brc100-adapter'

export * from './types'

// Singleton instances
const yoursWallet = new YoursWalletAdapter()
const brc100Wallet = new BRC100WalletAdapter()

export function getWalletAdapter(type: WalletType): WalletProvider | null {
  switch (type) {
    case 'yours':
      return yoursWallet
    case 'brc100':
      return brc100Wallet
    default:
      return null
  }
}

export function getAvailableWallets(): { type: WalletType; name: string; installed: boolean; description?: string }[] {
  return [
    {
      type: 'brc100',
      name: 'BRC-100 Wallet',
      installed: brc100Wallet.isInstalled(),
      description: 'Connect any BRC-100 compatible wallet (Metanet Desktop, SPV Wallet, etc.)'
    },
    {
      type: 'yours',
      name: 'Yours Wallet',
      installed: yoursWallet.isInstalled(),
      description: yoursWallet.isInstalled()
        ? 'Chrome extension - ready to connect'
        : 'Chrome extension not installed'
    }
  ]
}

// Helper to detect which wallet is available/preferred
export function detectPreferredWallet(): WalletType {
  // Prefer BRC-100 as it's the standard
  return 'brc100'
}

// Wallet state management will be handled by React context
// This file just exports the adapters and utilities

export { yoursWallet, brc100Wallet }
