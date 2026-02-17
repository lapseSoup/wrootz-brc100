import { describe, it, expect } from 'vitest'
import {
  pushData,
  hash160,
  decodeBase58Check,
  createP2PKHLockingScript,
  buildInscriptionScript,
} from '../wallet/wallet-utils'

describe('pushData', () => {
  it('should return "00" for empty string', () => {
    expect(pushData('')).toBe('00')
  })

  it('should prefix single byte with length 01', () => {
    expect(pushData('ff')).toBe('01ff')
  })

  it('should prefix small data with single-byte length', () => {
    // 2 bytes of data -> length prefix 02
    expect(pushData('aabb')).toBe('02aabb')
  })

  it('should use OP_PUSHDATA1 (4c) at the 76-byte boundary', () => {
    // 76 bytes = 152 hex chars (0x4c = 76, which is NOT < 0x4c, so hits the else-if branch)
    const hexData = 'ab'.repeat(76)
    const result = pushData(hexData)
    // Should be: '4c' + '4c' (76 in hex, padded to 2 chars) + data
    expect(result).toBe('4c4c' + hexData)
  })

  it('should use single-byte length for 75 bytes (max before OP_PUSHDATA1)', () => {
    // 75 = 0x4b, which IS < 0x4c, so uses the simple prefix
    const hexData = 'ab'.repeat(75)
    const result = pushData(hexData)
    expect(result).toBe('4b' + hexData)
  })

  it('should use OP_PUSHDATA1 for 255-byte data', () => {
    const hexData = 'cd'.repeat(255)
    const result = pushData(hexData)
    // 255 = 0xff
    expect(result).toBe('4cff' + hexData)
  })

  it('should use OP_PUSHDATA2 (4d) for 256-byte data with little-endian length', () => {
    const hexData = 'ef'.repeat(256)
    const result = pushData(hexData)
    // 256 = 0x0100 -> little-endian: '0001'
    expect(result).toBe('4d0001' + hexData)
  })
})

describe('hash160', () => {
  it('should produce the known hash160 for a Bitcoin wiki test vector public key', () => {
    // Public key from Bitcoin wiki
    const pubKey =
      '0250863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b2352'
    const expected = 'f54a5851e9372b87810a8e60cdd2e7cfd80b6e31'
    expect(hash160(pubKey)).toBe(expected)
  })
})

describe('decodeBase58Check', () => {
  it('should decode Satoshi\'s address without throwing', () => {
    expect(() => decodeBase58Check('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).not.toThrow()
  })

  it('should return a 21-byte payload (1 version byte + 20-byte hash)', () => {
    const payload = decodeBase58Check('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
    expect(payload.length).toBe(21)
  })

  it('should have version byte 0x00 for mainnet P2PKH', () => {
    const payload = decodeBase58Check('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
    expect(payload[0]).toBe(0x00)
  })

  it('should throw for an address with invalid checksum', () => {
    // Modify the last character to corrupt the checksum
    expect(() => decodeBase58Check('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb')).toThrow()
  })

  it('should throw for invalid base58 characters', () => {
    // '0', 'O', 'I', 'l' are not in the base58 alphabet
    expect(() => decodeBase58Check('0InvalidAddress')).toThrow('Invalid base58 character')
  })
})

describe('createP2PKHLockingScript', () => {
  it('should start with 76a914 and end with 88ac', () => {
    const script = createP2PKHLockingScript('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
    expect(script.startsWith('76a914')).toBe(true)
    expect(script.endsWith('88ac')).toBe(true)
  })

  it('should have a 40-hex-char pubkeyhash in the middle', () => {
    const script = createP2PKHLockingScript('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
    // Full script: '76a914' (6 chars) + pubkeyhash (40 chars) + '88ac' (4 chars) = 50 chars
    expect(script.length).toBe(50)
    const middle = script.slice(6, 46)
    expect(middle).toMatch(/^[0-9a-f]{40}$/)
  })

  it('should produce the correct pubkeyhash for Satoshi\'s address', () => {
    const script = createP2PKHLockingScript('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
    // The pubkeyhash of Satoshi's address is well-known:
    // 62e907b15cbf27d5425399ebf6f0fb50ebb88f18
    const pubKeyHash = script.slice(6, 46)
    expect(pubKeyHash).toBe('62e907b15cbf27d5425399ebf6f0fb50ebb88f18')
  })
})

describe('buildInscriptionScript', () => {
  // Use a small test payload
  const base64Data = Buffer.from('hello').toString('base64') // 'aGVsbG8='
  const mimeType = 'text/plain'
  // Use the Bitcoin wiki public key for a valid pubKeyHex
  const pubKeyHex =
    '0250863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b2352'

  it('should start with 0063 (OP_FALSE OP_IF)', () => {
    const script = buildInscriptionScript(base64Data, mimeType, pubKeyHex)
    expect(script.startsWith('0063')).toBe(true)
  })

  it('should contain 68 (OP_ENDIF)', () => {
    const script = buildInscriptionScript(base64Data, mimeType, pubKeyHex)
    expect(script).toContain('68')
  })

  it('should end with P2PKH script pattern 76a914...88ac', () => {
    const script = buildInscriptionScript(base64Data, mimeType, pubKeyHex)
    expect(script).toMatch(/76a914[0-9a-f]{40}88ac$/)
  })

  it('should contain the "ord" marker', () => {
    const script = buildInscriptionScript(base64Data, mimeType, pubKeyHex)
    const ordHex = Buffer.from('ord').toString('hex') // '6f7264'
    expect(script).toContain(ordHex)
  })

  it('should contain the mime type', () => {
    const script = buildInscriptionScript(base64Data, mimeType, pubKeyHex)
    const mimeHex = Buffer.from('text/plain').toString('hex')
    expect(script).toContain(mimeHex)
  })

  it('should include map key/value pairs when map is provided', () => {
    const map = { app: 'wrootz', type: 'post' }
    const script = buildInscriptionScript(base64Data, mimeType, pubKeyHex, map)

    const appHex = Buffer.from('app').toString('hex')
    const wrootzHex = Buffer.from('wrootz').toString('hex')
    const typeHex = Buffer.from('type').toString('hex')
    const postHex = Buffer.from('post').toString('hex')

    expect(script).toContain(appHex)
    expect(script).toContain(wrootzHex)
    expect(script).toContain(typeHex)
    expect(script).toContain(postHex)
  })

  it('should place map data before OP_ENDIF and P2PKH', () => {
    const map = { app: 'wrootz' }
    const script = buildInscriptionScript(base64Data, mimeType, pubKeyHex, map)

    const wrootzHex = Buffer.from('wrootz').toString('hex')
    const endifIdx = script.lastIndexOf('6876a914')
    const mapIdx = script.indexOf(wrootzHex)

    // Map data should appear before OP_ENDIF + P2PKH
    expect(mapIdx).toBeLessThan(endifIdx)
  })

  it('should use the hash160 of pubKeyHex in the P2PKH portion', () => {
    const script = buildInscriptionScript(base64Data, mimeType, pubKeyHex)
    const expectedHash = hash160(pubKeyHex)
    // The P2PKH at the end should contain the hash160 of the public key
    expect(script).toMatch(new RegExp(`76a914${expectedHash}88ac$`))
  })
})
