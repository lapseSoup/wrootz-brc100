import { describe, it, expect } from 'vitest'
import {
  parsePushTxScript,
  parseTimelockScript,
  parseWrootzOpReturn,
} from '../blockchain-verify'

// OP_PUSH_TX signature constant
const PUSHTX_SIG = '2097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff026'

/**
 * Build a mock OP_PUSH_TX script hex for testing.
 * Structure:
 *   [0-65] PUSHTX_SIG (32 bytes + 1 byte)
 *   [66-203] padding (69 bytes of zeros to reach offset 204)
 *   [204-205] 0x14 (push 20 bytes marker)
 *   [206-245] pubKeyHash (20 bytes)
 *   [246-247] nLockTime push length
 *   [248+] nLockTime value (little-endian)
 *   [remainder] suffix
 */
function buildMockScript(pubKeyHash: string, unlockBlock: number): string {
  // PUSHTX_SIG is 66 hex chars (33 bytes)
  // We need padding to reach offset 204
  const paddingLength = 204 - PUSHTX_SIG.length
  const padding = '00'.repeat(paddingLength / 2)

  // PKH marker
  const pkhMarker = '14'

  // nLockTime encoding (little-endian)
  let nlockHex = ''
  let temp = unlockBlock
  while (temp > 0) {
    nlockHex += (temp & 0xff).toString(16).padStart(2, '0')
    temp = temp >> 8
  }
  const nLockTimePushLen = (nlockHex.length / 2).toString(16).padStart(2, '0')

  // suffix (just some dummy ops)
  const suffix = 'ac'

  return PUSHTX_SIG + padding + pkhMarker + pubKeyHash + nLockTimePushLen + nlockHex + suffix
}

describe('parsePushTxScript', () => {
  it('parses a valid OP_PUSH_TX script', () => {
    const pubKeyHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    const unlockBlock = 850000

    const script = buildMockScript(pubKeyHash, unlockBlock)
    const result = parsePushTxScript(script)

    expect(result).not.toBeNull()
    expect(result!.pubKeyHash).toBe(pubKeyHash)
    expect(result!.unlockBlock).toBe(unlockBlock)
  })

  it('returns null for non-PUSHTX scripts', () => {
    const result = parsePushTxScript('76a914abcdef1234567890abcdef1234567890abcdef1288ac')
    expect(result).toBeNull()
  })

  it('returns null for empty script', () => {
    const result = parsePushTxScript('')
    expect(result).toBeNull()
  })

  it('handles small block heights', () => {
    const pubKeyHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    const script = buildMockScript(pubKeyHash, 100)
    const result = parsePushTxScript(script)

    expect(result).not.toBeNull()
    expect(result!.unlockBlock).toBe(100)
  })

  it('handles large block heights', () => {
    const pubKeyHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    const script = buildMockScript(pubKeyHash, 1000000)
    const result = parsePushTxScript(script)

    expect(result).not.toBeNull()
    expect(result!.unlockBlock).toBe(1000000)
  })
})

describe('parseTimelockScript', () => {
  it('returns pushtx type for OP_PUSH_TX scripts', () => {
    const pubKeyHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
    const script = buildMockScript(pubKeyHash, 850000)
    const result = parseTimelockScript(script)

    expect(result).not.toBeNull()
    expect(result!.scriptType).toBe('pushtx')
    expect(result!.unlockBlock).toBe(850000)
    expect(result!.pubKeyHash).toBe(pubKeyHash)
  })

  it('returns null for non-timelock scripts', () => {
    const result = parseTimelockScript('76a914abcdef88ac')
    expect(result).toBeNull()
  })
})

describe('parseWrootzOpReturn', () => {
  /**
   * Build an OP_RETURN script with wrootz protocol data.
   * Format: OP_RETURN [OP_FALSE] <push "wrootz"> <push action> <push data>
   */
  function buildOpReturn(action: string, data: string): string {
    const wrootzHex = Buffer.from('wrootz').toString('hex')
    const actionHex = Buffer.from(action).toString('hex')
    const dataHex = Buffer.from(data).toString('hex')

    // OP_RETURN (6a) + push lengths + data
    const pushWrootz = (wrootzHex.length / 2).toString(16).padStart(2, '0') + wrootzHex
    const pushAction = (actionHex.length / 2).toString(16).padStart(2, '0') + actionHex
    const pushData = (dataHex.length / 2).toString(16).padStart(2, '0') + dataHex

    return '6a' + pushWrootz + pushAction + pushData
  }

  it('parses a valid wrootz OP_RETURN', () => {
    const script = buildOpReturn('lock', 'abc123_0')
    const result = parseWrootzOpReturn(script)

    expect(result).not.toBeNull()
    expect(result!.action).toBe('lock')
    expect(result!.data).toBe('abc123_0')
  })

  it('returns null for non-OP_RETURN scripts', () => {
    const result = parseWrootzOpReturn('76a914abcdef88ac')
    expect(result).toBeNull()
  })

  it('returns null for OP_RETURN without wrootz prefix', () => {
    const otherHex = Buffer.from('other').toString('hex')
    const actionHex = Buffer.from('test').toString('hex')
    const dataHex = Buffer.from('data').toString('hex')
    const script = '6a' +
      (otherHex.length / 2).toString(16).padStart(2, '0') + otherHex +
      (actionHex.length / 2).toString(16).padStart(2, '0') + actionHex +
      (dataHex.length / 2).toString(16).padStart(2, '0') + dataHex
    const result = parseWrootzOpReturn(script)
    expect(result).toBeNull()
  })

  it('handles OP_FALSE prefix', () => {
    const wrootzHex = Buffer.from('wrootz').toString('hex')
    const actionHex = Buffer.from('lock').toString('hex')
    const dataHex = Buffer.from('tx_0').toString('hex')

    const script = '6a00' + // OP_RETURN OP_FALSE
      (wrootzHex.length / 2).toString(16).padStart(2, '0') + wrootzHex +
      (actionHex.length / 2).toString(16).padStart(2, '0') + actionHex +
      (dataHex.length / 2).toString(16).padStart(2, '0') + dataHex

    const result = parseWrootzOpReturn(script)
    expect(result).not.toBeNull()
    expect(result!.action).toBe('lock')
    expect(result!.data).toBe('tx_0')
  })
})
