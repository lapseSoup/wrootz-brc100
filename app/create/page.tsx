'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createPost } from '@/app/actions/posts'
import { MAX_POST_LENGTH, LOCK_DURATION_PRESETS, DEFAULT_LOCK_AMOUNT_SATS, calculateWrootzFromSats } from '@/app/lib/constants'
import Link from 'next/link'
import TagInput from '@/app/components/TagInput'
import SatsInput from '@/app/components/SatsInput'
import { useWallet } from '@/app/components/WalletProvider'

interface ReplyToPost {
  id: string
  title: string
  creator: { username: string }
}

export default function CreatePostPage() {
  const searchParams = useSearchParams()
  const replyToId = searchParams.get('replyTo')
  const [replyToPost, setReplyToPost] = useState<ReplyToPost | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [body, setBody] = useState('')
  const [lockerShare, setLockerShare] = useState(10)
  const [, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [useImageUrl, setUseImageUrl] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  // Inscription state
  const [inscriptionStatus, setInscriptionStatus] = useState<string | null>(null)
  const { currentWallet: wallet, isConnected } = useWallet()

  // Initial lock state
  const [addInitialLock, setAddInitialLock] = useState(false)
  const [lockAmountSats, setLockAmountSats] = useState(String(DEFAULT_LOCK_AMOUNT_SATS))
  const [lockDuration, setLockDuration] = useState(LOCK_DURATION_PRESETS.find(p => p.default)?.blocks || 144)
  const [lockTag, setLockTag] = useState('')

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError('')
    setUploading(true)
    setImageFile(file)

    // Show preview immediately
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to server
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setUploadedImageUrl(data.imageUrl)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setImageFile(null)
      setImagePreview(null)
    } finally {
      setUploading(false)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setUploadedImageUrl(null)
    setUploadError('')
  }

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
        .catch(() => {})
    }
  }, [replyToId])

  // Calculate wrootz preview for initial lock
  const lockSatsNum = parseInt(lockAmountSats) || 0
  const wrootzPreview = lockSatsNum > 0 && lockDuration > 0
    ? calculateWrootzFromSats(lockSatsNum, lockDuration).toFixed(2)
    : '0'

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
      // We'll inscribe a JSON object with the post content
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
      formData.set('contentHash', await hashContent(contentJson))

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

  // Helper to hash content for verification
  async function hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold mb-6">
          {replyToId ? 'Create Reply' : 'Create New Post'}
        </h1>

        {/* Reply context */}
        {replyToPost && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--background)] border border-[var(--card-border)]">
            <p className="text-sm text-[var(--muted)] mb-1">Replying to:</p>
            <Link href={`/post/${replyToPost.id}`} className="font-medium text-[var(--primary)] hover:underline">
              {replyToPost.title || `Post by @${replyToPost.creator.username}`}
            </Link>
            <p className="text-xs text-[var(--muted)] mt-1">by @{replyToPost.creator.username}</p>
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg text-sm text-[var(--danger)]" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}>
              {error}
            </div>
          )}

          {/* Wallet connection warning */}
          {!isConnected && (
            <div className="p-4 rounded-lg bg-[var(--warning)]/20 border border-[var(--warning)] text-sm">
              <p className="font-medium text-[var(--warning)]">Wallet Required</p>
              <p className="text-[var(--muted)] mt-1">
                Posts on Wrootz are inscribed as 1Sat Ordinals on the BSV blockchain.
                Please connect your wallet (Yours Wallet) to create posts.
              </p>
            </div>
          )}

          <div>
            <label className="label">Title {replyToId && <span className="text-[var(--muted)] font-normal">(optional for replies)</span>}</label>
            <input
              type="text"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder={replyToId ? "Optional title for your reply" : "Enter a title for your post"}
              maxLength={200}
              required={!replyToId}
            />
          </div>

          <div>
            <label className="label">Content</label>
            <textarea
              name="body"
              className="input min-h-[200px] resize-y"
              placeholder="Write your content here..."
              maxLength={MAX_POST_LENGTH}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
            <p className="text-xs text-[var(--muted)] mt-1 text-right">
              {body.length}/{MAX_POST_LENGTH} characters
            </p>
          </div>

          {/* Image Section */}
          <div>
            <label className="label">Image (optional)</label>

            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="imageType"
                  checked={!useImageUrl}
                  onChange={() => setUseImageUrl(false)}
                  className="accent-[var(--primary)]"
                />
                <span className="text-sm">Upload image</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="imageType"
                  checked={useImageUrl}
                  onChange={() => setUseImageUrl(true)}
                  className="accent-[var(--primary)]"
                />
                <span className="text-sm">Use URL</span>
              </label>
            </div>

            {uploadError && (
              <div className="mb-3 p-2 rounded-lg text-sm text-[var(--danger)]" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}>
                {uploadError}
              </div>
            )}

            {!useImageUrl ? (
              <div>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full max-h-64 object-contain rounded-lg bg-[var(--background)]"
                    />
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                        <div className="text-white text-sm font-medium">Uploading...</div>
                      </div>
                    )}
                    {uploadedImageUrl && !uploading && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-[var(--accent)] text-white text-xs rounded-full">
                        Uploaded
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={removeImage}
                      disabled={uploading}
                      className="absolute top-2 right-2 p-1 bg-[var(--danger)] text-white rounded-full hover:opacity-90 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-[var(--card-border)] rounded-lg cursor-pointer hover:border-[var(--primary)] transition-colors">
                    <svg className="w-8 h-8 text-[var(--muted)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-[var(--muted)]">Click to upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            ) : (
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="input"
                placeholder="https://example.com/image.jpg"
              />
            )}
          </div>

          {/* YouTube Video Section */}
          <div>
            <label className="label">YouTube Video (optional)</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="input"
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              Supports youtube.com, youtu.be, and YouTube Shorts links
            </p>
          </div>

          <div>
            <label className="label">Locker Share Percentage</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={lockerShare}
                onChange={(e) => setLockerShare(parseInt(e.target.value))}
                className="flex-1 accent-[var(--primary)]"
              />
              <span className="text-sm font-medium w-12 text-right">{lockerShare}%</span>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              The percentage of any sale that goes to users who locked BSV on your content
            </p>
          </div>

          {/* Initial Lock Section */}
          <div className="border border-[var(--card-border)] rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={addInitialLock}
                onChange={(e) => setAddInitialLock(e.target.checked)}
                className="rounded accent-[var(--primary)]"
              />
              <span className="font-medium">Lock BSV on this post (optional)</span>
            </label>

            {addInitialLock && (
              <div className="space-y-3 pt-2 border-t border-[var(--card-border)]">
                <div>
                  <label className="label text-sm">Amount (sats)</label>
                  <SatsInput
                    value={lockAmountSats}
                    onChange={setLockAmountSats}
                    placeholder="10,000"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">
                    1 BSV = 100,000,000 sats
                  </p>
                </div>

                <div>
                  <label className="label text-sm">Lock Duration</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LOCK_DURATION_PRESETS.slice(0, 6).map((preset) => (
                      <button
                        key={preset.blocks}
                        type="button"
                        onClick={() => setLockDuration(preset.blocks)}
                        className={`p-2 rounded-lg text-xs border transition-colors ${
                          lockDuration === preset.blocks
                            ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                            : 'border-[var(--card-border)] hover:border-[var(--secondary)]'
                        }`}
                        style={lockDuration === preset.blocks ? { backgroundColor: 'rgba(59, 130, 246, 0.15)' } : {}}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label text-sm">Tag (optional)</label>
                  <TagInput
                    value={lockTag}
                    onChange={setLockTag}
                    placeholder="e.g., quality, art, meme"
                  />
                </div>

                <div className="p-3 rounded-lg text-center bg-[var(--accent)]">
                  <div className="text-xs text-white font-medium mb-1 opacity-90">You will generate</div>
                  <div className="text-2xl font-bold text-white">{wrootzPreview}</div>
                  <div className="text-sm text-white opacity-90">wrootz</div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
            <h4 className="font-medium text-sm mb-2 text-[var(--foreground)]">How it works:</h4>
            <ul className="text-xs text-[var(--foreground)] opacity-80 space-y-1">
              <li>• You start as both the creator and owner of this content</li>
              <li>• Others can lock BSV to your content, boosting its visibility</li>
              <li>• If you sell the content, lockers get a share based on their wrootz</li>
              <li>• Higher locker share % incentivizes more curation</li>
            </ul>
          </div>

          {/* Inscription status */}
          {inscriptionStatus && (
            <div className="p-4 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary)]">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
                <div>
                  <p className="font-medium text-[var(--primary)]">Inscribing to BSV Blockchain</p>
                  <p className="text-sm text-[var(--muted)]">{inscriptionStatus}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/" className="btn btn-secondary flex-1 text-center">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || uploading || !isConnected}
              className="btn btn-primary flex-1"
            >
              {loading ? (inscriptionStatus ? 'Inscribing...' : 'Creating...') :
               uploading ? 'Uploading image...' :
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
