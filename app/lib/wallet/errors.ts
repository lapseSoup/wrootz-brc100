/**
 * Wallet Error Types and Utilities
 *
 * Categorized errors for better UX and debugging.
 * Each error type has a user-friendly message and actionable suggestion.
 */

/**
 * Base wallet error class
 */
export class WalletError extends Error {
  constructor(
    message: string,
    public readonly action?: string,
    public readonly recoverable: boolean = true
  ) {
    super(message)
    this.name = 'WalletError'
  }
}

/**
 * Wallet is not running or not reachable
 */
export class WalletConnectionError extends WalletError {
  constructor(message = 'Unable to connect to wallet') {
    super(
      message,
      'Make sure Simply Sats is running on your computer',
      true
    )
    this.name = 'WalletConnectionError'
  }
}

/**
 * Session token is invalid or expired
 */
export class WalletAuthError extends WalletError {
  constructor(message = 'Wallet session expired') {
    super(
      message,
      'Please reconnect your wallet',
      true
    )
    this.name = 'WalletAuthError'
  }
}

/**
 * Not enough balance for the operation
 */
export class InsufficientFundsError extends WalletError {
  constructor(required?: number, available?: number) {
    const message = required && available
      ? `Insufficient funds: need ${required.toLocaleString()} sats, have ${available.toLocaleString()} sats`
      : 'Insufficient funds for this operation'
    super(
      message,
      'Add more BSV to your wallet or reduce the amount',
      false
    )
    this.name = 'InsufficientFundsError'
  }
}

/**
 * User rejected the transaction in wallet
 */
export class TransactionRejectedError extends WalletError {
  constructor(message = 'Transaction was rejected') {
    super(
      message,
      'Try again and approve the transaction in your wallet',
      true
    )
    this.name = 'TransactionRejectedError'
  }
}

/**
 * Transaction failed to broadcast
 */
export class BroadcastError extends WalletError {
  constructor(message = 'Failed to broadcast transaction') {
    super(
      message,
      'Check your internet connection and try again',
      true
    )
    this.name = 'BroadcastError'
  }
}

/**
 * Network or API error
 */
export class NetworkError extends WalletError {
  constructor(message = 'Network error occurred') {
    super(
      message,
      'Check your internet connection and try again',
      true
    )
    this.name = 'NetworkError'
  }
}

/**
 * Request timed out
 */
export class TimeoutError extends WalletError {
  constructor(message = 'Request timed out') {
    super(
      message,
      'The wallet is taking too long to respond. Try again.',
      true
    )
    this.name = 'TimeoutError'
  }
}

/**
 * Unknown or unrecoverable error
 */
export class UnknownWalletError extends WalletError {
  constructor(originalError?: unknown) {
    const message = originalError instanceof Error
      ? originalError.message
      : 'An unexpected error occurred'
    super(
      message,
      'Please try again. If the problem persists, restart Simply Sats.',
      true
    )
    this.name = 'UnknownWalletError'
  }
}

/**
 * Parse error response from wallet API
 */
export function parseWalletError(error: unknown): WalletError {
  // Already a wallet error
  if (error instanceof WalletError) {
    return error
  }

  // Parse error message
  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()

  // Connection errors
  if (
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('connection refused') ||
    lowerMessage.includes('network error') ||
    lowerMessage.includes('failed to fetch')
  ) {
    return new WalletConnectionError()
  }

  // Auth errors
  if (
    lowerMessage.includes('401') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('session') ||
    lowerMessage.includes('token')
  ) {
    return new WalletAuthError()
  }

  // Insufficient funds
  if (
    lowerMessage.includes('insufficient') ||
    lowerMessage.includes('not enough') ||
    lowerMessage.includes('balance')
  ) {
    return new InsufficientFundsError()
  }

  // User rejected
  if (
    lowerMessage.includes('rejected') ||
    lowerMessage.includes('cancelled') ||
    lowerMessage.includes('canceled') ||
    lowerMessage.includes('denied')
  ) {
    return new TransactionRejectedError()
  }

  // Broadcast errors
  if (
    lowerMessage.includes('broadcast') ||
    lowerMessage.includes('mempool') ||
    lowerMessage.includes('invalid transaction')
  ) {
    return new BroadcastError()
  }

  // Timeout
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out')
  ) {
    return new TimeoutError()
  }

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch')
  ) {
    return new NetworkError()
  }

  // Unknown error
  return new UnknownWalletError(error)
}

/**
 * Get a user-friendly error message and action suggestion
 */
export function getErrorDetails(error: unknown): {
  message: string
  action?: string
  recoverable: boolean
} {
  const walletError = parseWalletError(error)
  return {
    message: walletError.message,
    action: walletError.action,
    recoverable: walletError.recoverable
  }
}
