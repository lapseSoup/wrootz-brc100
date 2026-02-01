'use client'

import { useEffect, useState, useCallback } from 'react'
import PostCard from './PostCard'
import Link from 'next/link'

interface Lock {
  id: string
  currentTu: number
  tag: string | null
  user: { username: string }
}

interface Post {
  id: string
  title: string
  body: string
  imageUrl: string | null
  totalTu: number
  forSale: boolean
  salePrice: number
  lockerSharePercentage: number
  owner: { username: string }
  creator: { username: string }
  locks: Lock[]
  createdAt: Date
  replyCount?: number
  replyTo?: { id: string; title: string } | null
  tagWrootz?: number  // wrootz for specific tag(s) when doing tag search
}

interface FeedClientProps {
  initialPosts: Post[]
  search?: string
  filter: 'all' | 'following' | 'rising' | 'for-sale' | 'discover'
  archive: boolean
  searchTags?: string[]  // tags being searched for (to display tag-specific wrootz)
  showHidden?: boolean  // whether showing hidden posts only
}

export default function FeedClient({ initialPosts, search, filter, archive, searchTags, showHidden }: FeedClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [hasNewPosts, setHasNewPosts] = useState(false)

  const fetchPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filter && filter !== 'all') params.set('filter', filter)
      if (archive) params.set('archive', 'true')
      if (showHidden) params.set('hidden', 'true')

      const res = await fetch(`/api/feed?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) return

      const data = await res.json()

      // Check if there are new posts at the top
      if (data.posts.length > 0 && posts.length > 0) {
        const newTopId = data.posts[0]?.id
        const currentTopId = posts[0]?.id
        if (newTopId !== currentTopId) {
          setHasNewPosts(true)
        }
      }

      // Update posts in place (wrootz values, etc.) without jarring reorder
      setPosts(data.posts)
    } catch (err) {
      console.error('Failed to fetch feed updates:', err)
    }
  }, [search, filter, archive, showHidden, posts])

  // Poll for updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchPosts, 10000)
    return () => clearInterval(interval)
  }, [fetchPosts])

  // Update posts when initial posts change (e.g., on navigation)
  useEffect(() => {
    setPosts(initialPosts)
    setHasNewPosts(false)
  }, [initialPosts])

  const loadNewPosts = () => {
    fetchPosts()
    setHasNewPosts(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      {/* New posts indicator */}
      {hasNewPosts && (
        <button
          onClick={loadNewPosts}
          className="w-full py-2 px-4 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-dark)] transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          New activity - click to refresh
        </button>
      )}

      {/* Posts */}
      {/* Tag search indicator */}
      {searchTags && searchTags.length > 0 && (
        <div className="text-xs text-[var(--muted)] mb-2">
          Ranked by wrootz in {searchTags.map(t => `#${t}`).join(' + ')}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="card text-center py-12">
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
        <div className="flex flex-col gap-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} searchTags={searchTags} isHidden={showHidden} />
          ))}
        </div>
      )}
    </>
  )
}
