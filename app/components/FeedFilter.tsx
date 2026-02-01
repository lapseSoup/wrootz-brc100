'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type FilterType = 'all' | 'following' | 'rising' | 'for-sale' | 'discover'

export default function FeedFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentFilter = (searchParams.get('filter') as FilterType) || 'all'
  const search = searchParams.get('search')
  const archive = searchParams.get('archive') === 'true'
  const showHidden = searchParams.get('hidden') === 'true'

  const setFilter = (filter: FilterType) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filter !== 'all') params.set('filter', filter)
    if (archive) params.set('archive', 'true')
    if (showHidden) params.set('hidden', 'true')

    const queryString = params.toString()
    router.push(queryString ? `/?${queryString}` : '/')
  }

  const toggleArchive = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (currentFilter !== 'all') params.set('filter', currentFilter)
    if (!archive) params.set('archive', 'true')
    // Don't include hidden when toggling archive on

    const queryString = params.toString()
    router.push(queryString ? `/?${queryString}` : '/')
  }

  const toggleHidden = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (currentFilter !== 'all') params.set('filter', currentFilter)
    // Don't include archive when toggling hidden
    if (!showHidden) params.set('hidden', 'true')

    const queryString = params.toString()
    router.push(queryString ? `/?${queryString}` : '/')
  }

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'following', label: 'Following' },
    { value: 'rising', label: 'Rising' },
    { value: 'for-sale', label: 'For Sale' },
    { value: 'discover', label: 'Discover' },
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="flex flex-1 p-1 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setFilter(filter.value)}
            className={`
              flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${currentFilter === filter.value
                ? 'bg-[var(--surface-1)] text-[var(--foreground)] shadow-elevation-1'
                : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
              }
            `}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {/* Hidden Toggle */}
        <button
          onClick={toggleHidden}
          className={`
            flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200
            ${showHidden
              ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
              : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
            }
          `}
          title={showHidden ? 'Showing hidden posts' : 'Show hidden posts'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {showHidden ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            )}
          </svg>
          <span className="hidden sm:inline">Hidden</span>
        </button>

        {/* Archive Toggle */}
        <button
          onClick={toggleArchive}
          className={`
            flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200
            ${archive
              ? 'bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--primary)]'
              : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
            }
          `}
          title={archive ? 'Showing archived content' : 'Show archived content'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span className="hidden sm:inline">Archive</span>
        </button>
      </div>
    </div>
  )
}
