import { getFollowers } from '@/app/actions/follow'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/app/lib/db'

export const dynamic = 'force-dynamic'

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const user = await prisma.user.findUnique({
    where: { username },
    select: { username: true }
  })

  if (!user) {
    notFound()
  }

  const followers = await getFollowers(username)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <Link href={`/profile/${username}`} className="text-[var(--muted)] hover:text-[var(--foreground)]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold">@{username}&apos;s Followers</h1>
      </div>

      <div className="card">
        {followers.length === 0 ? (
          <p className="text-center text-[var(--muted)] py-8">No followers yet</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {followers.map(({ username: followerUsername, createdAt }) => (
              <Link
                key={followerUsername}
                href={`/profile/${followerUsername}`}
                className="flex items-center justify-between p-3 hover:bg-[var(--background)] transition-colors"
              >
                <span className="font-medium">@{followerUsername}</span>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
