// Simulation constants
export const BLOCKS_PER_HOUR = 6
export const BLOCKS_PER_DAY = 144
export const BLOCK_INTERVAL_SECONDS = 600 // 10 minute blocks (like real Bitcoin)
export const NORMALIZATION_FACTOR = 52560 // 365 days * BLOCKS_PER_DAY blocks/day (Bitcoin standard)
export const MAX_POST_LENGTH = 5000 // Character limit for posts
export const SATS_PER_BSV = 100_000_000
export const MAX_LOCK_DURATION_BLOCKS = 52560 // 1 year max (365 days * 144 blocks/day)
export const DEFAULT_LOCK_AMOUNT_SATS = 10000 // Default lock amount in sats

// Griefing protection: minimum lock amount to prevent spam locks
// Set to 1000 sats (0.00001 BSV) as a reasonable minimum
export const MIN_LOCK_AMOUNT_SATS = 1000

// Maximum lock amount to prevent integer overflow in TU calculation
// 100 BSV = 10,000,000,000 sats. MAX_SAFE_INTEGER / MAX_LOCK_DURATION_BLOCKS ≈ 171B sats,
// so 10B sats gives comfortable headroom.
export const MAX_LOCK_AMOUNT_SATS = 10_000_000_000 // 100 BSV

// For posts listed for sale, minimum lock must be at least this percentage
// of the sale price to prevent "griefing" by locking 1 sat for long periods
// to freeze the sale. Set to 0.1% (0.001) of sale price
export const MIN_LOCK_PERCENTAGE_FOR_SALE = 0.001

// Unit types
export type DisplayUnit = 'sats' | 'bsv'

// Convert between units
export function bsvToSats(bsv: number): number {
  return Math.round(bsv * SATS_PER_BSV)
}

/**
 * M4: WARNING - Returns imprecise floats. Use ONLY for display purposes.
 * For calculations, always use satoshis (integers) as the canonical unit.
 */
export function satsToBsv(sats: number): number {
  return sats / SATS_PER_BSV
}

/**
 * @deprecated Use calculateWrootzFromSats() instead to avoid float imprecision.
 * wrootz calculation: wrootz = (amount_in_satoshis × duration_blocks) / NORMALIZATION_FACTOR
 */
export function calculateWrootz(amountBSV: number, durationBlocks: number): number {
  const amountInSatoshis = amountBSV * SATS_PER_BSV
  return (amountInSatoshis * durationBlocks) / NORMALIZATION_FACTOR
}

// Calculate wrootz from sats directly
export function calculateWrootzFromSats(amountSats: number, durationBlocks: number): number {
  return (amountSats * durationBlocks) / NORMALIZATION_FACTOR
}

// Calculate current wrootz based on remaining blocks
export function calculateCurrentWrootz(initialWrootz: number, durationBlocks: number, remainingBlocks: number): number {
  if (durationBlocks <= 0) return 0
  if (remainingBlocks <= 0) return 0
  return initialWrootz * (remainingBlocks / durationBlocks)
}

// Lock duration presets (in blocks, where 1 block = 10 minutes like Bitcoin)
// 6 blocks = 1 hour, 144 blocks = 1 day, 1008 blocks = 1 week, 4320 blocks = 1 month
export const LOCK_DURATION_PRESETS = [
  { label: '1 hour', blocks: 6, description: '6 blocks' },
  { label: '6 hours', blocks: 36, description: '36 blocks' },
  { label: '12 hours', blocks: 72, description: '72 blocks' },
  { label: '1 day', blocks: 144, description: '144 blocks', default: true },
  { label: '1 week', blocks: 1008, description: '1,008 blocks' },
  { label: '1 month', blocks: 4320, description: '4,320 blocks' },
]

// Convert blocks to human-readable time (1 block = 10 minutes)
export function blocksToTimeString(blocks: number): string {
  if (blocks <= 0) return '0 minutes'

  const minutes = blocks * 10 // 1 block = 10 minutes
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)

  // Show months if >= 1 month
  if (months >= 1) {
    return `${months} month${months !== 1 ? 's' : ''}`
  }
  // Show days if >= 1 day
  if (days >= 1) {
    return `${days} day${days !== 1 ? 's' : ''}`
  }
  // Show hours if >= 1 hour
  if (hours >= 1) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  }
  // Show minutes
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`
}

// Format amount based on display unit preference
export function formatAmount(amountBSV: number, unit: DisplayUnit = 'sats'): string {
  if (unit === 'sats') {
    return formatSats(bsvToSats(amountBSV))
  }
  return formatBSV(amountBSV)
}

// Format sats amount with commas
export function formatSats(sats: number): string {
  return sats.toLocaleString()
}

// Format BSV amount (legacy, still used internally)
export function formatBSV(amount: number): string {
  if (amount >= 0.01) return amount.toFixed(2)
  if (amount >= 0.0001) return amount.toFixed(4)
  return amount.toFixed(8)
}

// Get unit label
export function getUnitLabel(unit: DisplayUnit): string {
  return unit === 'sats' ? 'sats' : 'BSV'
}

// Format wrootz
export function formatWrootz(wrootz: number): string {
  if (wrootz >= 1000000) return `${(wrootz / 1000000).toFixed(2)}M`
  if (wrootz >= 1000) return `${(wrootz / 1000).toFixed(2)}K`
  return wrootz.toFixed(2)
}

// Format relative time (e.g., "2h ago", "3d ago")
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 4) return `${diffWeeks}w ago`
  if (diffMonths < 12) return `${diffMonths}mo ago`
  return `${diffYears}y ago`
}
