/**
 * Structured logging utility
 *
 * Provides consistent log formatting with context prefixes.
 * Use for new code; existing console.log calls can be migrated incrementally.
 */

type LogContext = string

function formatMessage(level: string, context: LogContext, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString()
  const base = `[${timestamp}] [${level}] [${context}] ${message}`
  if (data !== undefined) {
    return `${base} ${JSON.stringify(data)}`
  }
  return base
}

export function info(context: LogContext, message: string, data?: unknown): void {
  console.log(formatMessage('INFO', context, message, data))
}

export function warn(context: LogContext, message: string, data?: unknown): void {
  console.warn(formatMessage('WARN', context, message, data))
}

export function error(context: LogContext, message: string, data?: unknown): void {
  console.error(formatMessage('ERROR', context, message, data))
}
