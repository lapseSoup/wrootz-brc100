// Wallet manager - unified interface for BRC-100 wallets

import type { WalletProvider, WalletType } from './types'
import { BRC100WalletAdapter } from './brc100-adapter'
import { SimplySatsAdapter } from './simplysats-adapter'

export * from './types'

// Singleton instances
const brc100Wallet = new BRC100WalletAdapter()
const simplySatsWallet = new SimplySatsAdapter()

export function getWalletAdapter(type: WalletType): WalletProvider | null {
  if (type === 'brc100') {
    return brc100Wallet
  }
  if (type === 'simplysats') {
    return simplySatsWallet
  }
  return null
}

export function getAvailableWallets(): { type: WalletType; name: string; installed: boolean; description?: string }[] {
  return [
    {
      type: 'simplysats',
      name: 'Simply Sats',
      installed: simplySatsWallet.isInstalled(),
      description: 'Connect to Simply Sats desktop wallet'
    },
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
  // Prefer Simply Sats if connected
  if (simplySatsWallet.isConnected()) {
    return 'simplysats'
  }
  return 'brc100'
}

// Wallet state management will be handled by React context
// This file just exports the adapters and utilities

export { brc100Wallet, simplySatsWallet }
