import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/app/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')?.toLowerCase() || ''

  if (query.length < 1) {
    return NextResponse.json([])
  }

  // Get all locks with tags (including expired for historical suggestions)
  // We'll show active wrootz but include tags from expired locks too
  const locks = await prisma.lock.findMany({
    where: {
      tag: {
        not: null,
      },
    },
    select: {
      tag: true,
      currentTu: true,
      initialTu: true,
      expired: true,
    },
  })

  // Aggregate wrootz by tag (use currentTu for active, initialTu for expired)
  const tagMap: Record<string, number> = {}
  for (const lock of locks) {
    if (lock.tag && lock.tag.toLowerCase().includes(query)) {
      // Use current wrootz for active locks, initial for expired (as historical reference)
      const wrootzValue = lock.expired ? lock.initialTu : lock.currentTu
      tagMap[lock.tag] = (tagMap[lock.tag] || 0) + wrootzValue
    }
  }

  // Convert to array and sort by wrootz descending
  const results = Object.entries(tagMap)
    .map(([tag, wrootz]) => ({ tag, wrootz }))
    .sort((a, b) => b.wrootz - a.wrootz)
    .slice(0, 8) // Limit to 8 suggestions

  return NextResponse.json(results)
}
