import Link from 'next/link'
import { formatWrootz } from '@/app/lib/constants'
import { getTopTagsCached, getTopLockersCached, getRecentActivityCached, getTrendingTags } from '@/app/actions/posts'
import { getSession } from '@/app/lib/session'
import { getFollowedTags } from '@/app/actions/follow'
import TrendingTagsList from './TrendingTagsList'

interface SidebarProps {
  filter?: 'all' | 'following' | 'rising' | 'for-sale' | 'discover'
}

export default async function Sidebar({ filter = 'all' }: SidebarProps) {
  const session = await getSession()

  // For Rising tab, show trending tags (last 24h). For others, show top tags (all time)
  const showTrending = filter === 'rising'

  const [topTags, trendingTags, topLockers, followedTags, recentActivity] = await Promise.all([
    showTrending ? Promise.resolve([]) : getTopTagsCached(5),
    showTrending ? getTrendingTags(5) : Promise.resolve([]),
    getTopLockersCached(5),
    session ? getFollowedTags() : Promise.resolve([]),
    getRecentActivityCached(5)
  ])

  // Use trending tags for Rising tab, top tags for everything else
  const displayTags = showTrending ? trendingTags : topTags
  const tagSectionTitle = showTrending ? 'Trending Tags' : 'Top Tags'
  const tagSectionSubtitle = showTrending ? 'Last 24 hours' : null

  return (
    <div className="space-y-5">
      {/* Tags Section - Top Tags or Trending Tags based on filter */}
      {displayTags.length > 0 && (
        <section className="card">
          <div className="section-header">
            <h3 className="section-title flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showTrending ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                )}
              </svg>
              {tagSectionTitle}
            </h3>
            {tagSectionSubtitle && (
              <span className="text-xs text-[var(--muted)]">{tagSectionSubtitle}</span>
            )}
          </div>
          <TrendingTagsList
            tags={displayTags}
            followedTags={followedTags}
            isLoggedIn={!!session}
          />
        </section>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <section className="card-compact">
          <div className="section-header">
            <h3 className="section-title text-sm">Recent Activity</h3>
            <span className="flex items-center gap-1 text-xs text-[var(--accent)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              Live
            </span>
          </div>
          <div className="space-y-1">
            {recentActivity.map((activity: { postId: string; username: string; postTitle: string; wrootz: number; tag: string | null }, index: number) => (
              <Link
                key={`${activity.postId}-${activity.username}-${activity.tag || 'none'}-${index}`}
                href={`/post/${activity.postId}`}
                className="block p-2 -mx-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
              >
                <p className="text-xs text-[var(--foreground-muted)]">
                  <span className="text-[var(--foreground)] font-medium">@{activity.username}</span>
                  {' '}locked on{' '}
                  <span className="text-[var(--foreground)]">{activity.postTitle}</span>
                </p>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <span className="text-[var(--accent)] font-medium">+{formatWrootz(activity.wrootz)}</span>
                  {activity.tag && (
                    <span className="text-[var(--primary)]">#{activity.tag}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top Lockers */}
      {topLockers.length > 0 && (
        <section className="card-compact">
          <div className="section-header">
            <h3 className="section-title text-sm">Top Lockers</h3>
          </div>
          <div className="space-y-1">
            {topLockers.map(({ username, wrootz }: { username: string; wrootz: number }, index: number) => (
              <Link
                key={username}
                href={`/profile/${username}`}
                className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--foreground-muted)] w-5 text-center font-medium">{index + 1}</span>
                  <span className="text-sm font-medium">@{username}</span>
                </div>
                <span className="text-xs text-[var(--accent)] font-semibold">{formatWrootz(wrootz)} wrootz</span>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
