/**
 * Simply Sats Wallet Adapter
 *
 * Connects to the Simply Sats desktop wallet via HTTP on port 3322.
 * Simply Sats implements the BRC-100 HTTP-JSON protocol (same as Metanet Desktop).
 */

import { Hash } from '@bsv/sdk'
import type { WalletProvider, WalletBalance, SendResult, LockResult, InscriptionData, InscriptionResult, LockedOutput, UnlockResult } from './types'

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT = 10000 // 10 seconds

// Simply Sats runs on port 3322 (Metanet Desktop uses 3321)
const SIMPLY_SATS_URL = 'http://localhost:3322'

export class SimplySatsAdapter implements WalletProvider {
  name = 'Simply Sats'
  icon = '/wallets/simplysats.png'

  private _isConnected = false
  private identityKey: string | null = null
  private accountChangeCallbacks: ((address: string) => void)[] = []
  private disconnectCallbacks: (() => void)[] = []

  constructor() {
    // Check for stored connection
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('simplysats_identity_key')
      if (stored) {
        this.identityKey = stored
        this._isConnected = true
      }
    }
  }

  /**
   * Make an HTTP API call to Simply Sats
   */
  private async api<T>(method: string, args: any = {}): Promise<T> {
    const response = await fetch(`${SIMPLY_SATS_URL}/${method}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args)
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || `HTTP error ${response.status}`)
    }

    return await response.json()
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
   * Connect to Simply Sats wallet via HTTP
   */
  async connect(): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('Cannot connect in server environment')
    }

    try {
      console.log('Connecting to Simply Sats via HTTP...')

      // Test connection with getVersion
      const versionResult = await this.withTimeout(
        this.api<{ version: string }>('getVersion'),
        CONNECTION_TIMEOUT,
        'Connection to Simply Sats timed out. Make sure Simply Sats is running.'
      )
      console.log('Simply Sats version:', versionResult.version)

      // Wait for authentication
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

      // Store the connection state
      this._isConnected = true
      this.identityKey = publicKey
      localStorage.setItem('simplysats_identity_key', publicKey)

      console.log('Connected to Simply Sats, identity key:', publicKey.slice(0, 16) + '...')
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('simplysats_identity_key')
    }
    this.disconnectCallbacks.forEach(cb => cb())
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
    const result = await this.api<{ txid: string }>('createAction', {
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
    try {
      // Get current block height
      const { height: currentHeight } = await this.api<{ height: number }>('getHeight')
      const unlockBlock = currentHeight + blocks

      // Get user's public key for the lock
      const { publicKey } = await this.api<{ publicKey: string }>('getPublicKey', { identityKey: true })

      // Create a time-locked output using OP_CHECKLOCKTIMEVERIFY (CLTV)
      const lockingScript = this.createCLTVLockingScript(publicKey, unlockBlock)

      console.log(`Creating lock: ${satoshis} sats for ${blocks} blocks (until block ${unlockBlock})`)

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
        this.api<{ txid: string }>('createAction', {
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
        throw error
      }
      throw new Error('Lock failed: Unknown error')
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
      const { height: currentHeight } = await this.api<{ height: number }>('getHeight')
      const locks = await this.listLocks()
      const lock = locks.find(l => l.outpoint === outpoint)

      if (!lock) {
        throw new Error('Lock not found in wallet')
      }

      if (!lock.spendable) {
        throw new Error(`Lock is not yet spendable. ${lock.blocksRemaining} blocks remaining`)
      }

      const { publicKey } = await this.api<{ publicKey: string }>('getPublicKey', { identityKey: true })
      const pubKeyHashHex = this.hash160(publicKey)
      const p2pkhScript = '76a914' + pubKeyHashHex + '88ac'

      const result = await this.withTimeout(
        this.api<{ txid: string }>('createAction', {
          description: `Wrootz: Unlock ${lock.satoshis} sats`,
          inputs: [{
            outpoint,
            inputDescription: 'Unlock time-locked BSV',
            unlockingScriptLength: 108,
            sequenceNumber: 0xfffffffe
          }],
          outputs: [{
            lockingScript: p2pkhScript,
            satoshis: lock.satoshis - 1,
            outputDescription: 'Unlocked funds',
            basket: 'default'
          }],
          lockTime: currentHeight,
          labels: ['unlock', 'wrootz']
        }),
        60000,
        'Unlock transaction timed out.'
      )

      if (!result.txid) {
        throw new Error('Unlock transaction failed')
      }

      return {
        txid: result.txid,
        amount: lock.satoshis
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Unlock failed: Unknown error')
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
      const inscriptionScript = this.buildInscriptionScript(
        data.base64Data,
        data.mimeType,
        publicKey,
        data.map
      )

      console.log('Creating inscription via Simply Sats, script length:', inscriptionScript.length)

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

      console.log('Inscription created:', result.txid)

      return {
        txid: result.txid,
        origin: `${result.txid}_0`
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Lost connection to Simply Sats. Please try again or reconnect.')
        }
        if (error.message.includes('rejected') || error.message.includes('denied')) {
          throw new Error('Inscription was rejected in Simply Sats.')
        }
        throw error
      }
      throw new Error('Inscription failed: Unknown error')
    }
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
      for (const [key, value] of Object.entries(map)) {
        script += this.pushData(Buffer.from(key).toString('hex'))
        script += this.pushData(Buffer.from(value).toString('hex'))
      }
    }

    script += '68' // OP_ENDIF

    // Add P2PKH for the recipient
    const pubKeyHashHex = this.hash160(pubKeyHex)
    script += '76a914' + pubKeyHashHex + '88ac'

    return script
  }

  onAccountChange(callback: (address: string) => void): void {
    this.accountChangeCallbacks.push(callback)
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback)
  }

  async getNetwork(): Promise<'mainnet' | 'testnet'> {
    const { network } = await this.api<{ network: string }>('getNetwork')
    return network as 'mainnet' | 'testnet'
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

  // Helper methods

  private createP2PKHLockingScript(address: string): string {
    const decoded = this.decodeBase58Check(address)
    const pubKeyHash = decoded.slice(1)
    const pubKeyHashHex = Buffer.from(pubKeyHash).toString('hex')
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
    // Convert hex to bytes
    const bytes: number[] = []
    for (let i = 0; i < hexData.length; i += 2) {
      bytes.push(parseInt(hexData.slice(i, i + 2), 16))
    }

    // Use @bsv/sdk Hash.hash160
    const hash = Hash.hash160(bytes)

    // Convert back to hex
    return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

export const simplySatsWallet = new SimplySatsAdapter()
