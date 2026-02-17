'use server'

import prisma from '@/app/lib/db'
import { getSession } from '@/app/lib/session'
import { MAX_POST_LENGTH } from '@/app/lib/constants'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { notifyFollowersOfNewPost, notifyReplyCreated } from '../notifications'
import { withIdempotencyAndLocking, generateIdempotencyKey } from '@/app/lib/idempotency'
import { verifyInscription } from '@/app/lib/blockchain-verify'
import { checkStrictRateLimit } from '@/app/lib/server-action-rate-limit'
import crypto from 'crypto'

/**
 * Create a new post with optional inscription data and reply link.
 */
export async function createPost(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: 'You must be logged in to create a post' }
  }

  const rateLimit = await checkStrictRateLimit('createPost')
  if (!rateLimit.success) {
    return { error: `Too many attempts. Please try again in ${rateLimit.resetInSeconds} seconds.` }
  }

  const title = formData.get('title') as string
  const body = formData.get('body') as string
  const lockerSharePercentage = parseFloat(formData.get('lockerSharePercentage') as string) || 10
  const imageUrl = formData.get('imageUrl') as string | null
  const videoUrl = formData.get('videoUrl') as string | null

  // Inscription data (required for mainnet)
  const inscriptionTxid = formData.get('inscriptionTxid') as string | null
  const inscriptionId = formData.get('inscriptionId') as string | null
  const contentHash = formData.get('contentHash') as string | null

  // Reply/link parameter (optional)
  const replyToPostId = formData.get('replyToPostId') as string | null

  if (!body) {
    return { error: 'Body is required' }
  }

  // Title is optional for replies
  if (!title && !replyToPostId) {
    return { error: 'Title is required' }
  }

  if (title && title.length > 200) {
    return { error: 'Title must be 200 characters or less' }
  }

  // Validate URLs if provided
  if (imageUrl) {
    try {
      new URL(imageUrl)
    } catch {
      return { error: 'Invalid image URL' }
    }
    if (imageUrl.length > 2048) {
      return { error: 'Image URL too long (max 2048 characters)' }
    }
  }
  if (videoUrl) {
    try {
      new URL(videoUrl)
    } catch {
      return { error: 'Invalid video URL' }
    }
    if (videoUrl.length > 2048) {
      return { error: 'Video URL too long (max 2048 characters)' }
    }
    // Only allow YouTube URLs (must match CSP frame-src allowlist)
    const youtubePattern = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//
    if (!youtubePattern.test(videoUrl)) {
      return { error: 'Only YouTube video URLs are supported' }
    }
  }

  // Require inscription for mainnet posts
  if (!inscriptionTxid || !inscriptionId) {
    return { error: 'Posts must be inscribed on-chain. Please connect your wallet.' }
  }

  // S2: Verify inscription exists on-chain and is a valid ordinal
  // Retry up to 3 times with exponential backoff to handle transient WhatsOnChain timeouts
  let inscriptionCheck = await verifyInscription(inscriptionTxid)
  if (!inscriptionCheck.txExists) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await new Promise(resolve => setTimeout(resolve, attempt * 1500))
      inscriptionCheck = await verifyInscription(inscriptionTxid)
      if (inscriptionCheck.txExists) break
    }
  }
  if (!inscriptionCheck.txExists) {
    return { error: 'Inscription transaction not found on blockchain. Please wait a moment and try again.' }
  }
  if (!inscriptionCheck.isOrdinal) {
    return { error: 'Transaction is not a valid ordinal inscription.' }
  }

  // S3: Verify contentHash matches actual post content if provided
  if (contentHash) {
    const computedHash = crypto
      .createHash('sha256')
      .update(`${title || ''}${body}`)
      .digest('hex')
    if (computedHash !== contentHash) {
      return { error: 'Content hash does not match the post content.' }
    }
  }

  // Use inscriptionTxid as idempotency key - prevents duplicate posts for same inscription
  const idempotencyKey = generateIdempotencyKey('createPost', inscriptionTxid)
  const idempotencyResult = await withIdempotencyAndLocking(idempotencyKey, async () => {
    // Check if post with this inscription already exists
    const existingPost = await prisma.post.findFirst({
      where: { inscriptionTxid }
    })
    if (existingPost) {
      return { postId: existingPost.id, duplicate: true }
    }

    // Verify reply target exists if specified
    let replyToPost = null
    if (replyToPostId) {
      replyToPost = await prisma.post.findUnique({
        where: { id: replyToPostId },
        select: { id: true, title: true, ownerId: true }
      })
      if (!replyToPost) {
        return { error: 'Reply target post not found' }
      }
    }

    if (body.length > MAX_POST_LENGTH) {
      return { error: `Post body must be ${MAX_POST_LENGTH} characters or less` }
    }

    if (lockerSharePercentage < 0 || lockerSharePercentage > 100) {
      return { error: 'Locker share percentage must be between 0 and 100' }
    }

    // Create the post with inscription data
    const post = await prisma.post.create({
      data: {
        title: title || '',  // Empty title allowed for replies
        body,
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        lockerSharePercentage,
        totalTu: 0,  // Starts with no wrootz until someone locks
        inscriptionTxid,
        inscriptionId,
        contentHash,
        creatorId: session.userId,
        ownerId: session.userId // Creator is initial owner
      }
    })

    // Create post link if this is a reply
    if (replyToPost) {
      await prisma.postLink.create({
        data: {
          type: 'reply',
          sourcePostId: post.id,
          targetPostId: replyToPost.id,
          creatorId: session.userId
        }
      })
    }

    // Record create transaction (with inscription txid)
    await prisma.transaction.create({
      data: {
        action: 'Create',
        amount: 0,
        txid: inscriptionTxid,
        confirmed: false,  // Will be confirmed on-chain
        description: `Created post: ${title || 'Reply'}`,
        userId: session.userId,
        postId: post.id
      }
    })

    // Notify followers of new post
    const creator = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { username: true }
    })
    if (creator) {
      // For replies, notify the parent post owner
      if (replyToPost) {
        await notifyReplyCreated(replyToPost.id, post.id, session.userId, creator.username)
      } else {
        // For regular posts, notify followers
        await notifyFollowersOfNewPost(session.userId, creator.username, post.id, title || '', body)
      }
    }

    return { postId: post.id }
  })

  // Handle idempotency result
  if (!idempotencyResult.success) {
    // Return cached result if duplicate with valid postId
    if (idempotencyResult.cached && 'postId' in idempotencyResult.cached) {
      revalidatePath('/')
      redirect(`/post/${idempotencyResult.cached.postId}`)
    }
    return { error: idempotencyResult.error }
  }

  // Check for error in result
  if ('error' in idempotencyResult.result) {
    return idempotencyResult.result
  }

  revalidatePath('/')
  redirect(`/post/${idempotencyResult.result.postId}`)
}
