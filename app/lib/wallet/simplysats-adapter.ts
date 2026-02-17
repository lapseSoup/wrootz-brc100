/**
 * Simply Sats Wallet Adapter
 *
 * Connects to the Simply Sats desktop wallet via HTTP on port 3322.
 * Simply Sats implements the BRC-100 HTTP-JSON protocol (same as Metanet Desktop).
 *
 * Features:
 * - Session token authentication (X-Simply-Sats-Token header)
 * - Rate limit handling with exponential backoff
 * - Native unlockBSV endpoint support
 */

import type { WalletProvider, WalletBalance, SendResult, LockResult, InscriptionData, InscriptionResult, LockedOutput, UnlockResult } from './types'
import { createP2PKHLockingScript, buildInscriptionScript } from './wallet-utils'
import {
  WalletConnectionError,
  WalletAuthError,
  InsufficientFundsError,
  TransactionRejectedError,
  TimeoutError,
  parseWalletError
} from './errors'

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT = 10000 // 10 seconds

// Simply Sats runs on port 3322 (Metanet Desktop uses 3321)
const SIMPLY_SATS_URL = 'http://localhost:3322'

// Rate limit retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 10000 // 10 seconds

// Session token header name
const SESSION_TOKEN_HEADER = 'X-Simply-Sats-Token'

export class SimplySatsAdapter implements WalletProvider {
  name = 'Simply Sats'
  icon = '/wallets/simplysats.png'

  private _isConnected = false
  private identityKey: string | null = null
  private sessionToken: string | null = null
  private accountChangeCallbacks: ((address: string) => void)[] = []
  private disconnectCallbacks: (() => void)[] = []
  private reconnectPromise: Promise<string> | null = null

  constructor() {
    // Check for stored identity key (public, not sensitive)
    // Session token is now stored in httpOnly cookie via /api/wallet/connect
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('simplysats_identity_key')
      if (stored) {
        this.identityKey = stored
        // Session token will be fetched from server when needed
        this._isConnected = true
        // Fetch session token from server on init
        this.loadSessionToken()
      }
    }
  }

  /**
   * Load session token from secure server-side storage
   */
  private async loadSessionToken(): Promise<void> {
    try {
      const response = await fetch('/api/wallet/connect')
      if (response.ok) {
        const data = await response.json()
        if (data.connected && data.identityKey === this.identityKey) {
          // Token is stored server-side, we just verify connection
          this._isConnected = true
        }
      }
    } catch (error) {
      console.error('Failed to load wallet session:', error)
    }
  }

  /**
   * Save session token to secure server-side storage
   */
  private async saveSessionToken(token: string, identityKey: string): Promise<void> {
    try {
      const response = await fetch('/api/wallet/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletType: 'simplysats',
          sessionToken: token,
          identityKey,
        }),
      })
      if (!response.ok) {
        console.warn('Failed to save wallet session to server')
      }
    } catch (error) {
      console.error('Failed to save wallet session:', error)
    }
  }

  /**
   * Make an HTTP API call to Simply Sats with session token and rate limit handling
   */
  private async api<T>(method: string, args: Record<string, unknown> = {}, retryCount = 0): Promise<T> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }

    // Add session token if available (not required for getVersion/getNonce)
    const unauthenticatedMethods = ['getVersion']
    if (this.sessionToken && !unauthenticatedMethods.includes(method)) {
      headers[SESSION_TOKEN_HEADER] = this.sessionToken

      // C2: Fetch CSRF nonce for authenticated requests
      try {
        const nonceResponse = await fetch(`${SIMPLY_SATS_URL}/getNonce`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [SESSION_TOKEN_HEADER]: this.sessionToken!
          },
          body: JSON.stringify({})
        })
        if (nonceResponse.ok) {
          const nonceData = await nonceResponse.json()
          if (nonceData.nonce) {
            headers['X-Simply-Sats-Nonce'] = nonceData.nonce
          }
        }
      } catch (e) {
        console.warn('CSRF nonce fetch failed:', e instanceof Error ? e.message : e)
      }
    }

    let response: Response
    try {
      response = await fetch(`${SIMPLY_SATS_URL}/${method}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(args)
      })
    } catch {
      // Network-level failures (connection refused, etc.)
      throw new WalletConnectionError()
    }

    // C3: Handle session token rotation
    const newToken = response.headers.get('X-Simply-Sats-New-Token')
    if (newToken) {
      this.sessionToken = newToken
      if (this.identityKey) {
        this.saveSessionToken(newToken, this.identityKey)
      }
    }

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      if (retryCount >= MAX_RETRIES) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.')
      }

      const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY)
      console.debug(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await this.sleep(delay)
      return this.api<T>(method, args, retryCount + 1)
    }

    // Handle authentication errors - attempt auto-reconnect once
    if (response.status === 401) {
      if (retryCount === 0) {
        console.warn('Session token invalid or expired, attempting reconnect...')
        try {
          await this.attemptReconnect()
          return this.api<T>(method, args, retryCount + 1)
        } catch (reconnectError) {
          console.error('Auto-reconnect failed:', reconnectError)
          throw new WalletAuthError()
        }
      }
      throw new WalletAuthError()
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const errorMessage = data.message || `HTTP error ${response.status}`

      // Parse and throw categorized error
      throw parseWalletError(new Error(errorMessage))
    }

    return await response.json()
  }

  /**
   * Attempt to reconnect to the wallet
   * Returns the same promise if already reconnecting to prevent race conditions
   */
  private async attemptReconnect(): Promise<string> {
    if (this.reconnectPromise) {
      return this.reconnectPromise
    }

    this.reconnectPromise = this.connect()
      .finally(() => {
        this.reconnectPromise = null
      })

    return this.reconnectPromise
  }

  /**
   * Sleep helper for rate limit backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Helper to wrap a promise with a timeout
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new TimeoutError(message)), ms)
      )
    ])
  }

  /**
   * Check if Simply Sats is available
   */
  isInstalled(): boolean {
    return typeof window !== 'undefined'
  }

  isConnected(): boolean {
    return this._isConnected
  }

  /**
   * Connect to Simply Sats wallet via HTTP
   * Acquires a session token for authenticated requests
   */
  async connect(): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('Cannot connect in server environment')
    }

    // L13: Clear callback arrays before (re)connect to prevent duplicate listeners
    this.accountChangeCallbacks.length = 0
    this.disconnectCallbacks.length = 0

    try {
      console.debug('Connecting to Simply Sats via HTTP...')

      // Test connection with getVersion (no token required)
      const versionResult = await this.withTimeout(
        this.api<{ version: string }>('getVersion'),
        CONNECTION_TIMEOUT,
        'Connection to Simply Sats timed out. Make sure Simply Sats is running.'
      )
      console.debug('Simply Sats version:', versionResult.version)

      // Request a session token for authenticated API calls
      // Simply Sats generates a token when waiting for authentication
      await this.withTimeout(
        this.api<{ authenticated: boolean }>('waitForAuthentication'),
        CONNECTION_TIMEOUT,
        'Authentication check timed out.'
      )

      // Get the user's identity public key
      const { publicKey } = await this.withTimeout(
        this.api<{ publicKey: string }>('getPublicKey', { identityKey: true }),
        CONNECTION_TIMEOUT * 3, // Give more time for user to approve
        'Getting public key timed out. Please approve the request in Simply Sats.'
      )

      // Token is acquired via X-Simply-Sats-New-Token header (handled in api() method)
      if (this.sessionToken) {
        await this.saveSessionToken(this.sessionToken, publicKey)
        console.debug('Session token acquired and stored securely')
      }

      // Store the connection state
      this._isConnected = true
      this.identityKey = publicKey
      // Only store identity key locally (it's a public key, not sensitive)
      localStorage.setItem('simplysats_identity_key', publicKey)

      console.debug('Connected to Simply Sats, identity key:', publicKey.slice(0, 16) + '...')
      return publicKey
    } catch (error) {
      console.error('Failed to connect to Simply Sats:', error)

      // Provide helpful error message
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'

      if (errorMessage.includes('timed out') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        throw new Error(
          'Could not connect to Simply Sats. Please make sure:\n\n' +
          '1. Simply Sats is installed and running\n' +
          '2. You have a wallet set up in Simply Sats\n\n' +
          'Download Simply Sats from the releases page.'
        )
      }

      throw error
    }
  }

  async disconnect(): Promise<void> {
    this._isConnected = false
    this.identityKey = null
    this.sessionToken = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('simplysats_identity_key')
      // Clear secure session via API
      try {
        await fetch('/api/wallet/connect', { method: 'DELETE' })
      } catch (error) {
        console.error('Failed to clear wallet session:', error)
      }
    }
    this.disconnectCallbacks.forEach(cb => cb())
    // L8: Clear callback arrays on disconnect
    this.accountChangeCallbacks = []
    this.disconnectCallbacks = []
  }

  async getAddress(): Promise<string> {
    if (this.identityKey) return this.identityKey

    const { publicKey } = await this.api<{ publicKey: string }>('getPublicKey', { identityKey: true })
    return publicKey
  }

  async getBalance(): Promise<WalletBalance> {
    try {
      const result = await this.api<{ outputs: Array<{ satoshis: number; spendable?: boolean }> }>('listOutputs', {
        basket: 'default',
        limit: 10000
      })

      const totalSatoshis = (result.outputs || [])
        .filter(o => o.spendable !== false)
        .reduce((sum, o) => sum + (o.satoshis || 0), 0)

      return {
        bsv: totalSatoshis / 100_000_000,
        satoshis: totalSatoshis,
        usd: undefined
      }
    } catch (error) {
      console.error('Failed to get balance:', error)
      return { bsv: 0, satoshis: 0, usd: undefined }
    }
  }

  async getPubKey(): Promise<string> {
    const { publicKey } = await this.api<{ publicKey: string }>('getPublicKey', { identityKey: true })
    return publicKey
  }

  async sendBSV(to: string, satoshis: number): Promise<SendResult> {
    // L6: Enforce dust limit
    if (satoshis < 546) {
      throw new Error('Amount below dust limit (minimum 546 sats)')
    }

    const result = await this.api<{ txid: string }>('createAction', {
      description: 'Send BSV payment',
      outputs: [{
        lockingScript: createP2PKHLockingScript(to),
        satoshis,
        outputDescription: 'Payment output'
      }],
      labels: ['payment', 'wrootz']
    })

    if (!result.txid) {
      throw new Error('Transaction creation failed')
    }

    return {
      txid: result.txid,
      amount: satoshis
    }
  }

  async lockBSV(satoshis: number, blocks: number, ordinalOrigin?: string): Promise<LockResult> {
    try {
      // Get current block height to calculate unlock block
      const { height: currentHeight } = await this.api<{ height: number }>('getHeight')
      const unlockBlock = currentHeight + blocks

      // Get user's public key for tracking
      const { publicKey } = await this.api<{ publicKey: string }>('getPublicKey', { identityKey: true })

      console.debug(`Creating lock: ${satoshis} sats for ${blocks} blocks (until block ${unlockBlock})`)

      // Use Simply Sats native lockBSV which uses OP_PUSH_TX timelock
      // This delegates the script creation to the wallet's proven implementation
      const result = await this.withTimeout(
        this.api<{ txid: string; unlockBlock: number }>('lockBSV', {
          satoshis,
          blocks,
          app: 'wrootz',
          ordinalOrigin: ordinalOrigin || null
        }),
        60000,
        'Lock transaction timed out. Please approve the transaction in Simply Sats.'
      )

      if (!result.txid) {
        throw new Error('Lock transaction creation failed - no txid returned')
      }

      // Simply Sats now includes the OP_RETURN in the lock transaction itself
      // when ordinalOrigin is provided in metadata, so no need for separate tx
      console.debug('Lock created:', result.txid)

      return {
        txid: result.txid,
        lockAddress: publicKey,
        amount: satoshis,
        unlockBlock: result.unlockBlock || unlockBlock
      }
    } catch (error) {
      // Re-throw wallet errors as-is
      if (error instanceof WalletConnectionError ||
          error instanceof WalletAuthError ||
          error instanceof InsufficientFundsError ||
          error instanceof TransactionRejectedError ||
          error instanceof TimeoutError) {
        throw error
      }
      // Parse and re-throw other errors
      throw parseWalletError(error)
    }
  }

  async listLocks(): Promise<LockedOutput[]> {
    try {
      const { height: currentHeight } = await this.api<{ height: number }>('getHeight')

      const result = await this.api<{ outputs: Array<{ outpoint: string; satoshis: number; tags?: string[]; spendable?: boolean }> }>('listOutputs', {
        basket: 'wrootz_locks',
        limit: 1000,
        includeTags: true
      })

      const locks: LockedOutput[] = []

      for (const output of result.outputs || []) {
        const [txid, voutStr] = output.outpoint.split('.')
        const vout = parseInt(voutStr) || 0

        const unlockTag = (output.tags || []).find((t: string) => t.startsWith('unlock_'))
        const unlockBlock = unlockTag ? parseInt(unlockTag.replace('unlock_', '')) : 0

        const lockExpired = currentHeight >= unlockBlock
        const isSpendable = lockExpired && output.spendable !== false
        const blocksRemaining = Math.max(0, unlockBlock - currentHeight)

        locks.push({
          outpoint: output.outpoint,
          txid,
          vout,
          satoshis: output.satoshis || 0,
          unlockBlock,
          tags: output.tags || [],
          spendable: isSpendable,
          blocksRemaining
        })
      }

      locks.sort((a, b) => a.unlockBlock - b.unlockBlock)
      return locks
    } catch (error) {
      console.error('Failed to list locks:', error)
      return []
    }
  }

  async unlockBSV(outpoint: string): Promise<UnlockResult> {
    try {
      // First verify the lock exists and is spendable
      const locks = await this.listLocks()
      const lock = locks.find(l => l.outpoint === outpoint)

      if (!lock) {
        throw new Error('Lock not found in wallet')
      }

      if (!lock.spendable) {
        throw new Error(`Lock is not yet spendable. ${lock.blocksRemaining} blocks remaining`)
      }

      console.debug(`Unlocking ${lock.satoshis} sats from outpoint ${outpoint}`)

      // Use the native unlockBSV endpoint which handles preimage construction internally
      // This is cleaner than manually building the createAction request
      const result = await this.withTimeout(
        this.api<{ txid: string; amount?: number }>('unlockBSV', {
          outpoints: [outpoint]
        }),
        60000,
        'Unlock transaction timed out. Please approve the transaction in Simply Sats.'
      )

      if (!result.txid) {
        throw new Error('Unlock transaction failed - no txid returned')
      }

      console.debug('Unlock successful:', result.txid)

      return {
        txid: result.txid,
        amount: result.amount || lock.satoshis
      }
    } catch (error) {
      // Re-throw wallet errors as-is
      if (error instanceof WalletConnectionError ||
          error instanceof WalletAuthError ||
          error instanceof InsufficientFundsError ||
          error instanceof TransactionRejectedError ||
          error instanceof TimeoutError) {
        throw error
      }
      // Parse and re-throw other errors
      throw parseWalletError(error)
    }
  }

  async signMessage(message: string): Promise<string> {
    const messageBytes = new TextEncoder().encode(message)

    const { signature } = await this.api<{ signature: number[] }>('createSignature', {
      data: Array.from(messageBytes),
      protocolID: [0, 'wrootz signing'],
      keyID: '1'
    })

    return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async inscribe(data: InscriptionData): Promise<InscriptionResult> {
    try {
      // Get user's public key for the inscription output
      const { publicKey } = await this.api<{ publicKey: string }>('getPublicKey', { identityKey: true })

      // Build the 1Sat Ordinals inscription script
      const inscriptionScript = buildInscriptionScript(
        data.base64Data,
        data.mimeType,
        publicKey,
        data.map
      )

      console.debug('Creating inscription via Simply Sats, script length:', inscriptionScript.length)

      const result = await this.withTimeout(
        this.api<{ txid: string }>('createAction', {
          description: `Wrootz: Create post "${data.map?.title || 'Post'}"`,
          outputs: [{
            lockingScript: inscriptionScript,
            satoshis: 1, // 1Sat ordinal
            outputDescription: 'Ordinal inscription',
            basket: 'wrootz_ordinals',
            tags: ['inscription', 'ordinal', 'wrootz']
          }],
          labels: ['inscription', 'wrootz']
        }),
        60000,
        'Inscription timed out. Please approve the transaction in Simply Sats.'
      )

      if (!result.txid) {
        throw new Error('Inscription creation failed - no txid returned')
      }

      console.debug('Inscription created:', result.txid)

      return {
        txid: result.txid,
        origin: `${result.txid}_0`
      }
    } catch (error) {
      // Re-throw wallet errors as-is
      if (error instanceof WalletConnectionError ||
          error instanceof WalletAuthError ||
          error instanceof InsufficientFundsError ||
          error instanceof TransactionRejectedError ||
          error instanceof TimeoutError) {
        throw error
      }
      // Parse and re-throw other errors
      throw parseWalletError(error)
    }
  }

  // buildInscriptionScript extracted to wallet-utils.ts

  onAccountChange(callback: (address: string) => void): () => void {
    this.accountChangeCallbacks.push(callback)
    // L8: Return unsubscribe function
    return () => {
      const idx = this.accountChangeCallbacks.indexOf(callback)
      if (idx !== -1) this.accountChangeCallbacks.splice(idx, 1)
    }
  }

  onDisconnect(callback: () => void): () => void {
    this.disconnectCallbacks.push(callback)
    // L8: Return unsubscribe function
    return () => {
      const idx = this.disconnectCallbacks.indexOf(callback)
      if (idx !== -1) this.disconnectCallbacks.splice(idx, 1)
    }
  }

  async getNetwork(): Promise<'mainnet' | 'testnet'> {
    const { network } = await this.api<{ network: string }>('getNetwork')
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error(`Unexpected network: ${network}`)
    }
    return network
  }

  async getBlockHeight(): Promise<number> {
    try {
      const { height } = await this.api<{ height: number }>('getHeight')
      return height
    } catch {
      // Fallback to WhatsOnChain
      try {
        const response = await fetch('https://api.whatsonchain.com/v1/bsv/main/chain/info')
        const data = await response.json()
        return data.blocks
      } catch {
        return 0
      }
    }
  }

  // Private crypto methods extracted to wallet-utils.ts
}

export const simplySatsWallet = new SimplySatsAdapter()
