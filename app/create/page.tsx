'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createPost } from '@/app/actions/posts'
import { MAX_POST_LENGTH, LOCK_DURATION_PRESETS, DEFAULT_LOCK_AMOUNT_SATS } from '@/app/lib/constants'
import Link from 'next/link'
import { useWallet } from '@/app/components/WalletProvider'
import {
  ImageUploadSection,
  InitialLockSection,
  InscriptionStatus,
  ReplyContext
} from '@/app/components/create-post'

interface ReplyToPost {
  id: string
  title: string
  creator: { username: string }
}

export default function CreatePostPage() {
  const searchParams = useSearchParams()
  const replyToId = searchParams.get('replyTo')

  // Form state
  const [replyToPost, setReplyToPost] = useState<ReplyToPost | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [lockerShare, setLockerShare] = useState(10)
  const [videoUrl, setVideoUrl] = useState('')

  // Image state
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [useImageUrl, setUseImageUrl] = useState(false)

  // Lock state
  const [addInitialLock, setAddInitialLock] = useState(false)
  const [lockAmountSats, setLockAmountSats] = useState(String(DEFAULT_LOCK_AMOUNT_SATS))
  const [lockDuration, setLockDuration] = useState(LOCK_DURATION_PRESETS.find(p => p.default)?.blocks || 144)
  const [lockTag, setLockTag] = useState('')

  // UI state
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [inscriptionStatus, setInscriptionStatus] = useState<string | null>(null)

  // Wallet
  const { currentWallet: wallet, isConnected } = useWallet()

  // Fetch reply target post details if replyToId is set
  useEffect(() => {
    if (replyToId) {
      fetch(`/api/posts/${replyToId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setReplyToPost(data)
          }
        })
        .catch(() => {
          console.error('Failed to load reply target post:', replyToId)
        })
    }
  }, [replyToId])

  // Helper to hash content for verification
  async function hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError('')
    setInscriptionStatus(null)

    // Check wallet connection for inscription
    if (!isConnected || !wallet) {
      setError('Please connect your wallet to create posts')
      setLoading(false)
      return
    }

    try {
      // Get form values
      const titleValue = title.trim()
      const bodyValue = body.trim()
      const finalImageUrl = uploadedImageUrl || (useImageUrl ? imageUrl : null)

      // Validate
      if (!bodyValue) {
        setError('Content is required')
        setLoading(false)
        return
      }

      if (!titleValue && !replyToId) {
        setError('Title is required')
        setLoading(false)
        return
      }

      // Create the content to inscribe
      const inscriptionContent = {
        app: 'wrootz',
        type: 'post',
        title: titleValue || null,
        body: bodyValue,
        imageUrl: finalImageUrl,
        videoUrl: videoUrl.trim() || null,
        lockerSharePercentage: lockerShare,
        replyTo: replyToId || null,
        createdAt: new Date().toISOString()
      }

      // Convert to base64 for inscription
      const contentJson = JSON.stringify(inscriptionContent)
      const base64Data = btoa(unescape(encodeURIComponent(contentJson)))

      // Inscribe the content as a 1Sat Ordinal
      setInscriptionStatus('Waiting for wallet approval...')

      const inscriptionResult = await wallet.inscribe({
        base64Data,
        mimeType: 'application/json',
        map: {
          app: 'wrootz',
          type: 'post',
          title: titleValue || 'Reply'
        }
      })

      setInscriptionStatus('Inscription confirmed! Creating post...')

      // Now create the post in the database with the inscription data
      formData.set('title', titleValue)
      formData.set('body', bodyValue)
      formData.set('lockerSharePercentage', String(lockerShare))

      // Handle image
      if (finalImageUrl) {
        formData.set('imageUrl', finalImageUrl)
      }

      // Add video URL if provided
      if (videoUrl.trim()) {
        formData.set('videoUrl', videoUrl.trim())
      }

      // Add inscription data
      formData.set('inscriptionTxid', inscriptionResult.txid)
      formData.set('inscriptionId', inscriptionResult.origin)
      formData.set('contentHash', await hashContent(`${titleValue || ''}${bodyValue}`))

      // Add reply-to post ID if this is a reply
      if (replyToId) {
        formData.set('replyToPostId', replyToId)
      }

      // Note: Initial lock is disabled for mainnet - users can lock after post creation
      // This avoids complexity of coordinating inscription + lock in one flow

      const result = await createPost(formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      }
      // Success - createPost will redirect to the post page
    } catch (err) {
      console.error('Inscription error:', err)
      if (err instanceof Error) {
        if (err.message.includes('rejected') || err.message.includes('cancelled')) {
          setError('Inscription was cancelled')
        } else {
          setError(`Inscription failed: ${err.message}`)
        }
      } else {
        setError('Failed to inscribe content')
      }
      setLoading(false)
      setInscriptionStatus(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold mb-6">
          {replyToId ? 'Create Reply' : 'Create New Post'}
        </h1>

        <ReplyContext replyToPost={replyToPost} />

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="p-3 rounded-lg text-sm text-[var(--danger)]"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Wallet connection warning */}
          {!isConnected && (
            <div className="p-4 rounded-lg bg-[var(--warning)]/20 border border-[var(--warning)] text-sm" role="alert">
              <p className="font-medium text-[var(--warning)]">Wallet Required</p>
              <p className="text-[var(--muted)] mt-1">
                Posts on Wrootz are inscribed as 1Sat Ordinals on the BSV blockchain.
                Please connect your wallet (Yours Wallet) to create posts.
              </p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="post-title">
              Title {replyToId && <span className="text-[var(--muted)] font-normal">(optional for replies)</span>}
            </label>
            <input
              id="post-title"
              type="text"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder={replyToId ? "Optional title for your reply" : "Enter a title for your post"}
              maxLength={200}
              required={!replyToId}
              aria-required={!replyToId}
            />
          </div>

          <div>
            <label className="label" htmlFor="post-body">Content</label>
            <textarea
              id="post-body"
              name="body"
              className="input min-h-[200px] resize-y"
              placeholder="Write your content here..."
              maxLength={MAX_POST_LENGTH}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              aria-required="true"
              aria-describedby="body-char-count"
            />
            <p id="body-char-count" className="text-xs text-[var(--muted)] mt-1 text-right">
              {body.length}/{MAX_POST_LENGTH} characters
            </p>
          </div>

          <ImageUploadSection
            uploadedImageUrl={uploadedImageUrl}
            setUploadedImageUrl={setUploadedImageUrl}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            useImageUrl={useImageUrl}
            setUseImageUrl={setUseImageUrl}
          />

          {/* YouTube Video Section */}
          <div>
            <label className="label" htmlFor="video-url">YouTube Video (optional)</label>
            <input
              id="video-url"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="input"
              placeholder="https://www.youtube.com/watch?v=..."
              aria-describedby="video-help"
            />
            <p id="video-help" className="text-xs text-[var(--muted)] mt-1">
              Supports youtube.com, youtu.be, and YouTube Shorts links
            </p>
          </div>

          <div>
            <label className="label" htmlFor="locker-share">Locker Share Percentage</label>
            <div className="flex items-center gap-3">
              <input
                id="locker-share"
                type="range"
                min="0"
                max="100"
                value={lockerShare}
                onChange={(e) => setLockerShare(parseInt(e.target.value))}
                className="flex-1 accent-[var(--primary)]"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={lockerShare}
                aria-valuetext={`${lockerShare}%`}
              />
              <span className="text-sm font-medium w-12 text-right" aria-hidden="true">{lockerShare}%</span>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              The percentage of any sale that goes to users who locked BSV on your content
            </p>
          </div>

          <InitialLockSection
            addInitialLock={addInitialLock}
            setAddInitialLock={setAddInitialLock}
            lockAmountSats={lockAmountSats}
            setLockAmountSats={setLockAmountSats}
            lockDuration={lockDuration}
            setLockDuration={setLockDuration}
            lockTag={lockTag}
            setLockTag={setLockTag}
          />

          <div className="p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
            <h4 className="font-medium text-sm mb-2 text-[var(--foreground)]">How it works:</h4>
            <ul className="text-xs text-[var(--foreground)] opacity-80 space-y-1">
              <li>• You start as both the creator and owner of this content</li>
              <li>• Others can lock BSV to your content, boosting its visibility</li>
              <li>• If you sell the content, lockers get a share based on their wrootz</li>
              <li>• Higher locker share % incentivizes more curation</li>
            </ul>
          </div>

          <InscriptionStatus status={inscriptionStatus} />

          <div className="flex gap-3">
            <Link href="/" className="btn btn-secondary flex-1 text-center">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !isConnected}
              className="btn btn-primary flex-1"
              aria-busy={loading}
            >
              {loading ? (inscriptionStatus ? 'Inscribing...' : 'Creating...') :
               !isConnected ? 'Connect Wallet to Post' :
               replyToId ? 'Post Reply' : 'Create Post'}
            </button>
          </div>

          <p className="text-xs text-center text-[var(--muted)]">
            Your post will be permanently inscribed as a 1Sat Ordinal on BSV
          </p>
        </form>
      </div>
    </div>
  )
}
