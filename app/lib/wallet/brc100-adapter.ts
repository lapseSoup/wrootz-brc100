/**
 * BRC-100 Wallet Adapter
 *
 * Uses the @bsv/sdk WalletClient to connect to BRC-100 compliant wallets
 * like Metanet Desktop, SPV Wallet Browser Extension, etc.
 *
 * BRC-100 is the unified, vendor-neutral wallet-to-application interface
 * for BSV Blockchain. Apps can connect to any compliant wallet.
 *
 * Transport substrates:
 * - 'http://localhost:3321' - Metanet Desktop / BSV Desktop (JSON-API over HTTP)
 * - 'XDM' - Browser extensions (cross-document messaging)
 */

import { WalletClient } from '@bsv/sdk'
import { withTimeout, pushData, hash160, createP2PKHLockingScript, buildInscriptionScript } from './wallet-utils'
import type { WalletProvider, WalletBalance, SendResult, LockResult, InscriptionData, InscriptionResult, LockedOutput, UnlockResult } from './types'

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT = 10000 // 10 seconds

// Wallet download links
export const WALLET_DOWNLOAD_LINKS = {
  metanetDesktop: 'https://github.com/bsv-blockchain/metanet-desktop/releases',
  bsvDesktop: 'https://github.com/bsv-blockchain/bsv-desktop/releases',
  spvWallet: 'https://chromewebstore.google.com/detail/spv-wallet'
}

export class BRC100WalletAdapter implements WalletProvider {
  name = 'BRC-100 Wallet'
  icon = '/wallets/brc100.png'

  private walletClient: WalletClient | null = null
  private accountChangeCallbacks: ((address: string) => void)[] = []
  private disconnectCallbacks: (() => void)[] = []
  private _isConnected = false
  private connectedSubstrate: string | null = null

  /**
   * Check if a BRC-100 compatible wallet is available
   */
  isInstalled(): boolean {
    // We always return true since we can't easily detect desktop wallets
    // The actual connection will fail with a helpful message if no wallet is available
    return typeof window !== 'undefined'
  }

  isConnected(): boolean {
    return this._isConnected
  }

  // Delegate to shared wallet-utils for common operations

  /**
   * Ensure wallet is connected, reconnect if needed
   */
  private async ensureConnected(): Promise<WalletClient> {
    if (this.walletClient && this._isConnected) {
      // Test if connection is still alive by making a simple call
      try {
        await withTimeout(
          this.walletClient.isAuthenticated(),
          5000,
          'Connection check timed out'
        )
        return this.walletClient
      } catch (error) {
        console.warn('Wallet connection stale, reconnecting...', error)
        // Connection is stale, reconnect
      }
    }

    // Need to reconnect
    if (this.connectedSubstrate) {
      console.debug(`Reconnecting to ${this.connectedSubstrate}...`)
      this.walletClient = new WalletClient(this.connectedSubstrate as 'XDM')
      await this.walletClient.connectToSubstrate()
      await this.walletClient.waitForAuthentication()
      return this.walletClient
    }

    throw new Error('Wallet not connected. Please connect your wallet first.')
  }

  async connect(): Promise<string> {
    // L13: Clear callback arrays before (re)connect to prevent duplicate listeners
    this.accountChangeCallbacks.length = 0
    this.disconnectCallbacks.length = 0

    // Try HTTP substrate first (for Metanet Desktop on port 3321)
    // Then fall back to XDM (for browser extensions)
    const substrates = [
      { type: 'http://localhost:3321', name: 'Metanet Desktop' },
      { type: 'XDM', name: 'Browser Extension' }
    ]

    let lastError: Error | null = null

    for (const substrate of substrates) {
      try {
        console.debug(`Trying to connect via ${substrate.name} (${substrate.type})...`)

        // Create WalletClient with the substrate
        this.walletClient = new WalletClient(substrate.type as 'XDM')

        // Connect to the wallet with timeout
        await withTimeout(
          this.walletClient.connectToSubstrate(),
          CONNECTION_TIMEOUT,
          `Connection to ${substrate.name} timed out. Make sure the wallet is running.`
        )

        // Wait for user to authenticate in their wallet with timeout
        await withTimeout(
          this.walletClient.waitForAuthentication(),
          CONNECTION_TIMEOUT * 3, // Give more time for user to authenticate
          `Authentication timed out. Please approve the connection in your wallet.`
        )

        // Get the user's identity public key
        const { publicKey } = await this.walletClient.getPublicKey({ identityKey: true })

        // Store the connection state
        this._isConnected = true
        this.connectedSubstrate = substrate.type
        if (typeof window !== 'undefined') {
          // L9: Identity keys are public keys (not secrets). The risk is identity
          // correlation under XSS, not fund theft. Moving to httpOnly cookies would
          // require architectural changes beyond current scope.
          localStorage.setItem('brc100_identity_key', publicKey)
          localStorage.setItem('brc100_substrate', substrate.type)
        }

        console.debug(`Connected via ${substrate.name}`)
        return publicKey
      } catch (error) {
        console.warn(`Failed to connect via ${substrate.name}:`, error)
        lastError = error instanceof Error ? error : new Error(String(error))
        this.walletClient = null
        // Continue to next substrate
      }
    }

    // All substrates failed - provide helpful error message
    const errorMessage = this.getHelpfulErrorMessage(lastError)
    throw new Error(errorMessage)
  }

  private getHelpfulErrorMessage(error: Error | null): string {
    const baseMessage = error?.message || 'Connection failed'

    if (baseMessage.includes('timed out') || baseMessage.includes('Failed to fetch') || baseMessage.includes('NetworkError')) {
      return `No BRC-100 wallet detected. Please install and open one of these wallets:\n\n` +
        `• Metanet Desktop: ${WALLET_DOWNLOAD_LINKS.metanetDesktop}\n` +
        `• BSV Desktop: ${WALLET_DOWNLOAD_LINKS.bsvDesktop}\n\n` +
        `Make sure the wallet is running before connecting.`
    }

    if (baseMessage.includes('Authentication') || baseMessage.includes('rejected')) {
      return `Connection was rejected or timed out. Please approve the connection request in your wallet.`
    }

    return `Failed to connect to BRC-100 wallet: ${baseMessage}\n\n` +
      `Download a wallet: ${WALLET_DOWNLOAD_LINKS.metanetDesktop}`
  }

  async disconnect(): Promise<void> {
    this.walletClient = null
    this._isConnected = false
    this.connectedSubstrate = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('brc100_identity_key')
      localStorage.removeItem('brc100_substrate')
    }
    this.disconnectCallbacks.forEach(cb => cb())
    // L8: Clear callback arrays on disconnect
    this.accountChangeCallbacks = []
    this.disconnectCallbacks = []
  }

  async getAddress(): Promise<string> {
    // In BRC-100, we use the identity public key as the "address"
    // The actual receiving addresses are derived per-transaction using BRC-29
    const stored = typeof window !== 'undefined'
      ? localStorage.getItem('brc100_identity_key')
      : null

    if (stored) return stored

    if (!this.walletClient) {
      throw new Error('Wallet not connected')
    }

    const { publicKey } = await this.walletClient.getPublicKey({ identityKey: true })
    return publicKey
  }

  async getBalance(): Promise<WalletBalance> {
    try {
      const client = await this.ensureConnected()

      // Try multiple basket names since different wallets use different conventions
      const basketsToTry = ['default', 'bsv', 'main', 'funds']
      let totalSatoshis = 0
      let foundOutputs = false

      const basketResults = await Promise.allSettled(
        basketsToTry.map(basket =>
          client.listOutputs({ basket, limit: 10000 })
            .then(result => ({ basket, outputs: result.outputs || [] }))
        )
      )

      for (const result of basketResults) {
        if (result.status === 'fulfilled' && result.value.outputs.length > 0) {
          const basketSats = result.value.outputs
            .filter((o) => o.spendable !== false)
            .reduce((sum: number, o) => sum + (o.satoshis || 0), 0)
          console.debug(`Found ${result.value.outputs.length} outputs in '${result.value.basket}' basket: ${basketSats} sats`)
          totalSatoshis += basketSats
          foundOutputs = true
        }
      }

      // Also try to get wrootz_locks basket balance (but don't add to spendable)
      try {
        const locksResult = await client.listOutputs({
          basket: 'wrootz_locks',
          limit: 1000
        })
        const lockedOutputs = locksResult.outputs || []
        if (lockedOutputs.length > 0) {
          const lockedSats = lockedOutputs.reduce((sum: number, o) => sum + (o.satoshis || 0), 0)
          console.debug(`Found ${lockedOutputs.length} locked outputs: ${lockedSats} sats (not included in balance)`)
        }
      } catch {
        // No locks basket
      }

      if (!foundOutputs) {
        console.debug('No outputs found in any basket')
      }

      console.debug(`Total spendable balance: ${totalSatoshis} sats`)

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
    if (!this.walletClient) {
      throw new Error('Wallet not connected')
    }

    const { publicKey } = await this.walletClient.getPublicKey({ identityKey: true })
    return publicKey
  }

  async sendBSV(to: string, satoshis: number): Promise<SendResult> {
    if (!this.walletClient) {
      throw new Error('Wallet not connected')
    }

    // L6: Enforce dust limit
    if (satoshis < 546) {
      throw new Error('Amount below dust limit (minimum 546 sats)')
    }

    // Create a payment action using BRC-100
    // The wallet handles UTXO selection, signing, and broadcasting
    const result = await this.walletClient.createAction({
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
    // Ensure we have a live connection
    const client = await this.ensureConnected()

    try {
      // Get current block height
      const { height: currentHeight } = await client.getHeight()
      const unlockBlock = currentHeight + blocks

      // Get user's public key for tracking
      const { publicKey } = await client.getPublicKey({ identityKey: true })

      console.debug(`Creating lock: ${satoshis} sats for ${blocks} blocks (until block ${unlockBlock})`)
      if (ordinalOrigin) {
        console.debug(`Linking to ordinal: ${ordinalOrigin}`)
      }

      // Try to use the wallet's native lockBSV if available (e.g., OP_PUSH_TX)
      // This is the preferred method as it uses a proven timelock implementation
      let result: { txid: string; unlockBlock?: number }

      try {
        // Attempt native lock via HTTP API (same pattern as Simply Sats)
        const lockResponse = await withTimeout(
          fetch(`http://localhost:3321/lockBSV`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              satoshis,
              blocks,
              metadata: { app: 'wrootz', ordinalOrigin: ordinalOrigin || null }
            })
          }).then(r => r.ok ? r.json() : Promise.reject(new Error('Native lock not available'))),
          10000,
          'Native lock timeout'
        )

        if (lockResponse.txid) {
          result = lockResponse
          console.debug('Used native wallet lockBSV')
        } else {
          throw new Error('No txid from native lock')
        }
      } catch {
        // Native lock not available - this wallet may not support timelocks
        // For now, throw an error explaining the limitation
        throw new Error(
          'This BRC-100 wallet does not support native timelocks. ' +
          'Please use Simply Sats wallet for locking functionality, or contact your wallet provider ' +
          'to add OP_PUSH_TX timelock support.'
        )
      }

      // Create OP_RETURN link to ordinal if provided
      if (ordinalOrigin && result.txid) {
        try {
          await client.createAction({
            description: `Wrootz: Link lock to ordinal`,
            outputs: [{
              lockingScript: this.createWrootzOpReturn('lock', ordinalOrigin),
              satoshis: 0,
              outputDescription: `Wrootz lock reference to ordinal ${ordinalOrigin}`
            }],
            labels: ['lock-reference', 'wrootz']
          })
        } catch (linkError) {
          // Non-fatal: the lock is valid even without the OP_RETURN link
          console.warn('Could not create ordinal link OP_RETURN:', linkError)
        }
      }

      console.debug('Lock created:', result.txid)

      return {
        txid: result.txid,
        lockAddress: publicKey,
        amount: satoshis,
        unlockBlock: result.unlockBlock || unlockBlock
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Lost connection to wallet. Please try again or reconnect your wallet.')
        }
        if (error.message.includes('rejected') || error.message.includes('denied')) {
          throw new Error('Transaction was rejected in the wallet.')
        }
        throw error
      }
      throw new Error('Lock failed: Unknown error')
    }
  }

  /**
   * List all locked outputs from the wrootz_locks basket
   */
  async listLocks(): Promise<LockedOutput[]> {
    const client = await this.ensureConnected()

    try {
      // Get current block height to determine which locks are spendable
      const { height: currentHeight } = await client.getHeight()

      // List outputs from the wrootz_locks basket
      const result = await client.listOutputs({
        basket: 'wrootz_locks',
        limit: 1000,
        includeTags: true
      })

      const locks: LockedOutput[] = []

      for (const output of result.outputs || []) {
        // Parse outpoint (format: "txid.vout")
        const [txid, voutStr] = output.outpoint.split('.')
        const vout = parseInt(voutStr) || 0

        // Parse unlock block from tags (format: "unlock_BLOCKNUMBER")
        const unlockTag = (output.tags || []).find((t: string) => t.startsWith('unlock_'))
        const unlockBlock = unlockTag ? parseInt(unlockTag.replace('unlock_', '')) : 0

        // Determine if spendable (lock expired and not already spent)
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

      // Sort by unlock block (soonest first)
      locks.sort((a, b) => a.unlockBlock - b.unlockBlock)

      console.debug(`Found ${locks.length} locked outputs, ${locks.filter(l => l.spendable).length} are unlockable`)

      return locks
    } catch (error) {
      console.error('Failed to list locks:', error)
      return []
    }
  }

  /**
   * Unlock (spend) a time-locked output back to the wallet
   */
  async unlockBSV(outpoint: string): Promise<UnlockResult> {
    const client = await this.ensureConnected()

    try {
      // Get current block height
      const { height: currentHeight } = await client.getHeight()

      // First, verify the output is in our locks and is spendable
      const locks = await this.listLocks()
      const lock = locks.find(l => l.outpoint === outpoint)

      if (!lock) {
        throw new Error('Lock not found in wallet')
      }

      if (!lock.spendable) {
        throw new Error(`Lock is not yet spendable. ${lock.blocksRemaining} blocks remaining (unlocks at block ${lock.unlockBlock})`)
      }

      console.debug(`Unlocking ${lock.satoshis} sats from outpoint ${outpoint}`)

      // Create an action that spends the locked output back to the default basket
      // For CLTV, we need to provide the unlocking script length so wallet can estimate fees
      // The actual unlocking script will be created during signing
      const result = await withTimeout(
        client.createAction({
          description: `Wrootz: Unlock ${lock.satoshis} sats`,
          inputs: [{
            outpoint,
            inputDescription: 'Unlock time-locked BSV',
            unlockingScriptLength: 108, // Approximate signature + pubkey length
            sequenceNumber: 0xfffffffe // Required for CLTV (less than 0xffffffff)
          }],
          // Send to self (default basket)
          outputs: [{
            lockingScript: await this.createP2PKHFromIdentity(),
            satoshis: lock.satoshis, // Wallet handles fee calculation
            outputDescription: 'Unlocked funds',
            basket: 'default'
          }],
          lockTime: currentHeight, // Set locktime to current height for CLTV
          labels: ['unlock', 'wrootz']
        }),
        60000,
        'Unlock transaction timed out. Please approve the transaction in your wallet.'
      )

      if (!result.txid) {
        throw new Error('Unlock transaction failed - no txid returned')
      }

      console.debug('Unlock successful:', result.txid)

      return {
        txid: result.txid,
        amount: lock.satoshis
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Lost connection to wallet. Please try again or reconnect your wallet.')
        }
        throw error
      }
      throw new Error('Unlock failed: Unknown error')
    }
  }

  /**
   * Create a P2PKH locking script from the user's identity key
   */
  private async createP2PKHFromIdentity(): Promise<string> {
    const client = await this.ensureConnected()
    const { publicKey } = await client.getPublicKey({ identityKey: true })
    const pubKeyHashHex = hash160(publicKey)
    return '76a914' + pubKeyHashHex + '88ac'
  }

  async signMessage(message: string): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet not connected')
    }

    const messageBytes = new TextEncoder().encode(message)

    const { signature } = await this.walletClient.createSignature({
      data: Array.from(messageBytes),
      protocolID: [0, 'wrootz signing'],
      keyID: '1'
    })

    // Convert signature bytes to hex
    return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async inscribe(data: InscriptionData): Promise<InscriptionResult> {
    // Ensure we have a live connection
    const client = await this.ensureConnected()

    try {
      // Create a 1Sat Ordinals inscription
      // The inscription format follows the 1Sat Ordinals protocol

      // Build the inscription locking script
      // Format: OP_FALSE OP_IF "ord" OP_1 <content-type> OP_0 <data> OP_ENDIF <p2pkh>
      const { publicKey } = await client.getPublicKey({ identityKey: true })

      const inscriptionScript = buildInscriptionScript(
        data.base64Data,
        data.mimeType,
        publicKey,
        data.map
      )

      console.debug('Creating inscription with script length:', inscriptionScript.length)

      const result = await withTimeout(
        client.createAction({
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
        60000, // 60 second timeout for user to approve
        'Inscription timed out. Please approve the transaction in your wallet.'
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
      // Re-throw with more context
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Lost connection to wallet. Please try again or reconnect your wallet.')
        }
        if (error.message.includes('rejected') || error.message.includes('denied')) {
          throw new Error('Transaction was rejected in the wallet.')
        }
        throw error
      }
      throw new Error('Inscription failed: Unknown error')
    }
  }

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

  // BRC-100 specific methods

  async getNetwork(): Promise<'mainnet' | 'testnet'> {
    if (!this.walletClient) {
      throw new Error('Wallet not connected')
    }
    const { network } = await this.walletClient.getNetwork()
    return network
  }

  async getBlockHeight(): Promise<number> {
    if (!this.walletClient) {
      throw new Error('Wallet not connected')
    }
    const { height } = await this.walletClient.getHeight()
    return height
  }

  /**
   * Get the raw WalletClient for advanced operations
   */
  getWalletClient(): WalletClient | null {
    return this.walletClient
  }

  // Helper methods

  /**
   * Create an OP_RETURN script for Wrootz protocol data
   * Format: OP_RETURN OP_FALSE "wrootz" <action> <data>
   *
   * This creates an on-chain link between locks and the content they support.
   * The format allows indexers to discover all locks for a specific ordinal.
   */
  private createWrootzOpReturn(action: string, data: string): string {
    // OP_RETURN (0x6a) followed by OP_FALSE (0x00) to make it a "safe" output
    // Then push: "wrootz" <action> <data>
    let script = '6a00' // OP_RETURN OP_FALSE
    script += pushData(Buffer.from('wrootz').toString('hex'))
    script += pushData(Buffer.from(action).toString('hex'))
    script += pushData(Buffer.from(data).toString('hex'))
    return script
  }

  // Private crypto methods extracted to wallet-utils.ts
}

export const brc100Wallet = new BRC100WalletAdapter()
