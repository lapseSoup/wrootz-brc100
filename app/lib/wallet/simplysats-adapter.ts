/**
 * Simply Sats Wallet Adapter
 *
 * Connects to the Simply Sats desktop wallet via HTTP on port 3322.
 * Simply Sats implements the BRC-100 JSON-API protocol.
 *
 * Simply Sats is a lightweight BRC-100 wallet that supports:
 * - Identity key for authentication
 * - Standard P2PKH addresses for payments
 * - Message signing
 * - Time-locked outputs for content support
 */

import { WalletClient } from '@bsv/sdk'
import type { WalletProvider, WalletBalance, SendResult, LockResult, InscriptionData, InscriptionResult, LockedOutput, UnlockResult } from './types'

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT = 10000 // 10 seconds

// Simply Sats runs on port 3322 (Metanet Desktop uses 3321)
const SIMPLY_SATS_URL = 'http://localhost:3322'

export class SimplySatsAdapter implements WalletProvider {
  name = 'Simply Sats'
  icon = '/wallets/simplysats.png'

  private walletClient: WalletClient | null = null
  private _isConnected = false
  private accountChangeCallbacks: ((address: string) => void)[] = []
  private disconnectCallbacks: (() => void)[] = []

  constructor() {
    // Check for stored connection
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('simplysats_identity_key')
      if (stored) {
        this._isConnected = true
      }
    }
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
   * Check if Simply Sats is available
   */
  isInstalled(): boolean {
    return typeof window !== 'undefined'
  }

  isConnected(): boolean {
    return this._isConnected
  }

  /**
   * Ensure wallet is connected, reconnect if needed
   */
  private async ensureConnected(): Promise<WalletClient> {
    if (this.walletClient && this._isConnected) {
      // Test if connection is still alive
      try {
        await this.withTimeout(
          this.walletClient.isAuthenticated(),
          5000,
          'Connection check timed out'
        )
        return this.walletClient
      } catch (error) {
        console.warn('Simply Sats connection stale, reconnecting...', error)
      }
    }

    // Reconnect
    console.log('Reconnecting to Simply Sats...')
    this.walletClient = new WalletClient(SIMPLY_SATS_URL as 'XDM')
    await this.walletClient.connectToSubstrate()
    await this.walletClient.waitForAuthentication()
    return this.walletClient
  }

  /**
   * Connect to Simply Sats wallet via HTTP
   */
  async connect(): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('Cannot connect in server environment')
    }

    try {
      console.log('Connecting to Simply Sats via HTTP...')

      // Create WalletClient with HTTP substrate
      this.walletClient = new WalletClient(SIMPLY_SATS_URL as 'XDM')

      // Connect to the wallet with timeout
      await this.withTimeout(
        this.walletClient.connectToSubstrate(),
        CONNECTION_TIMEOUT,
        'Connection to Simply Sats timed out. Make sure Simply Sats is running.'
      )

      // Wait for user to authenticate in their wallet with timeout
      await this.withTimeout(
        this.walletClient.waitForAuthentication(),
        CONNECTION_TIMEOUT * 3, // Give more time for user to authenticate
        'Authentication timed out. Please approve the connection in Simply Sats.'
      )

      // Get the user's identity public key
      const { publicKey } = await this.walletClient.getPublicKey({ identityKey: true })

      // Store the connection state
      this._isConnected = true
      localStorage.setItem('simplysats_identity_key', publicKey)

      console.log('Connected to Simply Sats')
      return publicKey
    } catch (error) {
      console.error('Failed to connect to Simply Sats:', error)
      this.walletClient = null

      // Provide helpful error message
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'

      if (errorMessage.includes('timed out') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        throw new Error(
          'Could not connect to Simply Sats. Please make sure:\n\n' +
          '1. Simply Sats is installed and running\n' +
          '2. You have a wallet set up in Simply Sats\n\n' +
          'Download Simply Sats at: https://github.com/example/simply-sats/releases'
        )
      }

      throw error
    }
  }

  async disconnect(): Promise<void> {
    this._isConnected = false
    this.walletClient = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('simplysats_identity_key')
    }
    this.disconnectCallbacks.forEach(cb => cb())
  }

  async getAddress(): Promise<string> {
    const stored = typeof window !== 'undefined'
      ? localStorage.getItem('simplysats_identity_key')
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

      // Try to get balance from default basket
      let totalSatoshis = 0

      try {
        const result = await client.listOutputs({
          basket: 'default',
          limit: 10000
        })
        const outputs = result.outputs || []
        totalSatoshis = outputs
          .filter((o) => o.spendable !== false)
          .reduce((sum: number, o) => sum + (o.satoshis || 0), 0)
      } catch {
        console.log('Could not get balance from Simply Sats')
      }

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
    const client = await this.ensureConnected()

    const result = await client.createAction({
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

  async lockBSV(satoshis: number, blocks: number, ordinalOrigin?: string): Promise<LockResult> {
    const client = await this.ensureConnected()

    try {
      // Get current block height
      const { height: currentHeight } = await client.getHeight()
      const unlockBlock = currentHeight + blocks

      // Get user's public key for the lock
      const { publicKey } = await client.getPublicKey({ identityKey: true })

      // Create a time-locked output using OP_CHECKLOCKTIMEVERIFY (CLTV)
      const lockingScript = this.createCLTVLockingScript(publicKey, unlockBlock)

      console.log(`Creating lock: ${satoshis} sats for ${blocks} blocks (until block ${unlockBlock})`)
      if (ordinalOrigin) {
        console.log(`Linking to ordinal: ${ordinalOrigin}`)
      }

      // Build outputs array
      const outputs: Array<{
        lockingScript: string
        satoshis: number
        outputDescription: string
        basket?: string
        tags?: string[]
      }> = [
        {
          lockingScript,
          satoshis,
          outputDescription: `Locked until block ${unlockBlock}`,
          basket: 'wrootz_locks',
          tags: ['lock', `unlock_${unlockBlock}`, 'wrootz', ...(ordinalOrigin ? [`ordinal_${ordinalOrigin}`] : [])]
        }
      ]

      // Add OP_RETURN output with ordinal reference if provided
      if (ordinalOrigin) {
        const opReturnScript = this.createWrootzOpReturn('lock', ordinalOrigin)
        outputs.push({
          lockingScript: opReturnScript,
          satoshis: 0,
          outputDescription: `Wrootz lock reference to ordinal ${ordinalOrigin}`
        })
      }

      const result = await this.withTimeout(
        client.createAction({
          description: `Wrootz: Lock ${satoshis} sats for ${blocks} blocks${ordinalOrigin ? ` → ${ordinalOrigin.slice(0, 8)}...` : ''}`,
          outputs,
          labels: ['lock', 'wrootz']
        }),
        60000,
        'Lock transaction timed out. Please approve the transaction in Simply Sats.'
      )

      if (!result.txid) {
        throw new Error('Lock transaction creation failed - no txid returned')
      }

      console.log('Lock created:', result.txid)

      return {
        txid: result.txid,
        lockAddress: publicKey,
        amount: satoshis,
        unlockBlock
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Lost connection to Simply Sats. Please try again or reconnect your wallet.')
        }
        if (error.message.includes('rejected') || error.message.includes('denied')) {
          throw new Error('Transaction was rejected in the wallet.')
        }
        throw error
      }
      throw new Error('Lock failed: Unknown error')
    }
  }

  async listLocks(): Promise<LockedOutput[]> {
    const client = await this.ensureConnected()

    try {
      const { height: currentHeight } = await client.getHeight()

      const result = await client.listOutputs({
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

      console.log(`Found ${locks.length} locked outputs, ${locks.filter(l => l.spendable).length} are unlockable`)

      return locks
    } catch (error) {
      console.error('Failed to list locks:', error)
      return []
    }
  }

  async unlockBSV(outpoint: string): Promise<UnlockResult> {
    const client = await this.ensureConnected()

    try {
      const { height: currentHeight } = await client.getHeight()
      const locks = await this.listLocks()
      const lock = locks.find(l => l.outpoint === outpoint)

      if (!lock) {
        throw new Error('Lock not found in wallet')
      }

      if (!lock.spendable) {
        throw new Error(`Lock is not yet spendable. ${lock.blocksRemaining} blocks remaining (unlocks at block ${lock.unlockBlock})`)
      }

      console.log(`Unlocking ${lock.satoshis} sats from outpoint ${outpoint}`)

      const result = await this.withTimeout(
        client.createAction({
          description: `Wrootz: Unlock ${lock.satoshis} sats`,
          inputs: [{
            outpoint,
            inputDescription: 'Unlock time-locked BSV',
            unlockingScriptLength: 108,
            sequenceNumber: 0xfffffffe
          }],
          outputs: [{
            lockingScript: await this.createP2PKHFromIdentity(),
            satoshis: lock.satoshis - 1,
            outputDescription: 'Unlocked funds',
            basket: 'default'
          }],
          lockTime: currentHeight,
          labels: ['unlock', 'wrootz']
        }),
        60000,
        'Unlock transaction timed out. Please approve the transaction in Simply Sats.'
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
          throw new Error('Lost connection to Simply Sats. Please try again or reconnect your wallet.')
        }
        throw error
      }
      throw new Error('Unlock failed: Unknown error')
    }
  }

  async signMessage(message: string): Promise<string> {
    const client = await this.ensureConnected()

    const messageBytes = new TextEncoder().encode(message)

    const { signature } = await client.createSignature({
      data: Array.from(messageBytes),
      protocolID: [0, 'wrootz signing'],
      keyID: '1'
    })

    return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async inscribe(data: InscriptionData): Promise<InscriptionResult> {
    throw new Error('Inscriptions not yet supported via Simply Sats.')
  }

  onAccountChange(callback: (address: string) => void): void {
    this.accountChangeCallbacks.push(callback)
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback)
  }

  async getNetwork(): Promise<'mainnet' | 'testnet'> {
    return 'mainnet'
  }

  async getBlockHeight(): Promise<number> {
    try {
      const client = await this.ensureConnected()
      const { height } = await client.getHeight()
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

  // Helper methods

  private createP2PKHLockingScript(address: string): string {
    const decoded = this.decodeBase58Check(address)
    const pubKeyHash = decoded.slice(1)
    const pubKeyHashHex = Buffer.from(pubKeyHash).toString('hex')
    return '76a914' + pubKeyHashHex + '88ac'
  }

  private async createP2PKHFromIdentity(): Promise<string> {
    const client = await this.ensureConnected()
    const { publicKey } = await client.getPublicKey({ identityKey: true })
    const pubKeyHashHex = this.hash160(publicKey)
    return '76a914' + pubKeyHashHex + '88ac'
  }

  private createCLTVLockingScript(pubKeyHex: string, lockTime: number): string {
    const lockTimeHex = this.encodeScriptNum(lockTime)
    return lockTimeHex + 'b175' + this.pushData(pubKeyHex) + 'ac'
  }

  private createWrootzOpReturn(action: string, data: string): string {
    let script = '6a00'
    script += this.pushData(Buffer.from('wrootz').toString('hex'))
    script += this.pushData(Buffer.from(action).toString('hex'))
    script += this.pushData(Buffer.from(data).toString('hex'))
    return script
  }

  private decodeBase58Check(str: string): Uint8Array {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

    let num = BigInt(0)
    for (const char of str) {
      const index = ALPHABET.indexOf(char)
      if (index === -1) throw new Error('Invalid base58 character')
      num = num * BigInt(58) + BigInt(index)
    }

    const hex = num.toString(16).padStart(50, '0')
    const bytes = new Uint8Array(25)
    for (let i = 0; i < 25; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }

    return bytes.slice(0, 21)
  }

  private encodeScriptNum(num: number): string {
    if (num === 0) return '00'
    if (num >= 1 && num <= 16) return (0x50 + num).toString(16)

    const bytes: number[] = []
    let n = Math.abs(num)
    while (n > 0) {
      bytes.push(n & 0xff)
      n >>= 8
    }

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

  private hash160(hexData: string): string {
    // Placeholder - in production use @bsv/sdk crypto
    console.warn('hash160: Using placeholder implementation')
    return hexData.slice(0, 40)
  }
}

export const simplySatsWallet = new SimplySatsAdapter()
