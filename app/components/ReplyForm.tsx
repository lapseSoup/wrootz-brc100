'use client'

import { useState } from 'react'
import { createPost } from '@/app/actions/posts'

interface ReplyFormProps {
  parentPostId: string
  parentPostTitle: string
}

export default function ReplyForm({ parentPostId, parentPostTitle }: ReplyFormProps) {
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [showTitle, setShowTitle] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData()
    formData.set('title', title)
    formData.set('body', body)
    formData.set('replyToPostId', parentPostId)
    formData.set('lockerSharePercentage', '10')

    try {
      await createPost(formData)
      // createPost redirects on success, so we shouldn't reach here
    } catch {
      // Redirect happens in createPost, this catch is for unexpected errors
      setError('Failed to post reply. Please try again.')
      setLoading(false)
    }
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full p-4 text-left rounded-lg border-2 border-dashed border-[var(--card-border)] hover:border-[var(--primary)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        Write a reply...
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-lg border border-[var(--card-border)] bg-[var(--card)]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">
          Replying to <span className="text-[var(--primary)]">{parentPostTitle || 'this post'}</span>
        </p>
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-3 bg-[var(--danger)] text-white rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Optional Title */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="showTitle"
            checked={showTitle}
            onChange={(e) => setShowTitle(e.target.checked)}
            className="rounded accent-[var(--primary)]"
          />
          <label htmlFor="showTitle" className="text-sm text-[var(--muted)]">Add a title (optional)</label>
        </div>
        {showTitle && (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Reply title..."
            maxLength={200}
          />
        )}
      </div>

      {/* Body */}
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="input min-h-[120px] resize-y"
          placeholder="Write your reply..."
          required
        />
      </div>

      {/* Info */}
      <div className="text-xs text-[var(--muted)]">
        Replies are full posts that can be locked and sold independently.
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="btn btn-primary flex-1"
        >
          {loading ? 'Posting...' : 'Post Reply'}
        </button>
      </div>
    </form>
  )
}
