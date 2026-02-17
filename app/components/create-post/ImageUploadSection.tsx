'use client'

import { useState, useRef } from 'react'

interface ImageUploadSectionProps {
  uploadedImageUrl: string | null
  setUploadedImageUrl: (url: string | null) => void
  imageUrl: string
  setImageUrl: (url: string) => void
  useImageUrl: boolean
  setUseImageUrl: (use: boolean) => void
}

export default function ImageUploadSection({
  uploadedImageUrl,
  setUploadedImageUrl,
  imageUrl,
  setImageUrl,
  useImageUrl,
  setUseImageUrl
}: ImageUploadSectionProps) {
  const [, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const uploadIdRef = useRef(0)

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Track this upload to detect if a newer upload supersedes it
    const thisUploadId = ++uploadIdRef.current

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

      // Only update if this is still the latest upload
      if (thisUploadId === uploadIdRef.current) {
        setUploadedImageUrl(data.imageUrl)
      }
    } catch (err) {
      if (thisUploadId === uploadIdRef.current) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
        setImageFile(null)
        setImagePreview(null)
      }
    } finally {
      if (thisUploadId === uploadIdRef.current) {
        setUploading(false)
      }
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setUploadedImageUrl(null)
    setUploadError('')
  }

  return (
    <div>
      <label className="label" id="image-upload-label">Image (optional)</label>

      <div className="flex items-center gap-4 mb-3" role="radiogroup" aria-labelledby="image-upload-label">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="imageType"
            checked={!useImageUrl}
            onChange={() => setUseImageUrl(false)}
            className="accent-[var(--primary)]"
            aria-label="Upload image"
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
            aria-label="Use image URL"
          />
          <span className="text-sm">Use URL</span>
        </label>
      </div>

      {uploadError && (
        <div
          className="mb-3 p-2 rounded-lg text-sm text-[var(--danger)]"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
          role="alert"
        >
          {uploadError}
        </div>
      )}

      {!useImageUrl ? (
        <div>
          {imagePreview ? (
            <div className="relative">
              {/* Using native img for upload preview - dynamic base64/blob URL */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Upload preview"
                className="w-full max-h-64 object-contain rounded-lg bg-[var(--background)]"
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <div className="text-white text-sm font-medium" aria-live="polite">Uploading...</div>
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
                aria-label="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-[var(--card-border)] rounded-lg cursor-pointer hover:border-[var(--primary)] transition-colors">
              <svg className="w-8 h-8 text-[var(--muted)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-[var(--muted)]">Click to upload image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                aria-label="Choose image file"
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
          aria-label="Image URL"
        />
      )}
    </div>
  )
}

export { ImageUploadSection }
