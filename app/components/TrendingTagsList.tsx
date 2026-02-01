'use client'

import Link from 'next/link'
import { formatWrootz } from '@/app/lib/constants'
import FollowTagButton from './FollowTagButton'

interface TrendingTagsListProps {
  tags: { tag: string; wrootz: number }[]
  followedTags: string[]
  isLoggedIn: boolean
}

export default function TrendingTagsList({ tags, followedTags, isLoggedIn }: TrendingTagsListProps) {
  return (
    <div className="space-y-2">
      {tags.map(({ tag, wrootz }, index) => (
        <div
          key={tag}
          className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--background)] transition-colors"
        >
          <Link
            href={`/tag/${encodeURIComponent(tag)}`}
            className="flex items-center gap-2 flex-1"
          >
            <span className="text-xs text-[var(--muted)] w-4">{index + 1}</span>
            <span className="text-sm font-medium text-[var(--primary)]">#{tag}</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">{formatWrootz(wrootz)}</span>
            {isLoggedIn && (
              <FollowTagButton
                tag={tag}
                isFollowing={followedTags.includes(tag)}
                size="sm"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
