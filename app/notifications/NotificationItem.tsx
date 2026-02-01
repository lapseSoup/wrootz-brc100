'use client'

import { useState } from 'react'
import Link from 'next/link'
import { markAsRead } from '@/app/actions/notifications'

interface NotificationItemProps {
  notification: {
    id: string
    type: string
    message: string
    read: boolean
    createdAt: Date
    post?: { id: string; title: string } | null
  }
}

export default function NotificationItem({ notification }: NotificationItemProps) {
  const [isRead, setIsRead] = useState(notification.read)

  const handleClick = async () => {
    if (!isRead) {
      await markAsRead(notification.id)
      setIsRead(true)
    }
  }

  const getIcon = () => {
    switch (notification.type) {
      case 'lock_on_post':
        return (
          <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )
      case 'followed_user_post':
        return (
          <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )
      case 'followed_tag_activity':
        return (
          <svg className="w-5 h-5 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        )
      case 'new_follower':
        return (
          <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        )
    }
  }

  const content = (
    <div
      className={`flex items-start gap-3 p-3 transition-colors ${
        !isRead ? 'bg-[var(--primary)]/5' : ''
      } ${notification.post ? 'hover:bg-[var(--background)] cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!isRead ? 'font-medium' : ''}`}>{notification.message}</p>
        <p className="text-xs text-[var(--muted)] mt-1">
          {new Date(notification.createdAt).toLocaleDateString()} at{' '}
          {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {!isRead && (
        <div className="flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
        </div>
      )}
    </div>
  )

  if (notification.post) {
    return (
      <Link href={`/post/${notification.post.id}`} onClick={handleClick}>
        {content}
      </Link>
    )
  }

  return content
}
