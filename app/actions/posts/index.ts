// Re-export all post-related server actions from their modules
// This maintains backwards compatibility with existing imports from '@/app/actions/posts'

// Post creation
export { createPost } from './create'

// Locking and tipping
export { recordLock, tipPost } from './locks'

// Sales
export { listForSale, cancelSale, buyPost } from './sales'

// Queries
export {
  getPostsWithTU,
  getPostById,
  getTopTags,
  getTrendingTags,
  getTopLockers,
  getPlatformStats,
  getRecentActivity,
  getRisingPosts
} from './queries'

// Cached sidebar queries (no 'use server' — unstable_cache const exports)
export {
  getTopTagsCached,
  getTopLockersCached,
  getRecentActivityCached
} from './queries-cached'

// Post links (replies, backlinks)
export { getReplies, getReplyParent, getBacklinks } from './links'

// Hidden posts
export { hidePost, unhidePost, getHiddenPostIds } from './hidden'

// Helpers (for internal use by other modules)
export { getCurrentBlock, updateLockStatuses } from './helpers'
