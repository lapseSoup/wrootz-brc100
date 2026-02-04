'use client'

import Link from 'next/link'

interface ReplyToPost {
  id: string
  title: string
  creator: { username: string }
}

interface ReplyContextProps {
  replyToPost: ReplyToPost | null
}

export default function ReplyContext({ replyToPost }: ReplyContextProps) {
  if (!replyToPost) return null

  return (
    <div className="mb-6 p-4 rounded-lg bg-[var(--background)] border border-[var(--card-border)]">
      <p className="text-sm text-[var(--muted)] mb-1">Replying to:</p>
      <Link
        href={`/post/${replyToPost.id}`}
        className="font-medium text-[var(--primary)] hover:underline"
      >
        {replyToPost.title || `Post by @${replyToPost.creator.username}`}
      </Link>
      <p className="text-xs text-[var(--muted)] mt-1">by @{replyToPost.creator.username}</p>
    </div>
  )
}

export { ReplyContext }
