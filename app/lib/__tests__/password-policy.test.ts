import { describe, it, expect } from 'vitest'
import { validatePassword, getPasswordStrength } from '../password-policy'

describe('validatePassword', () => {
  it('rejects empty password', () => {
    expect(validatePassword('')).toEqual({
      valid: false,
      error: 'Password must be at least 12 characters',
    })
  })

  it('rejects short password', () => {
    expect(validatePassword('abc1234')).toEqual({
      valid: false,
      error: 'Password must be at least 12 characters',
    })
  })

  it('rejects password over 128 characters', () => {
    const long = 'a'.repeat(129)
    const result = validatePassword(long)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('too long')
  })

  it('accepts password of exactly 128 characters', () => {
    // Needs 4+ unique chars and not a pattern — 'Abcd1234' prefix has plenty
    const password = 'Ab1!' + 'x'.repeat(124)
    expect(validatePassword(password).valid).toBe(true)
  })

  it('rejects common passwords', () => {
    expect(validatePassword('password').valid).toBe(false)
    expect(validatePassword('12345678').valid).toBe(false)
    expect(validatePassword('qwertyui').valid).toBe(false)
    expect(validatePassword('bitcoin').valid).toBe(false)
  })

  it('rejects common passwords that meet length requirement', () => {
    // These are 12+ chars so they pass the length check but should fail the common password check
    const result1 = validatePassword('password1234')
    expect(result1.valid).toBe(false)
    expect(result1.error).toContain('too common')

    const result2 = validatePassword('shadow123456')
    expect(result2.valid).toBe(false)
    expect(result2.error).toContain('too common')
  })

  it('rejects common passwords case-insensitively', () => {
    expect(validatePassword('PASSWORD').valid).toBe(false)
    expect(validatePassword('Password').valid).toBe(false)
  })

  it('rejects low character diversity', () => {
    expect(validatePassword('aabbccddeeff').valid).toBe(true) // 6 unique chars, 12 len = OK
    expect(validatePassword('aaabbbaaabbb').valid).toBe(false) // 2 unique chars = rejected
  })

  it('rejects all-same-character passwords', () => {
    expect(validatePassword('aaaaaaaa').valid).toBe(false)
  })

  it('rejects sequential patterns', () => {
    expect(validatePassword('12345678').valid).toBe(false)
    expect(validatePassword('abcdefgh').valid).toBe(false)
  })

  it('accepts valid passwords', () => {
    expect(validatePassword('MyStr0ng!Pass').valid).toBe(true)
    expect(validatePassword('correct-horse-battery').valid).toBe(true)
    expect(validatePassword('j9Kx#mP2longr').valid).toBe(true)
  })
})

describe('getPasswordStrength', () => {
  it('returns 0 for very short password', () => {
    expect(getPasswordStrength('abc')).toBe(0)
  })

  it('returns higher score for longer passwords', () => {
    const short = getPasswordStrength('abcdefgh')
    const long = getPasswordStrength('abcdefghijkl')
    expect(long).toBeGreaterThan(short)
  })

  it('rewards mixed case', () => {
    const lower = getPasswordStrength('abcdefgh')
    const mixed = getPasswordStrength('Abcdefgh')
    expect(mixed).toBeGreaterThan(lower)
  })

  it('rewards numbers', () => {
    const noNum = getPasswordStrength('Abcdefgh')
    const withNum = getPasswordStrength('Abcdefg1')
    expect(withNum).toBeGreaterThan(noNum)
  })

  it('rewards special characters', () => {
    const noSpecial = getPasswordStrength('Abcdefg1')
    const withSpecial = getPasswordStrength('Abcdefg1!')
    expect(withSpecial).toBeGreaterThan(noSpecial)
  })

  it('caps at 4', () => {
    expect(getPasswordStrength('Super$tr0ng!Password123')).toBe(4)
  })
})
