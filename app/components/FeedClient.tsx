'use client'

import { useEffect, useState, useRef } from 'react'
import PostCard from './PostCard'
import Link from 'next/link'
import { useFeed } from '@/app/hooks/useAppData'
import type { PostBasic, FeedFilter } from '@/app/lib/types'

interface FeedClientProps {
  initialPosts: PostBasic[]
  search?: string
  filter: FeedFilter
  archive: boolean
  searchTags?: string[]  // tags being searched for (to display tag-specific wrootz)
  showHidden?: boolean  // whether showing hidden posts only
}

export default function FeedClient({ initialPosts, search, filter, archive, searchTags: initialSearchTags, showHidden }: FeedClientProps) {
  const [hasNewPosts, setHasNewPosts] = useState(false)
  const [displayedPosts, setDisplayedPosts] = useState<PostBasic[]>(initialPosts)

  // Use a ref to track the current top post ID without triggering re-renders
  const currentTopIdRef = useRef<string | null>(initialPosts[0]?.id ?? null)

  // Use centralized data fetching hook with SWR
  const { posts, searchTags, isValidating, refresh } = useFeed({
    search,
    filter,
    archive,
    showHidden,
    limit: 50
  })

  // L14: Track post IDs to avoid unnecessary re-renders
  const prevPostIdsRef = useRef<string>('')

  // Update displayed posts when new data arrives
  useEffect(() => {
    if (posts.length > 0) {
      const newPostIds = posts.map(p => p.id).join(',')

      if (newPostIds !== prevPostIdsRef.current) {
        // The set of posts (by ID) has changed — check if a new post appeared at the top
        const newTopId = posts[0]?.id
        if (currentTopIdRef.current && newTopId !== currentTopIdRef.current) {
          setHasNewPosts(true)
        }
        // Update the tracked top ID and replace the displayed list
        currentTopIdRef.current = newTopId ?? null
        prevPostIdsRef.current = newPostIds
        setDisplayedPosts(posts)
      } else {
        // Same post IDs — only totalTu (or other fields) changed.
        // Update displayed posts so values stay fresh but do NOT trigger
        // the "new posts" banner since the post set is unchanged.
        setDisplayedPosts(posts)
      }
    }
  }, [posts])

  // Reset when initial posts change (navigation)
  useEffect(() => {
    setDisplayedPosts(initialPosts)
    setHasNewPosts(false)
  }, [initialPosts])

  const loadNewPosts = () => {
    refresh()
    setHasNewPosts(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Use searchTags from hook or initial props
  const activeTags = searchTags || initialSearchTags

  return (
    <>
      {/* New posts indicator */}
      {hasNewPosts && (
        <button
          onClick={loadNewPosts}
          className="w-full py-2 px-4 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-dark)] transition-colors flex items-center justify-center gap-2"
          aria-live="polite"
          aria-label="New activity detected, click to refresh the feed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          New activity - click to refresh
        </button>
      )}

      {/* Loading indicator for background refresh */}
      {isValidating && displayedPosts.length > 0 && (
        <div className="text-xs text-[var(--muted)] text-center py-1" aria-live="polite">
          Refreshing...
        </div>
      )}

      {/* Tag search indicator */}
      {activeTags && activeTags.length > 0 && (
        <div className="text-xs text-[var(--muted)] mb-2" role="status">
          Ranked by wrootz in {activeTags.map(t => `#${t}`).join(' + ')}
        </div>
      )}

      {/* Posts */}
      {displayedPosts.length === 0 ? (
        <div className="card text-center py-12" role="status" aria-label="No posts found">
          <h2 className="text-xl font-semibold mb-2">
            {showHidden ? 'No hidden posts' :
             archive ? 'No archived posts' :
             filter === 'following' ? 'Nothing in your feed yet' :
             filter === 'rising' ? 'No rising posts' :
             filter === 'for-sale' ? 'No posts for sale' :
             filter === 'discover' ? 'No new posts to discover' :
             'No posts yet'}
          </h2>
          <p className="text-[var(--muted)] mb-4">
            {showHidden ? 'You haven\'t hidden any posts yet.' :
             archive ? 'No posts with expired wrootz found. Try a different search.' :
             filter === 'following' ? 'Follow some tags or users to see their content here!' :
             filter === 'rising' ? 'No posts have gained wrootz recently. Check back later!' :
             filter === 'for-sale' ? 'Check back later for posts listed for sale.' :
             filter === 'discover' ? 'All posts have wrootz! Try creating something new.' :
             'Be the first to create content!'}
          </p>
          {filter === 'all' && !archive && (
            <Link href="/create" className="btn btn-primary">
              Create Post
            </Link>
          )}
          {filter === 'following' && (
            <Link href="/" className="btn btn-primary">
              Browse All Posts
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2" role="feed" aria-label="Post feed">
          {displayedPosts.map((post) => (
            <PostCard key={post.id} post={post} searchTags={activeTags} isHidden={showHidden} />
          ))}
        </div>
      )}
    </>
  )
}
