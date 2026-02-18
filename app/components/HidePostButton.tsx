'use client'

import { useState } from 'react'
import { hidePost, unhidePost } from '@/app/actions/posts'
import { useRouter } from 'next/navigation'

interface HidePostButtonProps {
  postId: string
  isHidden?: boolean
}

export default function HidePostButton({ postId, isHidden = false }: HidePostButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const router = useRouter()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setError(false)
    setLoading(true)
    try {
      if (isHidden) {
        await unhidePost(postId)
      } else {
        await hidePost(postId)
      }
      router.refresh()
    } catch (err) {
      console.error('Failed to hide/unhide post:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        p-1 rounded transition-colors
        ${isHidden
          ? 'text-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'
          : 'text-[var(--foreground-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
        }
        ${loading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      title={error ? 'Action failed — try again' : isHidden ? 'Unhide this post' : 'Hide this post'}
      aria-label={error ? 'Action failed — try again' : isHidden ? 'Unhide this post' : 'Hide this post'}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {isHidden ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        )}
      </svg>
    </button>
  )
}
