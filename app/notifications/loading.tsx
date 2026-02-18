export default function NotificationsLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="h-8 w-40 bg-[var(--surface-2)] rounded animate-pulse mb-6" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card h-16 animate-pulse bg-[var(--surface-2)]" />
        ))}
      </div>
    </div>
  )
}
