import { memo, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatWrootz, formatSats, bsvToSats, formatRelativeTime } from '@/app/lib/constants'
import CopyLinkButton from './CopyLinkButton'
import HidePostButton from './HidePostButton'
import type { PostBasic, TagWrootz } from '@/app/lib/types'
import { getYouTubeVideoId } from '@/app/lib/utils/youtube'

interface PostCardProps {
  post: PostBasic
  searchTags?: string[]
  isHidden?: boolean
}

function PostCardComponent({ post, searchTags, isHidden }: PostCardProps) {
  // Get YouTube thumbnail if video URL exists
  const youtubeVideoId = post.videoUrl ? getYouTubeVideoId(post.videoUrl) : null
  const youtubeThumbnail = youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg` : null

  // Memoize expensive tag calculation - runs O(n) + O(n log n) sort
  const topTags = useMemo(() => {
    const tagWrootz: TagWrootz = {}
    for (const lock of post.locks) {
      if (lock.tag) {
        tagWrootz[lock.tag] = (tagWrootz[lock.tag] || 0) + lock.currentTu
      }
    }
    return Object.entries(tagWrootz)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [post.locks])

  // Preview text (truncate body)
  const previewText = useMemo(
    () => post.body.length > 120 ? post.body.slice(0, 120) + '...' : post.body,
    [post.body]
  )

  return (
    <Link href={`/post/${post.id}`}>
      <article className="card-interactive group">
        <div className="flex gap-3">
          {/* Wrootz badge - shows tag-specific wrootz when searching by tags */}
          <div className="flex-shrink-0 self-start flex flex-col items-center justify-center w-[70px] rounded-lg bg-[var(--accent-light)] transition-all duration-150" style={{ minHeight: '68px' }}>
            <span className="text-base font-bold text-[var(--accent)] leading-tight">
              {formatWrootz(searchTags && post.tagWrootz !== undefined ? post.tagWrootz : post.totalTu)}
            </span>
            <span className="text-[9px] text-[var(--accent)] opacity-80">
              wrootz
            </span>
            {/* Show total wrootz below when in tag search mode */}
            {searchTags && post.tagWrootz !== undefined && post.tagWrootz !== post.totalTu && (
              <span className="text-[8px] text-[var(--muted)] mt-0.5">
                ({formatWrootz(post.totalTu)} total)
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Title or body preview as title */}
            {post.title ? (
              <>
                <h3 className="font-semibold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--primary)] transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-[var(--foreground-muted)] line-clamp-2 mt-1">
                  {previewText}
                </p>
              </>
            ) : (
              <p className="font-semibold text-[var(--foreground)] line-clamp-3 group-hover:text-[var(--primary)] transition-colors">
                {previewText}
              </p>
            )}

            {/* Tags - min-height prevents layout shift when tags appear/disappear */}
            <div className="flex flex-wrap gap-1.5 mt-2 min-h-[22px]">
              {topTags.map(([tag]) => (
                <span key={tag} className="tag text-xs">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Footer - metadata */}
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-auto pt-2 text-xs text-[var(--foreground-muted)]">
              <span className="font-medium text-[var(--foreground-secondary)]">@{post.owner.username}</span>
              {post.owner.username !== post.creator.username && (
                <span className="opacity-70">by @{post.creator.username}</span>
              )}
              <span>{formatRelativeTime(post.createdAt)}</span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {post.locks.length}
              </span>
              {typeof post.replyCount === 'number' && post.replyCount > 0 && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {post.replyCount}
                </span>
              )}
              {post.videoUrl && (
                <span className="flex items-center gap-1 text-red-500">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                </span>
              )}
              <CopyLinkButton postId={post.id} />
              <HidePostButton postId={post.id} isHidden={isHidden} />
              {post.forSale && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-semibold">
                  Buy: {formatSats(bsvToSats(post.salePrice))} sats
                </span>
              )}
            </div>
          </div>

          {/* Thumbnail - YouTube video or image */}
          {(youtubeThumbnail || post.imageUrl) && (
            <div className="flex-shrink-0">
              <div className="w-24 h-24 md:w-28 md:h-28 relative rounded-lg overflow-hidden bg-[var(--surface-2)]">
                <Image
                  src={youtubeThumbnail || post.imageUrl!}
                  alt={post.title || 'Post thumbnail'}
                  fill
                  sizes="112px"
                  className="object-cover"
                  unoptimized
                />
                {/* Play button overlay for videos */}
                {youtubeThumbnail && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </article>
    </Link>
  )
}

// Memoize the component to prevent unnecessary re-renders in lists
const PostCard = memo(PostCardComponent)
export default PostCard
