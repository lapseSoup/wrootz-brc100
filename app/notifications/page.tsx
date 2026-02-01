import { getNotifications } from '@/app/actions/notifications'
import { getSession } from '@/app/lib/session'
import { redirect } from 'next/navigation'
import MarkAllReadButton from './MarkAllReadButton'
import NotificationItem from './NotificationItem'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const notifications = await getNotifications(50)
  const hasUnread = notifications.some(n => !n.read)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Notifications</h1>
        {hasUnread && <MarkAllReadButton />}
      </div>

      <div className="card">
        {notifications.length === 0 ? (
          <p className="text-center text-[var(--muted)] py-8">No notifications yet</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
