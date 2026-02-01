// Yours Wallet adapter
// Documentation: https://yours-wallet.gitbook.io/provider-api

import type { WalletProvider, WalletBalance, SendResult, LockResult, InscriptionData, InscriptionResult } from './types'

// Types for Yours wallet window object
declare global {
  interface Window {
    yours?: {
      isReady: boolean
      connect: () => Promise<{ identityPubKey: string }>
      disconnect: () => Promise<void>
      isConnected: () => Promise<boolean>
      getPubKeys: () => Promise<{ identityPubKey: string; bsvPubKey: string }>
      getAddresses: () => Promise<{ bsvAddress: string; ordAddress: string }>
      getBalance: () => Promise<{ bsv: number; satoshis: number; usdInCents: number }>
      sendBsv: (params: SendBsvParams[]) => Promise<string>
      lockBsv: (params: LockBsvParams) => Promise<string>
      signMessage: (params: { message: string }) => Promise<{ address: string; sig: string }>
      inscribe: (params: InscribeParams[]) => Promise<{ txid: string; rawtx: string }>
      on: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void
    }
  }
}

interface InscribeParams {
  address: string
  base64Data: string
  mimeType: string
  map?: Record<string, string>
  satoshis?: number
}

interface SendBsvParams {
  address: string
  satoshis: number
}

interface LockBsvParams {
  satoshis: number
  blocks: number
}

export class YoursWalletAdapter implements WalletProvider {
  name = 'Yours Wallet'
  icon = '/wallets/yours.png'

  private accountChangeCallbacks: ((address: string) => void)[] = []
  private disconnectCallbacks: (() => void)[] = []

  isInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.yours
  }

  isConnected(): boolean {
    if (!this.isInstalled()) return false
    // Check synchronously if possible, otherwise return false
    // The actual check is async, so we rely on state management
    return false
  }

  async connect(): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Yours Wallet is not installed. Please install the Chrome extension.')
    }

    const wallet = window.yours!
    await wallet.connect()

    const addresses = await wallet.getAddresses()

    // Set up event listeners
    wallet.on('switchAccount', () => {
      this.handleAccountChange()
    })

    wallet.on('signedOut', () => {
      this.disconnectCallbacks.forEach(cb => cb())
    })

    return addresses.bsvAddress
  }

  async disconnect(): Promise<void> {
    if (!this.isInstalled()) return
    await window.yours!.disconnect()
  }

  async getAddress(): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Yours Wallet is not installed')
    }
    const addresses = await window.yours!.getAddresses()
    return addresses.bsvAddress
  }

  async getBalance(): Promise<WalletBalance> {
    if (!this.isInstalled()) {
      throw new Error('Yours Wallet is not installed')
    }
    const balance = await window.yours!.getBalance()
    return {
      bsv: balance.bsv,
      satoshis: balance.satoshis,
      usd: balance.usdInCents / 100
    }
  }

  async getPubKey(): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Yours Wallet is not installed')
    }
    const pubKeys = await window.yours!.getPubKeys()
    return pubKeys.bsvPubKey
  }

  async sendBSV(to: string, satoshis: number): Promise<SendResult> {
    if (!this.isInstalled()) {
      throw new Error('Yours Wallet is not installed')
    }

    const txid = await window.yours!.sendBsv([{ address: to, satoshis }])

    return {
      txid,
      amount: satoshis
    }
  }

  async lockBSV(satoshis: number, blocks: number): Promise<LockResult> {
    if (!this.isInstalled()) {
      throw new Error('Yours Wallet is not installed')
    }

    // Use Yours wallet's built-in lock feature
    const txid = await window.yours!.lockBsv({ satoshis, blocks })

    // Get current address for the lock address (funds return here)
    const address = await this.getAddress()

    // Calculate unlock block (we'll need to fetch current block height)
    // For now, return 0 - the actual block will be determined by the blockchain
    return {
      txid,
      lockAddress: address,
      amount: satoshis,
      unlockBlock: 0 // Will be populated by monitoring the transaction
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.isInstalled()) {
      throw new Error('Yours Wallet is not installed')
    }

    const result = await window.yours!.signMessage({ message })
    return result.sig
  }

  async inscribe(data: InscriptionData): Promise<InscriptionResult> {
    if (!this.isInstalled()) {
      throw new Error('Yours Wallet is not installed')
    }

    // Get the ordinals address for inscription
    const addresses = await window.yours!.getAddresses()

    const result = await window.yours!.inscribe([{
      address: addresses.ordAddress,
      base64Data: data.base64Data,
      mimeType: data.mimeType,
      map: data.map,
      satoshis: 1 // 1Sat ordinal
    }])

    // The origin is typically txid_0 for single inscriptions
    return {
      txid: result.txid,
      origin: `${result.txid}_0`,
      rawtx: result.rawtx
    }
  }

  onAccountChange(callback: (address: string) => void): void {
    this.accountChangeCallbacks.push(callback)
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback)
  }

  private async handleAccountChange(): Promise<void> {
    try {
      const address = await this.getAddress()
      this.accountChangeCallbacks.forEach(cb => cb(address))
    } catch (e) {
      console.error('Error handling account change:', e)
    }
  }
}

export const yoursWallet = new YoursWalletAdapter()
