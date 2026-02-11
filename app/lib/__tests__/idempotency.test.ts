import { describe, it, expect } from 'vitest'
import { generateIdempotencyKey } from '../idempotency'

describe('generateIdempotencyKey', () => {
  it('joins parts with colons', () => {
    expect(generateIdempotencyKey('buyPost', 'post123')).toBe('buyPost:post123')
  })

  it('handles multiple parts', () => {
    expect(generateIdempotencyKey('action', 'user1', 'post2')).toBe('action:user1:post2')
  })

  it('filters out undefined parts', () => {
    expect(generateIdempotencyKey('action', undefined, 'post2')).toBe('action:post2')
  })

  it('handles numeric parts', () => {
    expect(generateIdempotencyKey('lock', 12345)).toBe('lock:12345')
  })

  it('handles single part', () => {
    expect(generateIdempotencyKey('single')).toBe('single')
  })
})
