import prisma from '@/app/lib/db'
import { formatSats, bsvToSats, formatWrootz, blocksToTimeString } from '@/app/lib/constants'
import { getSession } from '@/app/lib/session'
import { isFollowingUser, getFollowerCount, getFollowingCount } from '@/app/actions/follow'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FollowUserButton from '@/app/components/FollowUserButton'
import EditProfileButton from '@/app/components/EditProfileButton'
import ProfileAvatar from '@/app/components/ProfileAvatar'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params

  const user = await prisma.user.findUnique({
    where: { username },
    select: { bio: true, avatarUrl: true },
  })

  if (!user) {
    return { title: `@${username} | Wrootz` }
  }

  const title = `@${username} | Wrootz`
  const description = user.bio
    ? user.bio.length > 160 ? user.bio.slice(0, 160) + '...' : user.bio
    : `${username}'s profile on Wrootz`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(user.avatarUrl ? { images: [user.avatarUrl] } : {}),
    },
  }
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  // Get user by username
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
    }
  })

  if (!user) {
    notFound()
  }

  // Get session and follow status
  const session = await getSession()
  const [isFollowing, followerCount, followingCount] = await Promise.all([
    session ? isFollowingUser(username) : Promise.resolve(false),
    getFollowerCount(username),
    getFollowingCount(username)
  ])
  const isOwnProfile = session?.userId === user.id

  // Parallelize all three profile queries for performance
  const [ownedPosts, createdPosts, activeLocks] = await Promise.all([
    // Get user's owned posts — use cached totalTu (kept fresh by lock-updater cron)
    prisma.post.findMany({
      where: { ownerId: user.id },
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        totalTu: true,
        forSale: true,
        salePrice: true,
        ownerId: true,
      },
      orderBy: { totalTu: 'desc' }
    }),
    // Get user's created posts
    prisma.post.findMany({
      where: { creatorId: user.id },
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        totalTu: true,
        ownerId: true,
        owner: { select: { username: true } }
      },
      orderBy: { totalTu: 'desc' }
    }),
    // Get user's active locks (public info) — use cached totalTu to avoid N+1
    prisma.lock.findMany({
      where: { userId: user.id, expired: false },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            body: true,
            totalTu: true,
          }
        }
      },
      orderBy: { currentTu: 'desc' }
    })
  ])

  // Calculate total wrootz from active locks
  const totalWrootz = activeLocks.reduce((sum, lock) => sum + lock.currentTu, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-start gap-4">
          <ProfileAvatar
            username={user.username}
            avatarUrl={user.avatarUrl}
            size="lg"
          />
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">@{user.username}</h1>
                <p className="text-[var(--muted)] text-sm">
                  Member since {new Date(user.createdAt).toLocaleDateString()}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <Link href={`/profile/${username}/followers`} className="hover:underline">
                    <strong>{followerCount}</strong> <span className="text-[var(--muted)]">followers</span>
                  </Link>
                  <Link href={`/profile/${username}/following`} className="hover:underline">
                    <strong>{followingCount}</strong> <span className="text-[var(--muted)]">following</span>
                  </Link>
                </div>
              </div>
              {session && !isOwnProfile && (
                <FollowUserButton
                  username={username}
                  isFollowing={isFollowing}
                  isOwnProfile={isOwnProfile}
                />
              )}
              {isOwnProfile && (
                <EditProfileButton
                  currentBio={user.bio || ''}
                  currentAvatarUrl={user.avatarUrl || ''}
                />
              )}
            </div>
            {user.bio && (
              <p className="mt-3 text-[var(--foreground)]">{user.bio}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Posts Owned</p>
            <p className="text-xl font-bold">{ownedPosts.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Posts Created</p>
            <p className="text-xl font-bold">{createdPosts.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Active Locks</p>
            <p className="text-xl font-bold">{activeLocks.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--background)]">
            <p className="text-sm text-[var(--muted)]">Total Wrootz</p>
            <p className="text-xl font-bold text-[var(--accent)]">{formatWrootz(totalWrootz)}</p>
          </div>
        </div>
      </div>

      {/* Owned Posts */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Posts Owned ({ownedPosts.length})</h2>
        {ownedPosts.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-6">
            No posts owned yet
          </p>
        ) : (
          <div className="space-y-3">
            {ownedPosts.map((post) => {
              const displayTitle = post.title || 'Untitled post'
              const bodyPreview = post.body ? (post.body.length > 80 ? post.body.slice(0, 80) + '...' : post.body) : 'No content'
              return (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)] hover:bg-opacity-75 transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <h3 className="font-medium truncate">{displayTitle}</h3>
                    <p className="text-sm text-[var(--foreground-muted)] truncate mt-0.5">
                      {bodyPreview}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {formatWrootz(post.totalTu)} wrootz
                      {post.forSale && ` | For sale: ${formatSats(bsvToSats(post.salePrice || 0))} sats`}
                    </p>
                  </div>
                  <div className="wrootz-badge flex-shrink-0">{formatWrootz(post.totalTu)} wrootz</div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Created Posts (if different from owned) */}
      {createdPosts.some(p => p.ownerId !== user.id) && (
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Posts Created (sold)</h2>
          <div className="space-y-3">
            {createdPosts.filter(p => p.ownerId !== user.id).map((post) => {
              const displayTitle = post.title || 'Untitled post'
              const bodyPreview = post.body ? (post.body.length > 80 ? post.body.slice(0, 80) + '...' : post.body) : 'No content'
              return (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)] hover:bg-opacity-75 transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <h3 className="font-medium truncate">{displayTitle}</h3>
                    <p className="text-sm text-[var(--foreground-muted)] truncate mt-0.5">
                      {bodyPreview}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Now owned by @{post.owner.username}
                    </p>
                  </div>
                  <div className="wrootz-badge flex-shrink-0">{formatWrootz(post.totalTu)} wrootz</div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Locks */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">Active Locks ({activeLocks.length})</h2>
        {activeLocks.length === 0 ? (
          <p className="text-[var(--muted)] text-center py-6">
            No active locks
          </p>
        ) : (
          <div className="space-y-3">
            {activeLocks.map((lock) => {
              const wrootzShare = lock.post && lock.post.totalTu > 0
                ? (lock.currentTu / lock.post.totalTu) * 100
                : 0
              const postTitle = lock.post?.title
              const postBody = lock.post?.body || ''
              const displayTitle = postTitle || (postBody.length > 60 ? postBody.slice(0, 60) + '...' : postBody) || 'Unknown post'
              return (
                <Link
                  key={lock.id}
                  href={`/post/${lock.postId}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--background)] hover:bg-opacity-75 transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <h3 className="font-medium truncate">{displayTitle}</h3>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--muted)] mt-1">
                      <span>{formatSats(bsvToSats(lock.amount))} sats</span>
                      <span>|</span>
                      <span>{blocksToTimeString(lock.remainingBlocks)} remaining</span>
                      {lock.tag && (
                        <>
                          <span>|</span>
                          <span className="tag">#{lock.tag}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="wrootz-badge text-sm">{formatWrootz(lock.currentTu)} wrootz</div>
                    <p className="text-xs text-[var(--muted)] mt-1">{wrootzShare.toFixed(1)}% share</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
