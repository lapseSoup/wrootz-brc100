export default function Loading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
      {/* Main content skeleton */}
      <div className="space-y-4">
        {/* Filter skeleton */}
        <div className="h-10 bg-[var(--surface-2)] rounded-lg animate-pulse" />

        {/* Search skeleton */}
        <div className="h-10 bg-[var(--surface-2)] rounded-lg animate-pulse" />

        {/* Post cards skeleton */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card">
            <div className="flex gap-3">
              {/* Wrootz badge skeleton */}
              <div className="w-[70px] h-[52px] rounded-lg bg-[var(--surface-2)] animate-pulse" />

              {/* Content skeleton */}
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-[var(--surface-2)] rounded animate-pulse w-3/4" />
                <div className="h-4 bg-[var(--surface-2)] rounded animate-pulse w-full" />
                <div className="h-4 bg-[var(--surface-2)] rounded animate-pulse w-2/3" />
                <div className="flex gap-2 mt-2">
                  <div className="h-3 bg-[var(--surface-2)] rounded animate-pulse w-16" />
                  <div className="h-3 bg-[var(--surface-2)] rounded animate-pulse w-12" />
                </div>
              </div>

              {/* Image skeleton */}
              <div className="w-24 h-24 rounded-lg bg-[var(--surface-2)] animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar skeleton */}
      <aside className="hidden md:block space-y-5">
        <div className="card h-48 animate-pulse bg-[var(--surface-2)]" />
        <div className="card h-32 animate-pulse bg-[var(--surface-2)]" />
        <div className="card h-32 animate-pulse bg-[var(--surface-2)]" />
      </aside>
    </div>
  )
}
