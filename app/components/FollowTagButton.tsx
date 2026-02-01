'use client'

import { useState, useTransition } from 'react'
import { followTag, unfollowTag } from '@/app/actions/follow'

interface FollowTagButtonProps {
  tag: string
  isFollowing: boolean
  size?: 'sm' | 'md'
}

export default function FollowTagButton({ tag, isFollowing: initialFollowing, size = 'sm' }: FollowTagButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    startTransition(async () => {
      if (isFollowing) {
        const result = await unfollowTag(tag)
        if (!result.error) {
          setIsFollowing(false)
        }
      } else {
        const result = await followTag(tag)
        if (!result.error) {
          setIsFollowing(true)
        }
      }
    })
  }

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm'

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`${sizeClasses} rounded-full font-medium transition-colors ${
        isFollowing
          ? 'bg-[var(--primary)] text-white hover:bg-red-500'
          : 'border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white'
      } ${isPending ? 'opacity-50' : ''}`}
    >
      {isPending ? '...' : isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
