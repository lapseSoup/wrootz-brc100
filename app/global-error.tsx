'use client'

export default function GlobalError({
  error: _error, // Required by Next.js but not displayed to users
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Note: error is required by Next.js error boundary convention but we don't display it
  void _error
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#0c0f14',
          color: '#e2e8f0'
        }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
              An unexpected error occurred.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
