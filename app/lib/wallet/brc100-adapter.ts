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

  /**
   * Helper to wrap a promise with a timeout
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), ms)
      )
    ])
  }

  /**
   * Ensure wallet is connected, reconnect if needed
   */
  private async ensureConnected(): Promise<WalletClient> {
    if (this.walletClient && this._isConnected) {
      // Test if connection is still alive by making a simple call
      try {
        await this.withTimeout(
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
      console.log(`Reconnecting to ${this.connectedSubstrate}...`)
      this.walletClient = new WalletClient(this.connectedSubstrate as 'XDM')
      await this.walletClient.connectToSubstrate()
      await this.walletClient.waitForAuthentication()
      return this.walletClient
    }

    throw new Error('Wallet not connected. Please connect your wallet first.')
  }

  async connect(): Promise<string> {
    // Try HTTP substrate first (for Metanet Desktop on port 3321)
    // Then fall back to XDM (for browser extensions)
    const substrates = [
      { type: 'http://localhost:3321', name: 'Metanet Desktop' },
      { type: 'XDM', name: 'Browser Extension' }
    ]

    let lastError: Error | null = null

    for (const substrate of substrates) {
      try {
        console.log(`Trying to connect via ${substrate.name} (${substrate.type})...`)

        // Create WalletClient with the substrate
        this.walletClient = new WalletClient(substrate.type as 'XDM')

        // Connect to the wallet with timeout
        await this.withTimeout(
          this.walletClient.connectToSubstrate(),
          CONNECTION_TIMEOUT,
          `Connection to ${substrate.name} timed out. Make sure the wallet is running.`
        )

        // Wait for user to authenticate in their wallet with timeout
        await this.withTimeout(
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
          localStorage.setItem('brc100_identity_key', publicKey)
          localStorage.setItem('brc100_substrate', substrate.type)
        }

        console.log(`Connected via ${substrate.name}`)
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

      for (const basket of basketsToTry) {
        try {
          const result = await client.listOutputs({
            basket,
            limit: 10000
          })
          const outputs = result.outputs || []

          if (outputs.length > 0) {
            const basketSats = outputs
              .filter((o) => o.spendable !== false)
              .reduce((sum: number, o) => sum + (o.satoshis || 0), 0)

            console.log(`Found ${outputs.length} outputs in '${basket}' basket: ${basketSats} sats`)
            totalSatoshis += basketSats
            foundOutputs = true
          }
        } catch (e) {
          // Basket doesn't exist or error, try next
          console.log(`Basket '${basket}' not available`)
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
          console.log(`Found ${lockedOutputs.length} locked outputs: ${lockedSats} sats (not included in balance)`)
        }
      } catch {
        // No locks basket
      }

      if (!foundOutputs) {
        console.log('No outputs found in any basket')
      }

      console.log(`Total spendable balance: ${totalSatoshis} sats`)

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

    // Create a payment action using BRC-100
    // The wallet handles UTXO selection, signing, and broadcasting
    const result = await this.walletClient.createAction({
      description: 'Send BSV payment',
      outputs: [{
        lockingScript: this.createP2PKHLockingScript(to),
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

  async lockBSV(satoshis: number, blocks: number): Promise<LockResult> {
    // Ensure we have a live connection
    const client = await this.ensureConnected()

    try {
      // Get current block height
      const { height: currentHeight } = await client.getHeight()
      const unlockBlock = currentHeight + blocks

      // Get user's public key for the lock
      const { publicKey } = await client.getPublicKey({ identityKey: true })

      // Create a time-locked output using OP_CHECKLOCKTIMEVERIFY (CLTV)
      // The locking script checks that the block height is >= unlockBlock
      const lockingScript = this.createCLTVLockingScript(publicKey, unlockBlock)

      console.log(`Creating lock: ${satoshis} sats for ${blocks} blocks (until block ${unlockBlock})`)

      const result = await this.withTimeout(
        client.createAction({
          description: `Wrootz: Lock ${satoshis} sats for ${blocks} blocks`,
          outputs: [{
            lockingScript,
            satoshis,
            outputDescription: `Locked until block ${unlockBlock}`,
            basket: 'wrootz_locks',
            tags: ['lock', `unlock_${unlockBlock}`, 'wrootz']
          }],
          labels: ['lock', 'wrootz']
        }),
        60000, // 60 second timeout for user to approve
        'Lock transaction timed out. Please approve the transaction in your wallet.'
      )

      if (!result.txid) {
        throw new Error('Lock transaction creation failed - no txid returned')
      }

      console.log('Lock created:', result.txid)

      return {
        txid: result.txid,
        lockAddress: publicKey, // Using pubkey as address for BRC-100
        amount: satoshis,
        unlockBlock
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

      console.log(`Found ${locks.length} locked outputs, ${locks.filter(l => l.spendable).length} are unlockable`)

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

      console.log(`Unlocking ${lock.satoshis} sats from outpoint ${outpoint}`)

      // Create an action that spends the locked output back to the default basket
      // For CLTV, we need to provide the unlocking script length so wallet can estimate fees
      // The actual unlocking script will be created during signing
      const result = await this.withTimeout(
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
            satoshis: lock.satoshis - 1, // Minus 1 sat for fee
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

      console.log('Unlock successful:', result.txid)

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
    const pubKeyHashHex = this.hash160(publicKey)
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

      const inscriptionScript = this.buildInscriptionScript(
        data.base64Data,
        data.mimeType,
        publicKey,
        data.map
      )

      console.log('Creating inscription with script length:', inscriptionScript.length)

      const result = await this.withTimeout(
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

      console.log('Inscription created:', result.txid)

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

  onAccountChange(callback: (address: string) => void): void {
    this.accountChangeCallbacks.push(callback)
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback)
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
   * Create a P2PKH locking script from a BSV address
   */
  private createP2PKHLockingScript(address: string): string {
    // Decode the address to get the public key hash
    const decoded = this.decodeBase58Check(address)
    const pubKeyHash = decoded.slice(1) // Remove version byte

    // Build the locking script
    // OP_DUP (0x76) OP_HASH160 (0xa9) <20 bytes push> (0x14) <pubkeyhash> OP_EQUALVERIFY (0x88) OP_CHECKSIG (0xac)
    const pubKeyHashHex = Buffer.from(pubKeyHash).toString('hex')
    return '76a914' + pubKeyHashHex + '88ac'
  }

  /**
   * Create a CLTV time-locked locking script
   */
  private createCLTVLockingScript(pubKeyHex: string, lockTime: number): string {
    // Build CLTV locking script:
    // <locktime> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG
    const lockTimeHex = this.encodeScriptNum(lockTime)
    return lockTimeHex + 'b175' + this.pushData(pubKeyHex) + 'ac'
  }

  /**
   * Build a 1Sat Ordinals inscription script
   */
  private buildInscriptionScript(
    base64Data: string,
    mimeType: string,
    pubKeyHex: string,
    map?: Record<string, string>
  ): string {
    // 1Sat Ordinals inscription format:
    // OP_FALSE OP_IF "ord" OP_1 <content-type> OP_0 <data> OP_ENDIF <p2pkh>

    const dataBytes = Buffer.from(base64Data, 'base64')
    const mimeTypeBytes = Buffer.from(mimeType, 'utf8')

    let script = '0063' // OP_FALSE OP_IF
    script += this.pushData(Buffer.from('ord').toString('hex')) // "ord"
    script += '51' // OP_1
    script += this.pushData(mimeTypeBytes.toString('hex')) // content-type
    script += '00' // OP_0
    script += this.pushData(dataBytes.toString('hex')) // data

    // Add optional MAP data if provided
    if (map && Object.keys(map).length > 0) {
      // MAP protocol: OP_RETURN "MAP" "SET" key value key value...
      // For inscriptions, we add it inside the envelope
      for (const [key, value] of Object.entries(map)) {
        script += this.pushData(Buffer.from(key).toString('hex'))
        script += this.pushData(Buffer.from(value).toString('hex'))
      }
    }

    script += '68' // OP_ENDIF

    // Add P2PKH for the recipient
    // We need to hash the pubkey first
    const pubKeyHashHex = this.hash160(pubKeyHex)
    script += '76a914' + pubKeyHashHex + '88ac'

    return script
  }

  /**
   * Decode a base58check encoded string
   */
  private decodeBase58Check(str: string): Uint8Array {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

    let num = BigInt(0)
    for (const char of str) {
      const index = ALPHABET.indexOf(char)
      if (index === -1) throw new Error('Invalid base58 character')
      num = num * BigInt(58) + BigInt(index)
    }

    // Convert to bytes (25 bytes for standard address)
    const hex = num.toString(16).padStart(50, '0')
    const bytes = new Uint8Array(25)
    for (let i = 0; i < 25; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }

    return bytes.slice(0, 21) // Return version byte + 20 byte hash
  }

  /**
   * Encode a number for script (minimal encoding)
   */
  private encodeScriptNum(num: number): string {
    if (num === 0) return '00'
    if (num >= 1 && num <= 16) return (0x50 + num).toString(16)

    const bytes: number[] = []
    let n = Math.abs(num)
    while (n > 0) {
      bytes.push(n & 0xff)
      n >>= 8
    }

    // Add sign bit if needed
    if (bytes[bytes.length - 1] & 0x80) {
      bytes.push(num < 0 ? 0x80 : 0x00)
    } else if (num < 0) {
      bytes[bytes.length - 1] |= 0x80
    }

    const len = bytes.length
    const lenHex = len.toString(16).padStart(2, '0')
    const dataHex = bytes.map(b => b.toString(16).padStart(2, '0')).join('')

    return lenHex + dataHex
  }

  /**
   * Create a push data opcode
   */
  private pushData(hexData: string): string {
    const len = hexData.length / 2
    if (len < 0x4c) {
      return len.toString(16).padStart(2, '0') + hexData
    } else if (len <= 0xff) {
      return '4c' + len.toString(16).padStart(2, '0') + hexData
    } else if (len <= 0xffff) {
      return '4d' + len.toString(16).padStart(4, '0').match(/.{2}/g)!.reverse().join('') + hexData
    } else {
      return '4e' + len.toString(16).padStart(8, '0').match(/.{2}/g)!.reverse().join('') + hexData
    }
  }

  /**
   * HASH160 (RIPEMD160(SHA256(data)))
   * Note: In production, use proper crypto libraries
   */
  private hash160(hexData: string): string {
    // This is a placeholder - in production use @bsv/sdk crypto
    // For now, we'll return the input truncated to 20 bytes (40 hex chars)
    // This should be replaced with actual hash160 implementation
    console.warn('hash160: Using placeholder implementation - replace with @bsv/sdk crypto')
    return hexData.slice(0, 40)
  }
}

export const brc100Wallet = new BRC100WalletAdapter()
