export default function CreateLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="h-8 w-48 bg-[var(--surface-2)] rounded animate-pulse mb-6" />
      <div className="card space-y-4">
        <div className="h-10 bg-[var(--surface-2)] rounded animate-pulse" />
        <div className="h-40 bg-[var(--surface-2)] rounded animate-pulse" />
        <div className="h-10 w-32 bg-[var(--surface-2)] rounded animate-pulse" />
      </div>
    </div>
  )
}
