export default function PostLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Main content skeleton */}
        <div className="md:col-span-2 space-y-5">
          {/* Article card skeleton */}
          <div className="card">
            {/* Title and wrootz */}
            <div className="flex items-start justify-between gap-4">
              <div className="h-8 bg-[var(--surface-2)] rounded animate-pulse w-3/4" />
              <div className="w-20 h-8 bg-[var(--accent-light)] rounded animate-pulse" />
            </div>

            {/* Image placeholder */}
            <div className="mt-5 -mx-5 h-64 bg-[var(--surface-2)] animate-pulse" />

            {/* Body text */}
            <div className="mt-5 space-y-2">
              <div className="h-4 bg-[var(--surface-2)] rounded animate-pulse w-full" />
              <div className="h-4 bg-[var(--surface-2)] rounded animate-pulse w-full" />
              <div className="h-4 bg-[var(--surface-2)] rounded animate-pulse w-3/4" />
            </div>

            {/* Meta footer */}
            <div className="mt-6 pt-5 border-t border-[var(--border)] flex gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] animate-pulse" />
                <div className="space-y-1">
                  <div className="h-3 bg-[var(--surface-2)] rounded animate-pulse w-12" />
                  <div className="h-4 bg-[var(--surface-2)] rounded animate-pulse w-20" />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="card">
            <div className="flex gap-4 border-b border-[var(--border)] pb-3 mb-4">
              <div className="h-6 bg-[var(--surface-2)] rounded animate-pulse w-16" />
              <div className="h-6 bg-[var(--surface-2)] rounded animate-pulse w-16" />
              <div className="h-6 bg-[var(--surface-2)] rounded animate-pulse w-16" />
            </div>
            <div className="space-y-3">
              <div className="h-16 bg-[var(--surface-2)] rounded animate-pulse" />
              <div className="h-16 bg-[var(--surface-2)] rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Sidebar skeleton */}
        <div className="space-y-4">
          <div className="card h-48 animate-pulse bg-[var(--surface-2)]" />
          <div className="card h-32 animate-pulse bg-[var(--surface-2)]" />
        </div>
      </div>
    </div>
  )
}
