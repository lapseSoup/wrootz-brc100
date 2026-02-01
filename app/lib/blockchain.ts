// BSV Blockchain API utilities
// Uses WhatsOnChain API for block data

const WOC_API = 'https://api.whatsonchain.com/v1/bsv/main'

interface BlockInfo {
  height: number
  hash: string
  time: number
}

/**
 * Get current BSV blockchain height
 */
export async function getCurrentBlockHeight(): Promise<number> {
  try {
    const response = await fetch(`${WOC_API}/chain/info`, {
      next: { revalidate: 60 } // Cache for 60 seconds
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch chain info: ${response.status}`)
    }

    const data = await response.json()
    return data.blocks
  } catch (error) {
    console.error('Failed to get block height:', error)
    throw error
  }
}

/**
 * Get block info by height
 */
export async function getBlockByHeight(height: number): Promise<BlockInfo> {
  try {
    const response = await fetch(`${WOC_API}/block/height/${height}`, {
      next: { revalidate: 3600 } // Cache for 1 hour (blocks don't change)
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch block: ${response.status}`)
    }

    const data = await response.json()
    return {
      height: data.height,
      hash: data.hash,
      time: data.time
    }
  } catch (error) {
    console.error('Failed to get block:', error)
    throw error
  }
}

/**
 * Get transaction details
 */
export async function getTransaction(txid: string): Promise<{
  txid: string
  confirmed: boolean
  blockHeight?: number
  blockTime?: number
}> {
  try {
    const response = await fetch(`${WOC_API}/tx/${txid}`, {
      next: { revalidate: 30 } // Cache for 30 seconds
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.status}`)
    }

    const data = await response.json()

    return {
      txid: data.txid,
      confirmed: data.confirmations > 0,
      blockHeight: data.blockheight,
      blockTime: data.blocktime
    }
  } catch (error) {
    console.error('Failed to get transaction:', error)
    throw error
  }
}

/**
 * Get address balance
 */
export async function getAddressBalance(address: string): Promise<{
  confirmed: number
  unconfirmed: number
}> {
  try {
    const response = await fetch(`${WOC_API}/address/${address}/balance`, {
      next: { revalidate: 30 }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.status}`)
    }

    const data = await response.json()

    return {
      confirmed: data.confirmed,
      unconfirmed: data.unconfirmed
    }
  } catch (error) {
    console.error('Failed to get balance:', error)
    throw error
  }
}

/**
 * Calculate estimated time until block
 */
export function estimateTimeToBlock(currentBlock: number, targetBlock: number): {
  blocks: number
  minutes: number
  hours: number
  days: number
} {
  const blocksRemaining = Math.max(0, targetBlock - currentBlock)
  const minutes = blocksRemaining * 10 // ~10 minutes per block
  const hours = minutes / 60
  const days = hours / 24

  return {
    blocks: blocksRemaining,
    minutes,
    hours,
    days
  }
}

/**
 * Format block duration for display
 */
export function formatBlockDuration(blocks: number): string {
  const minutes = blocks * 10
  const hours = minutes / 60
  const days = hours / 24

  if (days >= 1) {
    return `${days.toFixed(1)} days`
  } else if (hours >= 1) {
    return `${hours.toFixed(1)} hours`
  } else {
    return `${minutes} minutes`
  }
}
