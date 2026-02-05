import { Suspense } from 'react'
import { getPostsWithTU } from './actions/posts'
import { getRelatedTags, getPostsByTag } from './actions/tags'
import Sidebar from './components/Sidebar'
import FeedFilter from './components/FeedFilter'
import SearchBar from './components/SearchBar'
import RelatedTags from './components/RelatedTags'
import FeedClient from './components/FeedClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type FilterType = 'all' | 'following' | 'rising' | 'for-sale' | 'discover'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; filter?: string; archive?: string; hidden?: string }>
}) {
  const params = await searchParams
  const search = params?.search
  const filter = (params?.filter as FilterType) || 'all'
  const archive = params?.archive === 'true'
  const showHidden = params?.hidden === 'true'

  // Parse search for tags - supports multiple tags separated by + or spaces
  // e.g., "#bitcoin + #lightning" or "bitcoin lightning" or "#bitcoin #lightning"
  let searchTags: string[] = []
  if (search) {
    // Extract tags from search string - handle #tag format and plain words
    const tagMatches = search.match(/#?[a-zA-Z0-9_-]+/g) || []
    searchTags = tagMatches.map(t => t.replace(/^#/, '')).filter(t => t.length > 0)
  }

  // Use tag-specific ranking for tag searches, otherwise use regular ranking
  let posts
  if (searchTags.length > 0 && filter === 'all' && !archive && !showHidden) {
    // For tag searches, rank by tag-specific wrootz (combined for multiple tags)
    posts = await getPostsByTag(searchTags)
  } else {
    const result = await getPostsWithTU({ search, filter, archive, showHidden })
    posts = result.posts
  }

  const relatedTags = searchTags.length > 0 ? await getRelatedTags(searchTags) : []

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
      {/* Main content */}
      <div className="space-y-4">
        {/* Filter and Search */}
        <div className="flex flex-col gap-3">
          <Suspense fallback={<div className="h-10 bg-[var(--card)] rounded-lg border border-[var(--border)] animate-pulse" />}>
            <FeedFilter />
          </Suspense>
          <div className="flex gap-4 items-center">
            <Suspense fallback={<div className="flex-1 h-10 bg-[var(--card)] rounded-lg border border-[var(--border)] animate-pulse" />}>
              <SearchBar />
            </Suspense>
            {search && (
              <Link href={filter !== 'all' ? `/?filter=${filter}` : '/'} className="btn btn-secondary text-sm">
                Clear
              </Link>
            )}
          </div>
        </div>

        {/* Related Tags (when searching for a tag) */}
        {searchTags.length > 0 && relatedTags.length > 0 && (
          <RelatedTags tags={relatedTags} currentTags={searchTags} />
        )}

        {/* Results count */}
        {(search || filter !== 'all' || archive || showHidden) && (
          <p className="text-sm text-[var(--muted)]">
            {posts.length} result{posts.length !== 1 ? 's' : ''}
            {search && <> for &quot;{search}&quot;</>}
            {filter === 'following' && <> in your feed</>}
            {filter === 'rising' && <> rising</>}
            {filter === 'for-sale' && <> for sale</>}
            {filter === 'discover' && <> to discover</>}
            {archive && <> in archive</>}
            {showHidden && <> (hidden)</>}
          </p>
        )}

        {/* Feed with real-time updates */}
        <FeedClient
          initialPosts={posts}
          search={search}
          filter={filter}
          archive={archive}
          showHidden={showHidden}
          searchTags={searchTags.length > 0 ? searchTags : undefined}
        />
      </div>

      {/* Sidebar */}
      <aside className="hidden md:block">
        <Sidebar filter={filter} />
      </aside>
    </div>
  )
}
