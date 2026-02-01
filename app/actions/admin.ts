'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { revalidatePath } from 'next/cache'
import { getCurrentBlockHeight } from '@/app/lib/blockchain'

// Check if current user is admin
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

// NOTE: grantBSV is disabled for mainnet - users get real BSV from their wallet
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function grantBSV(_formData: FormData) {
  return { error: 'Granting BSV is disabled on mainnet. Users must fund their wallets with real BSV.' }
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

  await prisma.post.delete({ where: { id: postId } })

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

  await prisma.user.update({
    where: { id: targetUser.id },
    data: { isAdmin }
  })

  revalidatePath('/admin')

  return { success: true, message: `${isAdmin ? 'Granted' : 'Revoked'} admin for @${username}` }
}

// NOTE: resetUserBalance is disabled for mainnet
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resetUserBalance(_formData: FormData) {
  return { error: 'Resetting balance is disabled on mainnet. User balances come from their connected wallets.' }
}

// NOTE: advanceBlocks is disabled for mainnet - blocks are real
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function advanceBlocks(_formData: FormData) {
  return { error: 'Block manipulation is disabled on mainnet. Blocks advance automatically on the BSV blockchain.' }
}

// Get all users for admin
export async function getAllUsers() {
  const adminCheck = await requireAdmin()
  if (!adminCheck.isAdmin) {
    return { error: adminCheck.error, users: [] }
  }

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
    orderBy: { createdAt: 'desc' }
  })

  return { users }
}

// Get all posts for admin
export async function getAllPosts() {
  const adminCheck = await requireAdmin()
  if (!adminCheck.isAdmin) {
    return { error: adminCheck.error, posts: [] }
  }

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
    orderBy: { createdAt: 'desc' }
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

// NOTE: setBlockHeight is disabled for mainnet
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function setBlockHeight(_formData: FormData) {
  return { error: 'Block height manipulation is disabled on mainnet. The blockchain determines block height.' }
}

// Get all locks for admin
export async function getAllLocks() {
  const adminCheck = await requireAdmin()
  if (!adminCheck.isAdmin) {
    return { error: adminCheck.error, locks: [] }
  }

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
    orderBy: { createdAt: 'desc' }
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
  await prisma.$transaction([
    prisma.lock.delete({ where: { id: lockId } }),
    prisma.transaction.create({
      data: {
        action: 'Admin',
        amount: lock.amount,
        txid: lock.txid,
        description: `Admin deleted lock record (on-chain lock unaffected)`,
        userId: lock.userId,
        postId: lock.postId
      }
    })
  ])

  // Update post totalTu
  const remainingLocks = await prisma.lock.findMany({
    where: { postId: lock.postId, expired: false }
  })
  const totalTu = remainingLocks.reduce((sum, l) => sum + l.currentTu, 0)
  await prisma.post.update({
    where: { id: lock.postId },
    data: { totalTu }
  })

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath(`/post/${lock.postId}`)

  return {
    success: true,
    message: `Deleted lock record by @${lock.user.username}. Note: On-chain lock is unaffected.`
  }
}
