'use client'

import { memo, useState, useEffect } from 'react'

interface ProfileAvatarProps {
  username: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}

function ProfileAvatarComponent({ username, avatarUrl, size = 'md' }: ProfileAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-20 h-20 text-2xl'
  }

  const initial = username.charAt(0).toUpperCase()
  const [imgFailed, setImgFailed] = useState(false)

  // Reset imgFailed when avatarUrl changes (e.g., user updates avatar)
  useEffect(() => {
    setImgFailed(false)
  }, [avatarUrl])

  if (avatarUrl && !imgFailed) {
    return (
      // Using native img for user avatars - has onError fallback via React state
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={`${username}'s avatar`}
        className={`${sizeClasses[size]} rounded-full object-cover bg-[var(--card)]`}
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-[var(--accent)] flex items-center justify-center font-bold text-white`}
    >
      {initial}
    </div>
  )
}

// Memoize to prevent unnecessary re-renders in lists
const ProfileAvatar = memo(ProfileAvatarComponent)
export default ProfileAvatar
