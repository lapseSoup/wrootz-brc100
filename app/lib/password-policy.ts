/**
 * Password validation policy for user registration
 *
 * Requirements:
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - Not a common password
 * - Minimum character diversity
 */

// Common passwords that should be rejected
const COMMON_PASSWORDS = new Set([
  'password', '12345678', 'qwertyui', 'qwerty12', '11111111', 'bitcoin',
  'satoshi', 'password1', 'wrootz123', 'blockchain', 'abcdefgh', 'letmein',
  'welcome1', 'admin123', 'iloveyou', 'sunshine', 'princess', 'football',
  'baseball', 'trustno1', 'superman', 'michael1', 'shadow12', 'master12',
  'jennifer', 'michelle', 'whatever', 'qazwsxed', 'asdfghjk', 'zxcvbnm1',
  '1q2w3e4r', 'passw0rd', 'p@ssword', 'p@ssw0rd', 'changeme', 'dragon12'
])

export interface PasswordValidation {
  valid: boolean
  error?: string
}

/**
 * Validate a password against security requirements
 */
export function validatePassword(password: string): PasswordValidation {
  // Check minimum length
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' }
  }

  // Check maximum length (prevent DoS via bcrypt)
  if (password.length > 128) {
    return { valid: false, error: 'Password too long (max 128 characters)' }
  }

  // Check against common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common, please choose a stronger password' }
  }

  // Check for minimum character diversity (at least 4 unique characters)
  const uniqueChars = new Set(password.split('')).size
  if (uniqueChars < 4) {
    return { valid: false, error: 'Password needs more character variety' }
  }

  // Check for obvious patterns
  const lowerPassword = password.toLowerCase()
  if (/^(.)\1+$/.test(password)) {
    // All same character like "aaaaaaaa"
    return { valid: false, error: 'Password cannot be all the same character' }
  }

  if (/^(012|123|234|345|456|567|678|789|890)+/.test(password) ||
      /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+/i.test(lowerPassword)) {
    return { valid: false, error: 'Password cannot be a simple sequence' }
  }

  return { valid: true }
}

/**
 * Get password strength score (0-4)
 * 0 = weak, 4 = very strong
 */
export function getPasswordStrength(password: string): number {
  let score = 0

  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  return Math.min(4, score)
}
