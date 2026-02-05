import type { Lock, WrootzDataPoint } from '@/app/lib/types'

/**
 * Calculate wrootz value at a specific block for a single lock.
 * Wrootz decays linearly: currentTu = initialTu * (remainingBlocks / durationBlocks)
 */
export function calculateWrootzAtBlock(lock: Lock, block: number): number {
  if (block < lock.startBlock) {
    return 0 // Lock hasn't started yet
  }

  const blocksElapsed = block - lock.startBlock
  const blocksRemaining = Math.max(0, lock.durationBlocks - blocksElapsed)

  if (blocksRemaining <= 0) {
    return 0 // Lock has expired
  }

  return lock.initialTu * (blocksRemaining / lock.durationBlocks)
}

/**
 * Calculate historical wrootz data points for graphing.
 *
 * @param locks - All locks (active and expired) to include in calculation
 * @param activeLocks - Currently active locks (for accurate current value)
 * @param currentBlock - The current blockchain block height
 * @param maxSamplePoints - Maximum number of data points to generate (default: 50)
 * @returns Array of { block, wrootz } data points
 */
export function calculateWrootzHistory(
  locks: Lock[],
  activeLocks: Lock[],
  currentBlock: number,
  maxSamplePoints: number = 50
): WrootzDataPoint[] {
  if (locks.length === 0) return []

  // Find the earliest start block
  const earliestBlock = Math.min(...locks.map(l => l.startBlock))
  const dataPoints: WrootzDataPoint[] = []

  // Calculate sample interval based on block range
  const blockRange = currentBlock - earliestBlock
  const sampleInterval = Math.max(1, Math.floor(blockRange / maxSamplePoints))

  // Generate data points at regular intervals
  for (let block = earliestBlock; block <= currentBlock; block += sampleInterval) {
    let totalWrootz = 0

    for (const lock of locks) {
      totalWrootz += calculateWrootzAtBlock(lock, block)
    }

    dataPoints.push({ block, wrootz: totalWrootz })
  }

  // Always include current block with accurate value from active locks
  if (dataPoints.length === 0 || dataPoints[dataPoints.length - 1].block !== currentBlock) {
    const currentWrootz = activeLocks.reduce((sum, l) => sum + l.currentTu, 0)
    dataPoints.push({ block: currentBlock, wrootz: currentWrootz })
  }

  return dataPoints
}

/**
 * Generate SVG path data for an area chart.
 *
 * @param dataPoints - Array of { block, wrootz } data points
 * @param minBlock - Minimum block for x-axis
 * @param maxBlock - Maximum block for x-axis
 * @param maxWrootz - Maximum wrootz for y-axis
 * @param width - SVG viewBox width (default: 100)
 * @param height - SVG viewBox height (default: 100)
 * @returns SVG path string for area fill
 */
export function generateAreaPath(
  dataPoints: WrootzDataPoint[],
  minBlock: number,
  maxBlock: number,
  maxWrootz: number,
  width: number = 100,
  height: number = 100
): string {
  if (dataPoints.length < 2) return ''

  const blockRange = maxBlock - minBlock || 1

  const points = dataPoints.map((d) => {
    const x = ((d.block - minBlock) / blockRange) * width
    const y = height - (d.wrootz / maxWrootz) * height
    return `${x},${y}`
  })

  // Create area path (line + close to bottom)
  const linePath = points.join(' L ')
  const lastX = ((dataPoints[dataPoints.length - 1].block - minBlock) / blockRange) * width

  return `M 0,${height} L ${linePath} L ${lastX},${height} Z`
}

/**
 * Generate SVG path data for a line chart (top edge only).
 *
 * @param dataPoints - Array of { block, wrootz } data points
 * @param minBlock - Minimum block for x-axis
 * @param maxBlock - Maximum block for x-axis
 * @param maxWrootz - Maximum wrootz for y-axis
 * @param width - SVG viewBox width (default: 100)
 * @param height - SVG viewBox height (default: 100)
 * @returns SVG path string for line
 */
export function generateLinePath(
  dataPoints: WrootzDataPoint[],
  minBlock: number,
  maxBlock: number,
  maxWrootz: number,
  width: number = 100,
  height: number = 100
): string {
  if (dataPoints.length < 2) return ''

  const blockRange = maxBlock - minBlock || 1

  const points = dataPoints.map((d) => {
    const x = ((d.block - minBlock) / blockRange) * width
    const y = height - (d.wrootz / maxWrootz) * height
    return `${x},${y}`
  })

  return `M ${points.join(' L ')}`
}

/**
 * Calculate aggregate tag wrootz from locks.
 *
 * @param locks - Locks to aggregate
 * @param useInitialTu - Use initialTu instead of currentTu (for expired locks)
 * @returns Record of tag -> total wrootz
 */
export function aggregateTagWrootz(
  locks: Lock[],
  useInitialTu: boolean = false
): Record<string, number> {
  const tagWrootz: Record<string, number> = {}

  for (const lock of locks) {
    if (lock.tag) {
      const value = useInitialTu ? lock.initialTu : lock.currentTu
      tagWrootz[lock.tag] = (tagWrootz[lock.tag] || 0) + value
    }
  }

  return tagWrootz
}

/**
 * Get sorted tags by wrootz value.
 *
 * @param locks - Locks to aggregate
 * @param useInitialTu - Use initialTu instead of currentTu (for expired locks)
 * @returns Array of [tag, wrootz] tuples sorted by wrootz descending
 */
export function getSortedTags(
  locks: Lock[],
  useInitialTu: boolean = false
): [string, number][] {
  const tagWrootz = aggregateTagWrootz(locks, useInitialTu)
  return Object.entries(tagWrootz).sort((a, b) => b[1] - a[1])
}
