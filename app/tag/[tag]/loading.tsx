export default function TagLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="card mb-6">
        <div className="h-8 w-48 bg-[var(--surface-2)] rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-[var(--surface-2)] rounded animate-pulse" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card h-24 animate-pulse bg-[var(--surface-2)]" />
        ))}
      </div>
    </div>
  )
}
