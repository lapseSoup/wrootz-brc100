export default function ProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="card mb-6">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-[var(--surface-2)] animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-40 bg-[var(--surface-2)] rounded animate-pulse" />
            <div className="h-4 w-64 bg-[var(--surface-2)] rounded animate-pulse" />
            <div className="h-4 w-32 bg-[var(--surface-2)] rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card h-32 animate-pulse bg-[var(--surface-2)]" />
        ))}
      </div>
    </div>
  )
}
