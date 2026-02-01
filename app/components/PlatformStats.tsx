import { formatWrootz, formatBSV } from '@/app/lib/constants'
import { getPlatformStats } from '@/app/actions/posts'

export default async function PlatformStats() {
  const stats = await getPlatformStats()

  return (
    <div className="flex items-center justify-center gap-6 md:gap-8 py-3 px-4 bg-[var(--surface-1)] border-b border-[var(--border)]">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--foreground-muted)]">Posts</span>
        <span className="font-semibold text-[var(--primary)]">{stats.totalPosts}</span>
      </div>
      <div className="w-px h-4 bg-[var(--border)]" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--foreground-muted)]">Wrootz</span>
        <span className="font-semibold text-[var(--accent)]">{formatWrootz(stats.totalWrootz)}</span>
      </div>
      <div className="w-px h-4 bg-[var(--border)]" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--foreground-muted)]">Locked</span>
        <span className="font-semibold text-[var(--foreground-secondary)]">{formatBSV(stats.totalLockedBSV)} BSV</span>
      </div>
      <div className="w-px h-4 bg-[var(--border)]" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--foreground-muted)]">Users</span>
        <span className="font-semibold text-[var(--foreground)]">{stats.totalUsers}</span>
      </div>
    </div>
  )
}
