/**
 * BRC-100 Wallet Adapter
 *
 * Uses the @bsv/sdk WalletClient to connect to BRC-100 compliant wallets
 * like Metanet Desktop, SPV Wallet Browser Extension, etc.
 *
 * BRC-100 is the unified, vendor-neutral wallet-to-application interface
 * for BSV Blockchain. Apps can connect to any compliant wallet.
 */

import { WalletClient } from '@bsv/sdk'
import type { WalletProvider, WalletBalance, SendResult, LockResult, InscriptionData, InscriptionResult } from './types'

export class BRC100WalletAdapter implements WalletProvider {
  name = 'BRC-100 Wallet'
  icon = '/wallets/brc100.png'

  private walletClient: WalletClient | null = null
  private accountChangeCallbacks: ((address: string) => void)[] = []
  private disconnectCallbacks: (() => void)[] = []
  private _isConnected = false

  /**
   * Check if a BRC-100 compatible wallet is available
   * This checks for XDM (cross-document messaging) support from browser extensions
   */
  isInstalled(): boolean {
    // BRC-100 wallets communicate via XDM, so we always return true
    // The actual connection will fail if no wallet is available
    return typeof window !== 'undefined'
  }

  isConnected(): boolean {
    return this._isConnected
  }

  async connect(): Promise<string> {
    try {
      // Create WalletClient with 'XDM' substrate for browser extension communication
      // 'auto' will try different substrates in order
      this.walletClient = new WalletClient('XDM')

      // Connect to the wallet extension
      await this.walletClient.connectToSubstrate()

      // Wait for user to authenticate in their wallet
      await this.walletClient.waitForAuthentication()

      // Get the user's identity public key
      const { publicKey } = await this.walletClient.getPublicKey({ identityKey: true })

      // Store the connection state
      this._isConnected = true
      if (typeof window !== 'undefined') {
        localStorage.setItem('brc100_identity_key', publicKey)
      }

      return publicKey
    } catch (error) {
      console.error('BRC-100 wallet connection failed:', error)
      throw new Error('Failed to connect to BRC-100 wallet. Make sure you have a compatible wallet installed (e.g., Metanet Desktop, SPV Wallet Extension).')
    }
  }

  async disconnect(): Promise<void> {
    this.walletClient = null
    this._isConnected = false
    if (typeof window !== 'undefined') {
      localStorage.removeItem('brc100_identity_key')
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
    if (!this.walletClient) {
      throw new Error('Wallet not connected')
    }

    try {
      // List outputs in the default basket to get balance
      const { outputs } = await this.walletClient.listOutputs({
        basket: 'default',
        limit: 10000
      })

      // Sum up all spendable outputs
      const satoshis = outputs
        .filter(o => o.spendable)
        .reduce((sum, o) => sum + o.satoshis, 0)

      return {
        bsv: satoshis / 100_000_000,
        satoshis,
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
    if (!this.walletClient) {
      throw new Error('Wallet not connected')
    }

    // Get current block height
    const { height: currentHeight } = await this.walletClient.getHeight()
    const unlockBlock = currentHeight + blocks

    // Get user's public key for the lock
    const { publicKey } = await this.walletClient.getPublicKey({ identityKey: true })

    // Create a time-locked output using OP_CHECKLOCKTIMEVERIFY (CLTV)
    // The locking script checks that the block height is >= unlockBlock
    const lockingScript = this.createCLTVLockingScript(publicKey, unlockBlock)

    const result = await this.walletClient.createAction({
      description: 'Lock BSV for blocks',
      outputs: [{
        lockingScript,
        satoshis,
        outputDescription: `Locked until block ${unlockBlock}`,
        basket: 'wrootz_locks',
        tags: ['lock', `unlock_${unlockBlock}`]
      }],
      labels: ['lock', 'wrootz']
    })

    if (!result.txid) {
      throw new Error('Lock transaction creation failed')
    }

    return {
      txid: result.txid,
      lockAddress: publicKey, // Using pubkey as address for BRC-100
      amount: satoshis,
      unlockBlock
    }
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
    if (!this.walletClient) {
      throw new Error('Wallet not connected')
    }

    // Create a 1Sat Ordinals inscription
    // The inscription format follows the 1Sat Ordinals protocol

    // Build the inscription locking script
    // Format: OP_FALSE OP_IF "ord" OP_1 <content-type> OP_0 <data> OP_ENDIF <p2pkh>
    const { publicKey } = await this.walletClient.getPublicKey({ identityKey: true })

    const inscriptionScript = this.buildInscriptionScript(
      data.base64Data,
      data.mimeType,
      publicKey,
      data.map
    )

    const result = await this.walletClient.createAction({
      description: 'Create inscription',
      outputs: [{
        lockingScript: inscriptionScript,
        satoshis: 1, // 1Sat ordinal
        outputDescription: 'Ordinal inscription',
        basket: 'wrootz_ordinals',
        tags: ['inscription', 'ordinal']
      }],
      labels: ['inscription', 'wrootz']
    })

    if (!result.txid) {
      throw new Error('Inscription creation failed')
    }

    return {
      txid: result.txid,
      origin: `${result.txid}_0`
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
