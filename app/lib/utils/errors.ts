/**
 * Error handling utilities
 *
 * Provides type-safe error message extraction from unknown error types,
 * following TypeScript best practices for catch blocks.
 */

/**
 * Extract a human-readable error message from an unknown error type.
 * Use this in catch blocks instead of assuming error structure.
 *
 * @example
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   console.error('Operation failed:', getErrorMessage(error))
 * }
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Unknown error occurred'
}

/**
 * Check if an error is an instance of a specific error type.
 * Useful for conditional error handling.
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error
}

/**
 * Create a standardized error response object for API handlers.
 */
export function createErrorResponse(message: string, code = 'ERROR') {
  return {
    error: true,
    code,
    message
  }
}

/**
 * Log an error with context and return a user-friendly message.
 * Use for errors that should be logged but shown differently to users.
 */
export function logAndGetMessage(
  error: unknown,
  context: string,
  userMessage = 'An unexpected error occurred'
): string {
  const errorMessage = getErrorMessage(error)
  console.error(`[${context}] ${errorMessage}`, error)
  return userMessage
}
