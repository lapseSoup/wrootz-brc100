import { getFollowing } from '@/app/actions/follow'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/app/lib/db'

export const dynamic = 'force-dynamic'

export default async function FollowingPage({
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

  const following = await getFollowing(username)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <Link href={`/profile/${username}`} className="text-[var(--muted)] hover:text-[var(--foreground)]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold">@{username} is Following</h1>
      </div>

      <div className="card">
        {following.length === 0 ? (
          <p className="text-center text-[var(--muted)] py-8">Not following anyone yet</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {following.map(({ username: followingUsername, createdAt }) => (
              <Link
                key={followingUsername}
                href={`/profile/${followingUsername}`}
                className="flex items-center justify-between p-3 hover:bg-[var(--background)] transition-colors"
              >
                <span className="font-medium">@{followingUsername}</span>
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
