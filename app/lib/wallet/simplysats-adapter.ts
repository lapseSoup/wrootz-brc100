/**
 * Simply Sats Wallet Adapter
 *
 * Connects to the Simply Sats desktop wallet via deep links (simplysats://)
 * and postMessage communication for localhost development.
 *
 * Simply Sats is a lightweight BRC-100 wallet that supports:
 * - Identity key for authentication
 * - Standard P2PKH addresses for payments
 * - Message signing
 */

import type { WalletProvider, WalletBalance, SendResult, LockResult, InscriptionData, InscriptionResult, LockedOutput, UnlockResult } from './types'

// Message types for communication
interface SimplySatsMessage {
  type: 'connect' | 'getPublicKey' | 'sign' | 'send'
  id: string
  payload?: any
}

interface SimplySatsResponse {
  id: string
  success: boolean
  data?: any
  error?: string
}

export class SimplySatsAdapter implements WalletProvider {
  name = 'Simply Sats'
  icon = '/wallets/simplysats.png'

  private _isConnected = false
  private identityKey: string | null = null
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map()
  private accountChangeCallbacks: ((address: string) => void)[] = []
  private disconnectCallbacks: (() => void)[] = []

  constructor() {
    // Listen for messages from Simply Sats (for localhost dev)
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleMessage.bind(this))

      // Check for stored connection
      const stored = localStorage.getItem('simplysats_identity_key')
      if (stored) {
        this.identityKey = stored
        this._isConnected = true
      }
    }
  }

  private handleMessage(event: MessageEvent) {
    // Verify origin for security (localhost for dev)
    if (!event.origin.includes('localhost') && !event.origin.includes('simplysats')) {
      return
    }

    const data = event.data as SimplySatsResponse
    if (!data || !data.id) return

    const pending = this.pendingRequests.get(data.id)
    if (pending) {
      if (data.success) {
        pending.resolve(data.data)
      } else {
        pending.reject(new Error(data.error || 'Request failed'))
      }
      this.pendingRequests.delete(data.id)
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  /**
   * Check if Simply Sats is available
   * For desktop app, we can't easily detect - return true and let connection fail gracefully
   */
  isInstalled(): boolean {
    return typeof window !== 'undefined'
  }

  isConnected(): boolean {
    return this._isConnected
  }

  /**
   * Connect to Simply Sats wallet
   * Opens the wallet via deep link and waits for connection response
   */
  async connect(): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('Cannot connect in server environment')
    }

    // For localhost development, prompt user to manually enter their identity key
    // In production, this would use deep links or postMessage

    // Try to open Simply Sats via deep link
    const connectUrl = `simplysats://connect?origin=${encodeURIComponent(window.location.origin)}&callback=${encodeURIComponent(window.location.href)}`

    // Open the deep link
    window.location.href = connectUrl

    // For now, show a prompt for manual entry (since deep link response needs app handling)
    return new Promise((resolve, reject) => {
      // Give the app time to open, then prompt for manual entry
      setTimeout(() => {
        const identityKey = prompt(
          'Simply Sats should have opened.\n\n' +
          'Please copy your Identity Key from Simply Sats (Settings > Identity Key) and paste it here:\n\n' +
          '(This is a temporary solution for localhost development)'
        )

        if (identityKey && identityKey.length > 30) {
          this.identityKey = identityKey.trim()
          this._isConnected = true
          localStorage.setItem('simplysats_identity_key', this.identityKey)
          resolve(this.identityKey)
        } else {
          reject(new Error('Connection cancelled or invalid identity key'))
        }
      }, 1500)
    })
  }

  async disconnect(): Promise<void> {
    this._isConnected = false
    this.identityKey = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('simplysats_identity_key')
    }
    this.disconnectCallbacks.forEach(cb => cb())
  }

  async getAddress(): Promise<string> {
    if (!this.identityKey) {
      throw new Error('Wallet not connected')
    }
    return this.identityKey
  }

  async getBalance(): Promise<WalletBalance> {
    // Simply Sats doesn't expose balance via the protocol
    // Return 0 - the user can see their balance in the wallet app
    console.log('Simply Sats: Balance checking not supported via external connection')
    return {
      bsv: 0,
      satoshis: 0,
      usd: undefined
    }
  }

  async getPubKey(): Promise<string> {
    if (!this.identityKey) {
      throw new Error('Wallet not connected')
    }
    return this.identityKey
  }

  async sendBSV(to: string, satoshis: number): Promise<SendResult> {
    // Open Simply Sats with a send request
    const sendUrl = `simplysats://send?to=${encodeURIComponent(to)}&amount=${satoshis}&origin=${encodeURIComponent(window.location.origin)}`
    window.location.href = sendUrl

    throw new Error('Please approve the transaction in Simply Sats wallet')
  }

  async lockBSV(satoshis: number, blocks: number, ordinalOrigin?: string): Promise<LockResult> {
    // Locking requires wallet-side implementation
    throw new Error('Locking not yet supported via Simply Sats external connection. Please use the wallet directly.')
  }

  async listLocks(): Promise<LockedOutput[]> {
    // Would need wallet API
    return []
  }

  async unlockBSV(outpoint: string): Promise<UnlockResult> {
    throw new Error('Unlocking not yet supported via Simply Sats external connection.')
  }

  async signMessage(message: string): Promise<string> {
    // Open Simply Sats with a sign request
    const signUrl = `simplysats://sign?message=${encodeURIComponent(message)}&origin=${encodeURIComponent(window.location.origin)}`
    window.location.href = signUrl

    throw new Error('Please approve the signature in Simply Sats wallet')
  }

  async inscribe(data: InscriptionData): Promise<InscriptionResult> {
    throw new Error('Inscriptions not yet supported via Simply Sats external connection. Please use the wallet directly.')
  }

  onAccountChange(callback: (address: string) => void): void {
    this.accountChangeCallbacks.push(callback)
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback)
  }

  // Simply Sats specific methods

  async getNetwork(): Promise<'mainnet' | 'testnet'> {
    return 'mainnet' // Simply Sats is mainnet only for now
  }

  async getBlockHeight(): Promise<number> {
    // Fetch from WhatsOnChain
    try {
      const response = await fetch('https://api.whatsonchain.com/v1/bsv/main/chain/info')
      const data = await response.json()
      return data.blocks
    } catch {
      return 0
    }
  }
}

export const simplySatsWallet = new SimplySatsAdapter()
