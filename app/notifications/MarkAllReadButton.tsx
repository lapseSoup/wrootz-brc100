'use client'

import { useTransition } from 'react'
import { markAllAsRead } from '@/app/actions/notifications'
import { useRouter } from 'next/navigation'

export default function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleClick = () => {
    startTransition(async () => {
      await markAllAsRead()
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-sm text-[var(--primary)] hover:underline disabled:opacity-50"
    >
      {isPending ? 'Marking...' : 'Mark all as read'}
    </button>
  )
}
