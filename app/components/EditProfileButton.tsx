'use client'

import { useState, useRef } from 'react'
import { updateBio, updateAvatar } from '@/app/actions/profile'

interface EditProfileButtonProps {
  currentBio: string
  currentAvatarUrl: string
}

export default function EditProfileButton({ currentBio, currentAvatarUrl }: EditProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [bio, setBio] = useState(currentBio)
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl)
  const [avatarPreview, setAvatarPreview] = useState(currentAvatarUrl)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_BIO_LENGTH = 160

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: JPG, PNG, GIF, WebP')
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('File too large. Maximum size is 2MB')
      return
    }

    setError('')
    setPendingFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const uploadFile = async (file: File): Promise<string | null> => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      return data.avatarUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      let finalAvatarUrl = avatarUrl

      // Upload file if there's a pending file
      if (pendingFile) {
        const uploadedUrl = await uploadFile(pendingFile)
        if (!uploadedUrl) {
          setLoading(false)
          return
        }
        finalAvatarUrl = uploadedUrl
      }

      // Update bio if changed
      if (bio !== currentBio) {
        const bioResult = await updateBio(bio)
        if (bioResult.error) {
          setError(bioResult.error)
          setLoading(false)
          return
        }
      }

      // Update avatar if changed
      if (finalAvatarUrl !== currentAvatarUrl) {
        const avatarResult = await updateAvatar(finalAvatarUrl || null)
        if (avatarResult.error) {
          setError(avatarResult.error)
          setLoading(false)
          return
        }
      }

      setIsOpen(false)
    } catch {
      setError('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarUrl('')
    setAvatarPreview('')
    setPendingFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setAvatarUrl(url)
    setAvatarPreview(url)
    setPendingFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary text-sm"
      >
        Edit Profile
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit Profile</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Avatar Section */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Profile Picture
                </label>

                {/* Preview */}
                <div className="flex items-center gap-4 mb-3">
                  {avatarPreview ? (
                    // Using native img for preview - has onError handler for failed loads
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview}
                      alt="Preview"
                      className="w-16 h-16 rounded-full object-cover bg-[var(--background)]"
                      onError={() => setAvatarPreview('')}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xl font-bold">
                      ?
                    </div>
                  )}
                  {avatarPreview && (
                    <button
                      onClick={handleRemoveAvatar}
                      className="text-sm text-[var(--error)] hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex gap-2 mb-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="avatar-upload"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="btn-secondary text-sm cursor-pointer inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Image
                  </label>
                  {pendingFile && (
                    <span className="text-sm text-[var(--muted)] self-center">
                      {pendingFile.name}
                    </span>
                  )}
                </div>

                {/* URL Input */}
                <div className="relative">
                  <span className="text-xs text-[var(--muted)] block mb-1">Or enter image URL:</span>
                  <input
                    type="url"
                    value={pendingFile ? '' : avatarUrl}
                    onChange={handleUrlChange}
                    placeholder="https://example.com/image.jpg"
                    className="input w-full text-sm"
                    disabled={!!pendingFile}
                  />
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">
                  JPG, PNG, GIF, or WebP. Max 2MB.
                </p>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people about yourself..."
                  className="input w-full resize-none"
                  rows={3}
                  maxLength={MAX_BIO_LENGTH}
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  {bio.length}/{MAX_BIO_LENGTH} characters
                </p>
              </div>

              {error && (
                <p className="text-sm text-[var(--error)]">{error}</p>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary"
                  disabled={loading || uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={loading || uploading}
                >
                  {uploading ? 'Uploading...' : loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
