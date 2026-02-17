/**
 * Shared utility functions for wallet adapters.
 * Both BRC-100 and Simply Sats adapters delegate to these implementations.
 */

import { Hash } from '@bsv/sdk'

/**
 * Wrap a promise with a timeout
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    )
  ])
}

/**
 * Create a push data opcode for Bitcoin script
 */
export function pushData(hexData: string): string {
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
 */
export function hash160(hexData: string): string {
  const bytes: number[] = []
  for (let i = 0; i < hexData.length; i += 2) {
    bytes.push(parseInt(hexData.slice(i, i + 2), 16))
  }
  const hash = Hash.hash160(bytes)
  return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Decode a base58check encoded string (e.g., BSV address)
 */
export function decodeBase58Check(str: string): Uint8Array {
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

  // Verify checksum - hash256(payload)[0:4] must match last 4 bytes
  const payload = bytes.slice(0, 21)
  const checksum = bytes.slice(21, 25)
  const checksumHash = Hash.hash256(Array.from(payload))
  for (let i = 0; i < 4; i++) {
    if (checksumHash[i] !== checksum[i]) {
      throw new Error('Invalid Base58Check checksum - address may be corrupted')
    }
  }

  return payload // Return version byte + 20 byte hash
}

/**
 * Create a P2PKH locking script from a BSV address
 */
export function createP2PKHLockingScript(address: string): string {
  const decoded = decodeBase58Check(address)
  const pubKeyHash = decoded.slice(1) // Remove version byte
  const pubKeyHashHex = Buffer.from(pubKeyHash).toString('hex')
  return '76a914' + pubKeyHashHex + '88ac'
}

/**
 * Build a 1Sat Ordinals inscription script
 */
export function buildInscriptionScript(
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
  script += pushData(Buffer.from('ord').toString('hex')) // "ord"
  script += '51' // OP_1
  script += pushData(mimeTypeBytes.toString('hex')) // content-type
  script += '00' // OP_0
  script += pushData(dataBytes.toString('hex')) // data

  // Add optional MAP data if provided
  if (map && Object.keys(map).length > 0) {
    for (const [key, value] of Object.entries(map)) {
      script += pushData(Buffer.from(key).toString('hex'))
      script += pushData(Buffer.from(value).toString('hex'))
    }
  }

  script += '68' // OP_ENDIF

  // Add P2PKH for the recipient
  const pubKeyHashHex = hash160(pubKeyHex)
  script += '76a914' + pubKeyHashHex + '88ac'

  return script
}
