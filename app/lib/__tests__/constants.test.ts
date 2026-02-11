import { describe, it, expect } from 'vitest'
import {
  bsvToSats,
  satsToBsv,
  calculateWrootzFromSats,
  calculateCurrentWrootz,
  blocksToTimeString,
  formatSats,
  formatWrootz,
  formatRelativeTime,
  SATS_PER_BSV,
  NORMALIZATION_FACTOR,
  MAX_LOCK_DURATION_BLOCKS,
} from '../constants'

describe('bsvToSats', () => {
  it('converts 1 BSV to 100_000_000 sats', () => {
    expect(bsvToSats(1)).toBe(100_000_000)
  })

  it('converts fractional BSV', () => {
    expect(bsvToSats(0.5)).toBe(50_000_000)
    expect(bsvToSats(0.00000001)).toBe(1)
  })

  it('rounds to nearest satoshi', () => {
    // Note: 0.000000015 * 1e8 = 1.4999... due to float imprecision, so Math.round gives 1
    expect(bsvToSats(0.000000015)).toBe(1) // float imprecision rounds down
    expect(bsvToSats(0.000000014)).toBe(1)
    expect(bsvToSats(0.000000016)).toBe(2) // this one rounds up correctly
  })

  it('handles 0', () => {
    expect(bsvToSats(0)).toBe(0)
  })
})

describe('satsToBsv', () => {
  it('converts 100_000_000 sats to 1 BSV', () => {
    expect(satsToBsv(100_000_000)).toBe(1)
  })

  it('converts 1 sat', () => {
    expect(satsToBsv(1)).toBe(0.00000001)
  })

  it('handles 0', () => {
    expect(satsToBsv(0)).toBe(0)
  })
})

describe('calculateWrootzFromSats', () => {
  it('calculates wrootz correctly', () => {
    // 100_000_000 sats * 52560 blocks / 52560 = 100_000_000
    expect(calculateWrootzFromSats(SATS_PER_BSV, NORMALIZATION_FACTOR)).toBe(SATS_PER_BSV)
  })

  it('returns 0 for 0 sats', () => {
    expect(calculateWrootzFromSats(0, 144)).toBe(0)
  })

  it('returns 0 for 0 blocks', () => {
    expect(calculateWrootzFromSats(10000, 0)).toBe(0)
  })

  it('scales linearly with amount', () => {
    const w1 = calculateWrootzFromSats(1000, 144)
    const w2 = calculateWrootzFromSats(2000, 144)
    expect(w2).toBeCloseTo(w1 * 2)
  })

  it('scales linearly with duration', () => {
    const w1 = calculateWrootzFromSats(1000, 144)
    const w2 = calculateWrootzFromSats(1000, 288)
    expect(w2).toBeCloseTo(w1 * 2)
  })
})

describe('calculateCurrentWrootz', () => {
  it('returns full wrootz when all blocks remain', () => {
    expect(calculateCurrentWrootz(100, 144, 144)).toBe(100)
  })

  it('returns half wrootz at midpoint', () => {
    expect(calculateCurrentWrootz(100, 144, 72)).toBe(50)
  })

  it('returns 0 when expired', () => {
    expect(calculateCurrentWrootz(100, 144, 0)).toBe(0)
  })

  it('returns 0 for negative remaining blocks', () => {
    expect(calculateCurrentWrootz(100, 144, -5)).toBe(0)
  })
})

describe('blocksToTimeString', () => {
  it('returns minutes for small values', () => {
    expect(blocksToTimeString(1)).toBe('10 minutes')
    expect(blocksToTimeString(3)).toBe('30 minutes')
  })

  it('returns hours', () => {
    expect(blocksToTimeString(6)).toBe('1 hour')
    expect(blocksToTimeString(12)).toBe('2 hours')
  })

  it('returns days', () => {
    expect(blocksToTimeString(144)).toBe('1 day')
    expect(blocksToTimeString(288)).toBe('2 days')
  })

  it('returns months', () => {
    expect(blocksToTimeString(4320)).toBe('1 month')
    expect(blocksToTimeString(8640)).toBe('2 months')
  })

  it('handles 0', () => {
    expect(blocksToTimeString(0)).toBe('0 minutes')
  })
})

describe('formatSats', () => {
  it('formats with locale separators', () => {
    // toLocaleString may vary by locale, just check it's a string
    expect(typeof formatSats(1000)).toBe('string')
    expect(formatSats(0)).toBe('0')
  })
})

describe('formatWrootz', () => {
  it('formats small values', () => {
    expect(formatWrootz(5.5)).toBe('5.50')
  })

  it('formats thousands with K suffix', () => {
    expect(formatWrootz(1500)).toBe('1.50K')
  })

  it('formats millions with M suffix', () => {
    expect(formatWrootz(2500000)).toBe('2.50M')
  })
})

describe('constants', () => {
  it('has correct SATS_PER_BSV', () => {
    expect(SATS_PER_BSV).toBe(100_000_000)
  })

  it('has correct NORMALIZATION_FACTOR', () => {
    expect(NORMALIZATION_FACTOR).toBe(52560)
  })

  it('MAX_LOCK_DURATION is 1 year of blocks', () => {
    expect(MAX_LOCK_DURATION_BLOCKS).toBe(52560)
  })
})

describe('formatRelativeTime', () => {
  it('returns "just now" for recent dates', () => {
    expect(formatRelativeTime(new Date())).toBe('just now')
  })

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago')
  })

  it('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago')
  })
})
