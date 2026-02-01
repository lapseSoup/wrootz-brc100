// Wallet manager - unified interface for BRC-100 wallets

import type { WalletProvider, WalletType } from './types'
import { BRC100WalletAdapter } from './brc100-adapter'

export * from './types'

// Singleton instance
const brc100Wallet = new BRC100WalletAdapter()

export function getWalletAdapter(type: WalletType): WalletProvider | null {
  if (type === 'brc100') {
    return brc100Wallet
  }
  return null
}

export function getAvailableWallets(): { type: WalletType; name: string; installed: boolean; description?: string }[] {
  return [
    {
      type: 'brc100',
      name: 'BRC-100 Wallet',
      installed: brc100Wallet.isInstalled(),
      description: 'Connect any BRC-100 compatible wallet (Metanet Desktop, SPV Wallet, etc.)'
    }
  ]
}

// Helper to detect which wallet is available/preferred
export function detectPreferredWallet(): WalletType {
  return 'brc100'
}

// Wallet state management will be handled by React context
// This file just exports the adapters and utilities

export { brc100Wallet }
