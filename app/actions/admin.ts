'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { revalidatePath } from 'next/cache'
import { getCurrentBlockHeight } from '@/app/lib/blockchain'
import { headers } from 'next/headers'

// Check if current user is admin
// TOCTOU WARNING: This check is not atomic with subsequent operations.
// Callers performing mutations must re-verify admin status inside a
// prisma.$transaction to prevent privilege escalation if admin is
// revoked between the check and the operation.
async function requireAdmin() {
  const session = await getSession()
  if (!session) {
    return { error: 'Not logged in', isAdmin: false }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId }
  })

  if (!user?.isAdmin) {
    return { error: 'Not authorized', isAdmin: false }
  }

  return { isAdmin: true, userId: session.userId }
}

// Re-verify admin inside a transaction to close the TOCTOU window
async function verifyAdminInTx(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId } })
  if (!user?.isAdmin) {
    throw new Error('Admin privileges revoked')
  }
}

// Log admin action for audit trail
async function logAdminAction(
  adminId: string,
  action: string,
  details: Record<string, unknown>,
  targetType?: string,
  targetId?: string
) {
  const headersList = await headers()
  const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null
  const rawUserAgent = headersList.get('user-agent') || null
  const userAgent = rawUserAgent ? rawUserAgent.substring(0, 1024) : null

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action,
      details: JSON.stringify(details),
      targetType,
      targetId,
      ipAddress,
      userAgent
    }
  })
}

// Delete a post (admin only)
export async function deletePost(formData: FormData) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.isAdmin) {
    return { error: adminCheck.error }
  }

  const postId = formData.get('postId') as string

  if (!postId) {
    return { error: 'Post ID required' }
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { locks: { where: { expired: false } } }
  })

  if (!post) {
    return { error: 'Post not found' }
  }

  // NOTE: On mainnet, we can't refund locks - the BSV is locked on-chain
  // We can only delete the database record. Locked BSV will unlock when the timelock expires.
  if (post.locks.length > 0) {
    return {
      error: `Cannot delete post with ${post.locks.length} active on-chain locks. Wait for locks to expire.`
    }
  }

  // Atomic: re-verify admin + delete in same transaction to prevent TOCTOU race
  try {
    await prisma.$transaction(async (tx) => {
      await verifyAdminInTx(tx, adminCheck.userId!)
      await tx.post.delete({ where: { id: postId } })
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Admin privileges revoked') {
      return { error: 'Not authorized' }
    }
    throw e
  }

  // Log admin action
  await logAdminAction(
    adminCheck.userId!,
    'delete_post',
    {
      postTitle: post.title,
      creatorId: post.creatorId,
      ownerId: post.ownerId,
      inscriptionId: post.inscriptionId
    },
    'post',
    postId
  )

  revalidatePath('/')
  revalidatePath('/admin')

  return { success: true, message: `Deleted post: ${post.title}` }
}

// Set user admin status
export async function setAdminStatus(formData: FormData) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.isAdmin) {
    return { error: adminCheck.error }
  }

  const username = formData.get('username') as string
  const isAdmin = formData.get('isAdmin') === 'true'

  if (!username) {
    return { error: 'Username required' }
  }

  const targetUser = await prisma.user.findUnique({
    where: { username }
  })

  if (!targetUser) {
    return { error: 'User not found' }
  }

  // Atomic: re-verify admin + update in same transaction to prevent TOCTOU race
  try {
    await prisma.$transaction(async (tx) => {
      await verifyAdminInTx(tx, adminCheck.userId!)
      await tx.user.update({
        where: { id: targetUser.id },
        data: { isAdmin }
      })
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Admin privileges revoked') {
      return { error: 'Not authorized' }
    }
    throw e
  }

  // Log admin action
  await logAdminAction(
    adminCheck.userId!,
    isAdmin ? 'grant_admin' : 'revoke_admin',
    {
      targetUsername: username,
      newStatus: isAdmin
    },
    'user',
    targetUser.id
  )

  revalidatePath('/admin')

  return { success: true, message: `${isAdmin ? 'Granted' : 'Revoked'} admin for @${username}` }
}

// Get all users for admin
export async function getAllUsers() {
  const adminCheck = await requireAdmin()
  if (!adminCheck.isAdmin) {
    return { error: adminCheck.error, users: [] }
  }

  // M8: Bounded admin query
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      cachedBalance: true,
      cachedLockedAmount: true,
      walletAddress: true,
      walletType: true,
      isAdmin: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
          locks: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 1000
  })

  return { users }
}

// Get all posts for admin
export async function getAllPosts() {
  const adminCheck = await requireAdmin()
  if (!adminCheck.isAdmin) {
    return { error: adminCheck.error, posts: [] }
  }

  // M8: Bounded admin query
  const posts = await prisma.post.findMany({
    select: {
      id: true,
      title: true,
      totalTu: true,
      forSale: true,
      salePrice: true,
      inscriptionId: true,
      inscriptionTxid: true,
      createdAt: true,
      creator: { select: { username: true } },
      owner: { select: { username: true } },
      _count: {
        select: { locks: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 1000
  })

  return { posts }
}

// Check if current user is admin
export async function checkIsAdmin() {
  const session = await getSession()
  if (!session) {
    return { isAdmin: false }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true }
  })

  return { isAdmin: user?.isAdmin || false }
}

// Get current block info from real blockchain
export async function getBlockInfo() {
  try {
    const currentBlock = await getCurrentBlockHeight()
    return { currentBlock, network: 'mainnet' }
  } catch {
    // Fallback to cached value
    const cached = await prisma.blockchainState.findUnique({
      where: { id: 'singleton' }
    })
    return {
      currentBlock: cached?.currentBlock || 0,
      network: cached?.network || 'mainnet',
      cached: true
    }
  }
}

// Get all locks for admin
export async function getAllLocks() {
  const adminCheck = await requireAdmin()
  if (!adminCheck.isAdmin) {
    return { error: adminCheck.error, locks: [] }
  }

  // M8: Bounded admin query
  const locks = await prisma.lock.findMany({
    select: {
      id: true,
      amount: true,
      satoshis: true,
      durationBlocks: true,
      remainingBlocks: true,
      initialTu: true,
      currentTu: true,
      tag: true,
      expired: true,
      txid: true,
      lockAddress: true,
      createdAt: true,
      user: { select: { username: true } },
      post: { select: { id: true, title: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 1000
  })

  return { locks }
}

// Delete a specific lock record (admin only)
// NOTE: This only deletes the database record - the on-chain lock remains until timelock expires
export async function deleteLock(formData: FormData) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.isAdmin) {
    return { error: adminCheck.error }
  }

  const lockId = formData.get('lockId') as string

  if (!lockId) {
    return { error: 'Lock ID required' }
  }

  const lock = await prisma.lock.findUnique({
    where: { id: lockId },
    include: { user: true, post: true }
  })

  if (!lock) {
    return { error: 'Lock not found' }
  }

  // On mainnet, we can't refund - just delete the record
  // The on-chain lock remains until the timelock expires
  // Atomic: re-verify admin inside transaction to prevent TOCTOU race
  try {
    await prisma.$transaction(async (tx) => {
      await verifyAdminInTx(tx, adminCheck.userId!)
      await tx.lock.delete({ where: { id: lockId } })
      await tx.transaction.create({
        data: {
          action: 'Admin',
          amount: lock.amount,
          txid: lock.txid,
          description: `Admin deleted lock record (on-chain lock unaffected)`,
          userId: lock.userId,
          postId: lock.postId
        }
      })

      // Recalculate totalTu inside the transaction to prevent race conditions
      const remainingLocks = await tx.lock.findMany({
        where: { postId: lock.postId, expired: false }
      })
      const totalTu = remainingLocks.reduce((sum, l) => sum + l.currentTu, 0)
      await tx.post.update({
        where: { id: lock.postId },
        data: { totalTu }
      })
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Admin privileges revoked') {
      return { error: 'Not authorized' }
    }
    throw e
  }

  // Log admin action
  await logAdminAction(
    adminCheck.userId!,
    'delete_lock',
    {
      lockAmount: lock.amount,
      lockSatoshis: lock.satoshis,
      lockTxid: lock.txid,
      lockerUsername: lock.user.username,
      postId: lock.postId,
      postTitle: lock.post.title
    },
    'lock',
    lockId
  )

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath(`/post/${lock.postId}`)

  return {
    success: true,
    message: `Deleted lock record by @${lock.user.username}. Note: On-chain lock is unaffected.`
  }
}

// Get audit logs for admin review
export async function getAuditLogs(options?: {
  limit?: number
  action?: string
  adminId?: string
}) {
  const adminCheck = await requireAdmin()
  if (!adminCheck.isAdmin) {
    return { error: adminCheck.error, logs: [] }
  }

  const { limit = 100, action, adminId } = options || {}

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      ...(action && { action }),
      ...(adminId && { adminId })
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 500) // Cap at 500 to prevent abuse
  })

  // Fetch admin usernames for display
  const adminIds = Array.from(new Set(logs.map((log: { adminId: string }) => log.adminId)))
  const admins = await prisma.user.findMany({
    where: { id: { in: adminIds } },
    select: { id: true, username: true }
  })
  const adminMap = new Map(admins.map(a => [a.id, a.username]))

  return {
    logs: logs.map((log: { adminId: string; details: string; id: string; action: string; targetType: string | null; targetId: string | null; ipAddress: string | null; userAgent: string | null; createdAt: Date }) => ({
      ...log,
      adminUsername: adminMap.get(log.adminId) || 'Unknown',
      details: JSON.parse(log.details)
    }))
  }
}
