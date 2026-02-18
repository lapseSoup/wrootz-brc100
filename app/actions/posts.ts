/**
 * Post-related server actions - modular re-export
 *
 * This file maintains backwards compatibility with existing imports.
 * The actual implementation has been split into modules under ./posts/
 *
 * Module structure:
 * - posts/create.ts    - Post creation
 * - posts/locks.ts     - BSV locking and tipping
 * - posts/sales.ts     - Sale listing and purchasing
 * - posts/queries.ts   - Post queries and statistics
 * - posts/links.ts     - Reply and backlink operations
 * - posts/hidden.ts    - Hidden post management
 * - posts/helpers.ts   - Shared utilities (block height, lock status updates)
 */

export {
  // Post creation
  createPost,

  // Locking and tipping
  recordLock,
  tipPost,

  // Sales
  listForSale,
  cancelSale,
  buyPost,

  // Queries
  getPostsWithTU,
  getPostById,
  getTopTags,
  getTrendingTags,
  getTopLockers,
  getPlatformStats,
  getRecentActivity,
  getRisingPosts,
  getTopTagsCached,
  getTopLockersCached,
  getRecentActivityCached,

  // Post links (replies, backlinks)
  getReplies,
  getReplyParent,
  getBacklinks,

  // Hidden posts
  hidePost,
  unhidePost,
  getHiddenPostIds,

  // Helpers
  getCurrentBlock,
  updateLockStatuses
} from './posts/index'
