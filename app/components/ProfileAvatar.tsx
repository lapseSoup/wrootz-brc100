'use client'

interface ProfileAvatarProps {
  username: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}

export default function ProfileAvatar({ username, avatarUrl, size = 'md' }: ProfileAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-20 h-20 text-2xl'
  }

  const initial = username.charAt(0).toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${username}'s avatar`}
        className={`${sizeClasses[size]} rounded-full object-cover bg-[var(--card)]`}
        onError={(e) => {
          // Fallback to initial if image fails to load
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          target.nextElementSibling?.classList.remove('hidden')
        }}
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
