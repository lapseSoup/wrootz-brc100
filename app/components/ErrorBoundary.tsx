'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="p-4 rounded-lg bg-[var(--danger-light)] border border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)] font-medium">
            Something went wrong loading this section.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-2 text-xs text-[var(--danger)] underline"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
