'use client'

import { useEffect } from 'react'

export default function NotificationsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
      <p className="text-[var(--muted)] mb-4">Could not load notifications.</p>
      <button onClick={reset} className="btn btn-primary">Try again</button>
    </div>
  )
}
