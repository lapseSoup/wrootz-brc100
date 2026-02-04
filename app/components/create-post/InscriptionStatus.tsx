'use client'

interface InscriptionStatusProps {
  status: string | null
}

export default function InscriptionStatus({ status }: InscriptionStatusProps) {
  if (!status) return null

  return (
    <div
      className="p-4 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div
          className="animate-spin h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium text-[var(--primary)]">Inscribing to BSV Blockchain</p>
          <p className="text-sm text-[var(--muted)]">{status}</p>
        </div>
      </div>
    </div>
  )
}

export { InscriptionStatus }
