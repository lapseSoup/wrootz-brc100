/**
 * Blockchain Verification Utilities
 *
 * Verifies on-chain data against database records using WhatsOnChain API.
 * All verification is FREE - no transaction costs, just API calls.
 */

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main'

export interface TransactionOutput {
  value: number // satoshis
  n: number // output index
  scriptPubKey: {
    hex: string
    asm: string
    type: string
  }
}

export interface TransactionData {
  txid: string
  confirmations: number
  blockheight: number
  blocktime: number
  vout: TransactionOutput[]
  vin: Array<{
    txid: string
    vout: number
  }>
}

export interface LockVerification {
  verified: boolean
  txExists: boolean
  outputExists: boolean
  amountMatches: boolean
  scriptIsValidCLTV: boolean
  unlockBlockMatches: boolean
  isUnspent: boolean
  ordinalReferenceFound: boolean

  // Actual on-chain values (for comparison)
  onChainAmount?: number
  onChainUnlockBlock?: number
  onChainOrdinalRef?: string

  // Error message if verification failed
  error?: string

  // Verification timestamp
  verifiedAt: string
}

export interface InscriptionVerification {
  verified: boolean
  txExists: boolean
  isOrdinal: boolean
  contentType?: string
  error?: string
  verifiedAt: string
}

/**
 * Fetch transaction data from WhatsOnChain
 */
export async function fetchTransaction(txid: string): Promise<TransactionData | null> {
  try {
    const response = await fetch(`${WHATSONCHAIN_API}/tx/${txid}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 } // Cache for 60 seconds
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`WhatsOnChain API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Failed to fetch transaction ${txid}:`, error)
    return null
  }
}

/**
 * Check if a specific output is unspent
 */
export async function isOutputUnspent(txid: string, vout: number): Promise<boolean> {
  try {
    // WhatsOnChain provides spent status via the tx/hash/out/n/spent endpoint
    const response = await fetch(`${WHATSONCHAIN_API}/tx/${txid}/out/${vout}/spent`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 30 } // Cache for 30 seconds
    })

    if (!response.ok) {
      // If 404, the output doesn't exist or hasn't been spent
      if (response.status === 404) return true // Assume unspent if not found in spent index
      throw new Error(`WhatsOnChain API error: ${response.status}`)
    }

    const data = await response.json()
    // If we get data back, it means the output has been spent
    return !data || Object.keys(data).length === 0
  } catch (error) {
    console.error(`Failed to check spent status for ${txid}:${vout}:`, error)
    return true // Assume unspent on error (conservative)
  }
}

/**
 * Parse CLTV locking script to extract unlock block
 * CLTV script format: <locktime> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG
 * Hex: <locktime_push> b1 75 <pubkey_push> ac
 */
export function parseCLTVScript(scriptHex: string): { unlockBlock: number; pubKey: string } | null {
  try {
    // Script should end with OP_CHECKSIG (ac)
    if (!scriptHex.endsWith('ac')) return null

    // Find OP_CLTV (b1) and OP_DROP (75)
    const cltvIndex = scriptHex.indexOf('b175')
    if (cltvIndex === -1) return null

    // Everything before b175 is the locktime push
    const locktimePart = scriptHex.substring(0, cltvIndex)

    // Parse the locktime (it's a script number)
    const unlockBlock = parseScriptNumber(locktimePart)
    if (unlockBlock === null) return null

    // Everything after b175 until ac is the pubkey push
    const pubkeyPart = scriptHex.substring(cltvIndex + 4, scriptHex.length - 2)

    // Extract pubkey (remove push opcode)
    const pubKey = extractPushData(pubkeyPart)
    if (!pubKey) return null

    return { unlockBlock, pubKey }
  } catch (error) {
    console.error('Failed to parse CLTV script:', error)
    return null
  }
}

/**
 * Parse a script number from hex
 */
function parseScriptNumber(hex: string): number | null {
  if (!hex || hex.length === 0) return null

  // Get the push opcode (first byte)
  const pushOp = parseInt(hex.substring(0, 2), 16)

  // Small numbers (OP_1 through OP_16)
  if (pushOp >= 0x51 && pushOp <= 0x60) {
    return pushOp - 0x50
  }

  // OP_0
  if (pushOp === 0x00) return 0

  // Direct push (1-75 bytes)
  if (pushOp >= 0x01 && pushOp <= 0x4b) {
    const dataHex = hex.substring(2, 2 + pushOp * 2)
    return littleEndianHexToNumber(dataHex)
  }

  // OP_PUSHDATA1
  if (pushOp === 0x4c) {
    const len = parseInt(hex.substring(2, 4), 16)
    const dataHex = hex.substring(4, 4 + len * 2)
    return littleEndianHexToNumber(dataHex)
  }

  return null
}

/**
 * Convert little-endian hex to number
 */
function littleEndianHexToNumber(hex: string): number {
  // Reverse bytes
  const bytes = hex.match(/.{2}/g) || []
  const reversed = bytes.reverse().join('')

  // Check for negative (if high bit is set)
  const num = parseInt(reversed, 16)
  const highByte = parseInt(bytes[bytes.length - 1] || '00', 16)

  if (highByte & 0x80) {
    // Negative number - clear sign bit and negate
    return -(num & ~(0x80 << ((bytes.length - 1) * 8)))
  }

  return num
}

/**
 * Extract push data from script (removes the push opcode)
 */
function extractPushData(hex: string): string | null {
  if (!hex || hex.length < 2) return null

  const pushOp = parseInt(hex.substring(0, 2), 16)

  // Direct push (1-75 bytes)
  if (pushOp >= 0x01 && pushOp <= 0x4b) {
    return hex.substring(2, 2 + pushOp * 2)
  }

  // OP_PUSHDATA1
  if (pushOp === 0x4c) {
    const len = parseInt(hex.substring(2, 4), 16)
    return hex.substring(4, 4 + len * 2)
  }

  // OP_PUSHDATA2
  if (pushOp === 0x4d) {
    const lenHex = hex.substring(2, 6)
    const len = parseInt(lenHex.match(/.{2}/g)!.reverse().join(''), 16)
    return hex.substring(6, 6 + len * 2)
  }

  return null
}

/**
 * Parse OP_RETURN to extract wrootz protocol data
 * Format: OP_RETURN OP_FALSE "wrootz" <action> <data>
 */
export function parseWrootzOpReturn(scriptHex: string): { action: string; data: string } | null {
  try {
    // Must start with OP_RETURN (6a)
    if (!scriptHex.startsWith('6a')) return null

    let pos = 2

    // Skip OP_FALSE if present
    if (scriptHex.substring(pos, pos + 2) === '00') {
      pos += 2
    }

    // Extract pushed data items
    const items: string[] = []
    while (pos < scriptHex.length) {
      const pushOp = parseInt(scriptHex.substring(pos, pos + 2), 16)
      pos += 2

      let dataLen = 0
      if (pushOp >= 0x01 && pushOp <= 0x4b) {
        dataLen = pushOp
      } else if (pushOp === 0x4c) {
        dataLen = parseInt(scriptHex.substring(pos, pos + 2), 16)
        pos += 2
      } else if (pushOp === 0x4d) {
        const lenHex = scriptHex.substring(pos, pos + 4)
        dataLen = parseInt(lenHex.match(/.{2}/g)!.reverse().join(''), 16)
        pos += 4
      } else {
        break
      }

      const dataHex = scriptHex.substring(pos, pos + dataLen * 2)
      pos += dataLen * 2

      // Convert hex to string
      const dataStr = Buffer.from(dataHex, 'hex').toString('utf8')
      items.push(dataStr)
    }

    // Check if first item is "wrootz"
    if (items.length >= 3 && items[0] === 'wrootz') {
      return {
        action: items[1],
        data: items[2]
      }
    }

    return null
  } catch (error) {
    console.error('Failed to parse OP_RETURN:', error)
    return null
  }
}

/**
 * Verify a lock transaction against database values
 */
export async function verifyLock(
  txid: string,
  expectedSatoshis: number,
  expectedUnlockBlock: number,
  expectedOrdinalOrigin?: string | null
): Promise<LockVerification> {
  const result: LockVerification = {
    verified: false,
    txExists: false,
    outputExists: false,
    amountMatches: false,
    scriptIsValidCLTV: false,
    unlockBlockMatches: false,
    isUnspent: false,
    ordinalReferenceFound: !expectedOrdinalOrigin, // True if not expected
    verifiedAt: new Date().toISOString()
  }

  try {
    // Fetch transaction
    const tx = await fetchTransaction(txid)
    if (!tx) {
      result.error = 'Transaction not found on blockchain'
      return result
    }
    result.txExists = true

    // Find the lock output (output 0 should be the CLTV lock)
    const lockOutput = tx.vout[0]
    if (!lockOutput) {
      result.error = 'Lock output (vout 0) not found'
      return result
    }
    result.outputExists = true

    // Verify amount
    result.onChainAmount = lockOutput.value
    result.amountMatches = lockOutput.value === expectedSatoshis

    // Parse and verify CLTV script
    const parsed = parseCLTVScript(lockOutput.scriptPubKey.hex)
    if (parsed) {
      result.scriptIsValidCLTV = true
      result.onChainUnlockBlock = parsed.unlockBlock
      result.unlockBlockMatches = parsed.unlockBlock === expectedUnlockBlock
    } else {
      result.error = 'Script is not a valid CLTV lock'
    }

    // Check if still unspent
    result.isUnspent = await isOutputUnspent(txid, 0)

    // Check for ordinal reference in OP_RETURN (output 1)
    if (expectedOrdinalOrigin && tx.vout[1]) {
      const opReturn = parseWrootzOpReturn(tx.vout[1].scriptPubKey.hex)
      if (opReturn && opReturn.action === 'lock') {
        result.onChainOrdinalRef = opReturn.data
        result.ordinalReferenceFound = opReturn.data === expectedOrdinalOrigin
      }
    }

    // Overall verification
    result.verified = result.txExists &&
      result.outputExists &&
      result.amountMatches &&
      result.scriptIsValidCLTV &&
      result.unlockBlockMatches &&
      result.ordinalReferenceFound

    if (!result.verified && !result.error) {
      const issues = []
      if (!result.amountMatches) issues.push(`amount mismatch (on-chain: ${result.onChainAmount}, expected: ${expectedSatoshis})`)
      if (!result.unlockBlockMatches) issues.push(`unlock block mismatch (on-chain: ${result.onChainUnlockBlock}, expected: ${expectedUnlockBlock})`)
      if (!result.ordinalReferenceFound) issues.push(`ordinal reference mismatch`)
      result.error = `Verification failed: ${issues.join(', ')}`
    }

    return result
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown verification error'
    return result
  }
}

/**
 * Verify an inscription exists on-chain
 */
export async function verifyInscription(txid: string): Promise<InscriptionVerification> {
  const result: InscriptionVerification = {
    verified: false,
    txExists: false,
    isOrdinal: false,
    verifiedAt: new Date().toISOString()
  }

  try {
    const tx = await fetchTransaction(txid)
    if (!tx) {
      result.error = 'Transaction not found on blockchain'
      return result
    }
    result.txExists = true

    // Check if output 0 looks like an ordinal (1 sat output with inscription script)
    const output = tx.vout[0]
    if (output && output.value === 1) {
      // Check for ordinal envelope (starts with OP_FALSE OP_IF "ord")
      const scriptHex = output.scriptPubKey.hex
      // OP_FALSE (00) OP_IF (63) + push "ord" (03 6f7264)
      if (scriptHex.includes('0063036f7264')) {
        result.isOrdinal = true

        // Try to extract content type
        // After "ord" comes OP_1 (51) then content-type push
        const ordIndex = scriptHex.indexOf('0063036f7264')
        const afterOrd = scriptHex.substring(ordIndex + 12) // Skip "0063036f7264"

        if (afterOrd.startsWith('51')) { // OP_1
          const contentTypePush = afterOrd.substring(2)
          const pushLen = parseInt(contentTypePush.substring(0, 2), 16)
          if (pushLen > 0 && pushLen < 100) {
            const contentTypeHex = contentTypePush.substring(2, 2 + pushLen * 2)
            result.contentType = Buffer.from(contentTypeHex, 'hex').toString('utf8')
          }
        }
      }
    }

    result.verified = result.txExists && result.isOrdinal

    if (!result.verified && !result.error) {
      result.error = result.txExists ? 'Transaction is not a valid ordinal inscription' : 'Transaction not found'
    }

    return result
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown verification error'
    return result
  }
}

/**
 * Get current block height from WhatsOnChain
 */
export async function getCurrentBlockHeight(): Promise<number | null> {
  try {
    const response = await fetch(`${WHATSONCHAIN_API}/chain/info`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 30 }
    })

    if (!response.ok) {
      throw new Error(`WhatsOnChain API error: ${response.status}`)
    }

    const data = await response.json()
    return data.blocks
  } catch (error) {
    console.error('Failed to get block height:', error)
    return null
  }
}
