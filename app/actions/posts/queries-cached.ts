/**
 * Cached wrappers for sidebar aggregation queries.
 *
 * These use Next.js unstable_cache to avoid hitting the database on every
 * page load. Results are cached for 5 minutes (300 seconds) and invalidated
 * whenever a new lock is created (via revalidateTag('locks') in locks.ts).
 *
 * This file intentionally does NOT have 'use server' — unstable_cache wraps
 * must be exported as plain constants, which is not allowed in 'use server' files.
 */

import { unstable_cache } from 'next/cache'
import { getTopTags, getTopLockers, getRecentActivity } from './queries'

/**
 * Cached version of getTopTags for use in Sidebar.
 * Revalidates every 5 minutes or when the 'locks' cache tag is invalidated.
 */
export const getTopTagsCached = unstable_cache(
  async (limit: number = 5) => getTopTags(limit),
  ['top-tags'],
  { revalidate: 300, tags: ['locks', 'top-tags'] }
)

/**
 * Cached version of getTopLockers for use in Sidebar.
 * Revalidates every 5 minutes or when the 'locks' cache tag is invalidated.
 */
export const getTopLockersCached = unstable_cache(
  async (limit: number = 5) => getTopLockers(limit),
  ['top-lockers'],
  { revalidate: 300, tags: ['locks', 'top-lockers'] }
)

/**
 * Cached version of getRecentActivity for use in Sidebar.
 * Revalidates every 5 minutes or when the 'locks' cache tag is invalidated.
 */
export const getRecentActivityCached = unstable_cache(
  async (limit: number = 5) => getRecentActivity(limit),
  ['recent-activity'],
  { revalidate: 300, tags: ['locks', 'recent-activity'] }
)
