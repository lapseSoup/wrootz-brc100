import { getTagStats, getTagWrootzHistory, getRecentTagActivity, getRelatedTags } from '@/app/actions/tags'
import { isFollowingTag } from '@/app/actions/follow'
import { getSession } from '@/app/lib/session'
import { formatWrootz, formatSats, bsvToSats } from '@/app/lib/constants'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FollowTagButton from '@/app/components/FollowTagButton'
import TagWrootzGraph from './TagWrootzGraph'

export const dynamic = 'force-dynamic'

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>
}) {
  const { tag } = await params
  const decodedTag = decodeURIComponent(tag)

  const [stats, history, recentActivity, relatedTags, session] = await Promise.all([
    getTagStats(decodedTag),
    getTagWrootzHistory(decodedTag),
    getRecentTagActivity(decodedTag, 10),
    getRelatedTags(decodedTag, 8),
    getSession()
  ])

  // Check if tag exists (has any activity)
  if (stats.totalPosts === 0 && stats.activeLockCount === 0 && stats.expiredLockCount === 0) {
    notFound()
  }

  const isFollowing = session ? await isFollowingTag(decodedTag) : false

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--primary)]">#{decodedTag}</h1>
            <p className="text-[var(--muted)] text-sm mt-1">
              {stats.followerCount} follower{stats.followerCount !== 1 ? 's' : ''}
            </p>
          </div>
          {session && (
            <FollowTagButton
              tag={decodedTag}
              isFollowing={isFollowing}
            />
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Current Wrootz</p>
            <p className="text-xl font-bold text-[var(--accent)]">{formatWrootz(stats.totalWrootz)}</p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Locked Sats</p>
            <p className="text-xl font-bold">{formatSats(bsvToSats(stats.totalLockedSats))}</p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Posts</p>
            <p className="text-xl font-bold">{stats.totalPosts}</p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Lockers</p>
            <p className="text-xl font-bold">{stats.totalLockers}</p>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-[var(--muted)]">
          <span>{stats.activeLockCount} active lock{stats.activeLockCount !== 1 ? 's' : ''}</span>
          <span>|</span>
          <span>{stats.expiredLockCount} expired lock{stats.expiredLockCount !== 1 ? 's' : ''}</span>
          <span>|</span>
          <span>Peak: {formatWrootz(stats.peakWrootz)} wrootz</span>
        </div>
      </div>

      {/* Related Tags */}
      {relatedTags.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Related Tags</h2>
          <div className="flex flex-wrap gap-2">
            {relatedTags.map(({ tag: relatedTag, wrootz }) => (
              <Link
                key={relatedTag}
                href={`/tag/${encodeURIComponent(relatedTag)}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--background)] hover:bg-[var(--primary)] hover:text-white transition-colors"
              >
                <span className="font-medium">#{relatedTag}</span>
                <span className="text-xs opacity-70">{formatWrootz(wrootz)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Wrootz History Graph */}
      {history.length >= 2 && (
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Wrootz Over Time</h2>
          <TagWrootzGraph data={history} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Posts */}
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Top Posts</h2>
          {stats.topPosts.length === 0 ? (
            <p className="text-[var(--muted)] text-center py-4">No posts yet</p>
          ) : (
            <div className="space-y-2">
              {stats.topPosts.map((post, index) => (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--background)] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-[var(--muted)] w-4">{index + 1}</span>
                    <span className="text-sm truncate">{post.title}</span>
                  </div>
                  <span className="text-xs text-[var(--accent)] flex-shrink-0 ml-2">
                    {formatWrootz(post.wrootz)}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <Link
            href={`/?search=${encodeURIComponent(decodedTag)}`}
            className="block text-center text-sm text-[var(--primary)] hover:underline mt-3"
          >
            View all posts with #{decodedTag}
          </Link>
        </div>

        {/* Top Lockers */}
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Top Lockers</h2>
          {stats.topLockers.length === 0 ? (
            <p className="text-[var(--muted)] text-center py-4">No lockers yet</p>
          ) : (
            <div className="space-y-2">
              {stats.topLockers.map((locker, index) => (
                <Link
                  key={locker.username}
                  href={`/profile/${locker.username}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--background)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--muted)] w-4">{index + 1}</span>
                    <span className="text-sm">@{locker.username}</span>
                  </div>
                  <span className="text-xs text-[var(--accent)]">
                    {formatWrootz(locker.wrootz)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-4">No activity yet</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((activity) => (
              <Link
                key={activity.id}
                href={`/post/${activity.postId}`}
                className={`block p-3 rounded-lg hover:bg-[var(--background)] transition-colors ${
                  activity.expired ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="text-[var(--foreground)]">@{activity.username}</span>
                      <span className="text-[var(--muted)]"> locked on </span>
                      <span className="text-[var(--foreground)]">{activity.postTitle}</span>
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {new Date(activity.createdAt).toLocaleDateString()}
                      {activity.expired && ' (expired)'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className={`text-sm font-medium ${activity.expired ? 'text-[var(--muted)]' : 'text-[var(--accent)]'}`}>
                      {formatWrootz(activity.wrootz)} wrootz
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatSats(bsvToSats(activity.sats))} sats
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
