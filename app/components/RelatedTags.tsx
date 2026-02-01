'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { formatWrootz } from '@/app/lib/constants'

interface RelatedTag {
  tag: string
  wrootz: number
}

export default function RelatedTags({ tags, currentTags }: { tags: RelatedTag[]; currentTags: string | string[] }) {
  const searchParams = useSearchParams()
  const filter = searchParams.get('filter')
  const archive = searchParams.get('archive')

  if (tags.length === 0) return null

  // Normalize currentTags to array
  const tagArray = Array.isArray(currentTags) ? currentTags : [currentTags]

  const buildTagUrl = (tag: string) => {
    const params = new URLSearchParams()
    params.set('search', tag)
    if (filter) params.set('filter', filter)
    if (archive) params.set('archive', archive)
    return `/?${params.toString()}`
  }

  // Format the "Related to" text
  const relatedToText = tagArray.length === 1
    ? `#${tagArray[0]}`
    : tagArray.map(t => `#${t}`).join(' + ')

  return (
    <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3.5 h-3.5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span className="text-xs font-medium text-[var(--foreground-muted)]">
          Related to {relatedToText}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(({ tag, wrootz }) => (
          <Link
            key={tag}
            href={buildTagUrl(tag)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--surface-1)] hover:bg-[var(--primary)]/10 border border-[var(--border)] text-xs transition-colors"
          >
            <span className="text-[var(--primary)]">#{tag}</span>
            <span className="text-[var(--accent)] font-medium">{formatWrootz(wrootz)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
