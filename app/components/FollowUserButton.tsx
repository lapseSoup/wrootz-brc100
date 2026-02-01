'use client'

import { useState, useTransition } from 'react'
import { followUser, unfollowUser } from '@/app/actions/follow'

interface FollowUserButtonProps {
  username: string
  isFollowing: boolean
  isOwnProfile?: boolean
  size?: 'sm' | 'md'
}

export default function FollowUserButton({
  username,
  isFollowing: initialFollowing,
  isOwnProfile = false,
  size = 'md'
}: FollowUserButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [isPending, startTransition] = useTransition()

  if (isOwnProfile) {
    return null
  }

  const handleClick = () => {
    startTransition(async () => {
      if (isFollowing) {
        const result = await unfollowUser(username)
        if (!result.error) {
          setIsFollowing(false)
        }
      } else {
        const result = await followUser(username)
        if (!result.error) {
          setIsFollowing(true)
        }
      }
    })
  }

  const sizeClasses = size === 'sm'
    ? 'px-3 py-1 text-xs'
    : 'px-4 py-1.5 text-sm'

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`${sizeClasses} rounded-lg font-medium transition-colors ${
        isFollowing
          ? 'bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:border-red-500 hover:text-red-500'
          : 'bg-[var(--primary)] text-white hover:opacity-90'
      } ${isPending ? 'opacity-50' : ''}`}
    >
      {isPending ? '...' : isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
