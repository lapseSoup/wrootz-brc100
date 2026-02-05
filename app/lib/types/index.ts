/**
 * Centralized type definitions for Wrootz BRC-100
 *
 * These types are used across multiple components and should be imported
 * from this file to ensure consistency and reduce duplication.
 */

// ============================================================================
// User Types
// ============================================================================

export interface UserBasic {
  username: string
}

export interface UserWithId {
  id: string
  username: string
}

export interface User {
  id: string
  username: string
  cachedBalance: number
}

// ============================================================================
// Lock Types
// ============================================================================

/** Minimal lock info for feed/list displays */
export interface LockBasic {
  id: string
  currentTu: number
  tag: string | null
  user: UserBasic
}

/** Full lock info for post detail pages */
export interface Lock {
  id: string
  amount: number
  initialTu: number
  currentTu: number
  durationBlocks: number
  remainingBlocks: number
  startBlock: number
  tag: string | null
  expired: boolean
  createdAt: string
  user: UserWithId
}

/** Lock for wrootz calculations (only needs currentTu) */
export interface LockForCalculation {
  currentTu: number
}

// ============================================================================
// Transaction Types
// ============================================================================

export type TransactionAction = 'Lock' | 'Unlock' | 'Buy' | 'Sell' | 'Profit' | 'Tip' | 'Create'

export interface Transaction {
  id: string
  action: string
  amount: number
  description: string | null
  createdAt: string
  user: UserWithId
}

export interface TransactionStyle {
  icon: string
  color: string
  bgColor: string
  label: string
}

// ============================================================================
// Post Types
// ============================================================================

/** Minimal post for feeds/lists */
export interface PostBasic {
  id: string
  title: string
  body: string
  imageUrl: string | null
  videoUrl?: string | null
  totalTu: number
  forSale: boolean
  salePrice: number
  lockerSharePercentage: number
  owner: UserBasic
  creator: UserBasic
  locks: LockBasic[]
  createdAt: Date
  replyCount?: number
  replyTo?: { id: string; title: string } | null
  tagWrootz?: number  // wrootz for specific tag(s) when doing tag search
}

/** Full post for detail pages */
export interface Post {
  id: string
  title: string
  body: string
  imageUrl: string | null
  videoUrl: string | null
  totalTu: number
  forSale: boolean
  salePrice: number | null
  lockerSharePercentage: number
  createdAt: string
  creator: UserWithId
  owner: UserWithId
  ownerId: string
  // 1Sat Ordinal fields
  inscriptionId: string | null
  inscriptionTxid: string | null
  contentHash: string | null
}

// ============================================================================
// Reply Types
// ============================================================================

export interface Reply {
  id: string
  title: string
  body: string
  totalTu: number
  createdAt: Date
  creator: UserWithId
  owner: UserWithId
  locks: LockForCalculation[]
  replyCount: number
}

export interface ReplyParent {
  id: string
  title: string
  creator: UserBasic
}

// ============================================================================
// Feed/Filter Types
// ============================================================================

export type FeedFilter = 'all' | 'following' | 'rising' | 'for-sale' | 'discover'

export interface FeedOptions {
  search?: string
  filter: FeedFilter
  archive: boolean
  showHidden?: boolean
  limit?: number
}

// ============================================================================
// Wrootz History Types
// ============================================================================

export interface WrootzDataPoint {
  block: number
  wrootz: number
}

export interface TagWrootz {
  [tag: string]: number
}
