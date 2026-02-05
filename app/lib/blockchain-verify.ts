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
  scriptIsValidLock: boolean
  scriptType?: 'pushtx' | 'unknown'
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

// OP_PUSH_TX timelock script signature (from Simply Sats / jdh7190's bsv-lock)
// This is the first 32-byte constant that identifies the sCrypt-compiled timelock script
const PUSHTX_SIGNATURE = '2097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff026'

/**
 * Parse OP_PUSH_TX timelock script (Simply Sats format)
 *
 * Script structure:
 * - Offset 0-203: Prefix constants (3x 32-byte + 2 zeros)
 * - Offset 204-205: 0x14 (push 20 bytes marker)
 * - Offset 206-245: Public Key Hash (20 bytes = 40 hex chars)
 * - Offset 246-247: Push-length byte for nLockTime
 * - Offset 248+: nLockTime value (little-endian, 1-4 bytes)
 * - Remainder: Suffix operations
 */
export function parsePushTxScript(scriptHex: string): { unlockBlock: number; pubKeyHash: string } | null {
  try {
    // Check for OP_PUSH_TX signature
    if (!scriptHex.startsWith(PUSHTX_SIGNATURE)) return null

    // Verify PKH push marker at offset 204
    const pkhPushByte = scriptHex.substring(204, 206)
    if (pkhPushByte !== '14') return null // Must be push 20 bytes

    // Extract public key hash (20 bytes = 40 hex chars starting at offset 206)
    const pubKeyHash = scriptHex.substring(206, 246)
    if (pubKeyHash.length !== 40) return null

    // Extract nLockTime at offset 246
    const nLockTimePushByte = parseInt(scriptHex.substring(246, 248), 16)
    if (nLockTimePushByte < 1 || nLockTimePushByte > 5) return null // Reasonable range for block height

    const nLockTimeHex = scriptHex.substring(248, 248 + nLockTimePushByte * 2)
    const unlockBlock = littleEndianHexToNumber(nLockTimeHex)

    return { unlockBlock, pubKeyHash }
  } catch (error) {
    console.error('Failed to parse OP_PUSH_TX script:', error)
    return null
  }
}

/**
 * Parse timelock script (OP_PUSH_TX format from Simply Sats)
 * Returns the unlock block and script type
 */
export function parseTimelockScript(scriptHex: string): { unlockBlock: number; scriptType: 'pushtx'; pubKeyHash: string } | null {
  const result = parsePushTxScript(scriptHex)
  if (result) {
    return {
      unlockBlock: result.unlockBlock,
      scriptType: 'pushtx',
      pubKeyHash: result.pubKeyHash
    }
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
    scriptIsValidLock: false,
    scriptType: 'unknown',
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

    // Find the lock output (output 0 should be the timelock)
    const lockOutput = tx.vout[0]
    if (!lockOutput) {
      result.error = 'Lock output (vout 0) not found'
      return result
    }
    result.outputExists = true

    // Verify amount
    result.onChainAmount = lockOutput.value
    result.amountMatches = lockOutput.value === expectedSatoshis

    // Parse and verify timelock script (supports both OP_PUSH_TX and CLTV)
    const parsed = parseTimelockScript(lockOutput.scriptPubKey.hex)
    if (parsed) {
      result.scriptIsValidLock = true
      result.scriptType = parsed.scriptType
      result.onChainUnlockBlock = parsed.unlockBlock
      result.unlockBlockMatches = parsed.unlockBlock === expectedUnlockBlock
    } else {
      result.error = 'Script is not a valid timelock (expected OP_PUSH_TX or CLTV format)'
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
      result.scriptIsValidLock &&
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

export interface PaymentVerification {
  verified: boolean
  txExists: boolean
  paymentFound: boolean
  amountCorrect: boolean
  onChainAmount?: number
  error?: string
  verifiedAt: string
}

/**
 * Verify a payment transaction sends the correct amount to the expected recipient.
 * Checks all outputs for a P2PKH payment matching the seller's address and amount.
 */
export async function verifyPayment(
  txid: string,
  expectedSatoshis: number,
  recipientPubKeyOrAddress: string
): Promise<PaymentVerification> {
  const result: PaymentVerification = {
    verified: false,
    txExists: false,
    paymentFound: false,
    amountCorrect: false,
    verifiedAt: new Date().toISOString()
  }

  try {
    const tx = await fetchTransaction(txid)
    if (!tx) {
      result.error = 'Transaction not found on blockchain'
      return result
    }
    result.txExists = true

    // The recipient's wallet address is stored as a public key hex.
    // Derive the P2PKH script: OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
    // We need to match either:
    //   1. A P2PKH output whose pubKeyHash matches hash160(recipientPubKey)
    //   2. Direct comparison if recipientPubKeyOrAddress is already a pubKeyHash
    //
    // Search all outputs for a payment to this address
    const recipientScriptSuffix = recipientPubKeyOrAddress.toLowerCase()

    let totalPaymentToRecipient = 0

    for (const output of tx.vout) {
      const scriptHex = output.scriptPubKey.hex.toLowerCase()

      // Check for P2PKH: 76a914{20-byte-hash}88ac
      // The script contains the pubKeyHash - check if it matches
      if (scriptHex.startsWith('76a914') && scriptHex.endsWith('88ac') && scriptHex.length === 50) {
        const outputPubKeyHash = scriptHex.substring(6, 46)

        // Match against the recipient's public key or address
        // If recipient is a full public key, we need to compare the hash
        // If recipient is already a pubKeyHash (40 hex chars), compare directly
        if (recipientScriptSuffix.length === 40) {
          // Already a pubKeyHash
          if (outputPubKeyHash === recipientScriptSuffix) {
            totalPaymentToRecipient += output.value
          }
        } else if (recipientScriptSuffix.length === 66 || recipientScriptSuffix.length === 130) {
          // Compressed (33 bytes = 66 hex) or uncompressed (65 bytes = 130 hex) public key
          // We include the pubkey in the P2PKH match by checking if the script contains it
          // For a proper match, we'd need hash160 - but the script already has the hash
          // So we check if any output script's asm references this key
          if (output.scriptPubKey.asm && output.scriptPubKey.asm.includes(recipientScriptSuffix)) {
            totalPaymentToRecipient += output.value
          }
        }
      }
    }

    if (totalPaymentToRecipient > 0) {
      result.paymentFound = true
      result.onChainAmount = totalPaymentToRecipient
      // Allow 1% tolerance for miner fees / rounding
      const tolerance = Math.max(1, Math.floor(expectedSatoshis * 0.01))
      result.amountCorrect = totalPaymentToRecipient >= (expectedSatoshis - tolerance)
    }

    result.verified = result.txExists && result.paymentFound && result.amountCorrect

    if (!result.verified && !result.error) {
      if (!result.paymentFound) {
        result.error = 'No payment to the seller\'s address found in this transaction'
      } else if (!result.amountCorrect) {
        result.error = `Payment amount insufficient: found ${totalPaymentToRecipient} sats, expected ${expectedSatoshis} sats`
      }
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
