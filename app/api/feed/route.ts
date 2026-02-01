import { NextRequest, NextResponse } from 'next/server'
import { getPostsWithTU } from '@/app/actions/posts'
import { getPostsByTag } from '@/app/actions/tags'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || undefined
  const filter = searchParams.get('filter') as 'all' | 'following' | 'rising' | 'for-sale' | 'discover' | undefined
  const archive = searchParams.get('archive') === 'true'
  const showHidden = searchParams.get('hidden') === 'true'
  const limit = parseInt(searchParams.get('limit') || '50')

  try {
    // Parse search for tags - supports multiple tags
    let searchTags: string[] = []
    if (search) {
      const tagMatches = search.match(/#?[a-zA-Z0-9_-]+/g) || []
      searchTags = tagMatches.map(t => t.replace(/^#/, '')).filter(t => t.length > 0)
    }

    // Use tag-specific ranking for tag searches
    let posts
    if (searchTags.length > 0 && (!filter || filter === 'all') && !archive && !showHidden) {
      posts = await getPostsByTag(searchTags, limit)
    } else {
      posts = await getPostsWithTU({
        search,
        filter,
        archive,
        showHidden,
        limit
      })
    }

    return NextResponse.json({ posts, searchTags: searchTags.length > 0 ? searchTags : undefined }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Feed fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
  }
}
