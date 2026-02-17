'use client'

import { getYouTubeVideoId } from '@/app/lib/utils/youtube'

interface YouTubeEmbedProps {
  url: string
  title?: string
}

// Check if a URL is a valid YouTube URL
export function isYouTubeUrl(url: string): boolean {
  return getYouTubeVideoId(url) !== null
}

export default function YouTubeEmbed({ url, title }: YouTubeEmbedProps) {
  const videoId = getYouTubeVideoId(url)

  if (!videoId) {
    return (
      <div className="p-4 rounded-lg bg-[var(--surface-2)] text-center text-[var(--foreground-muted)]">
        Invalid YouTube URL
      </div>
    )
  }

  return (
    <div className="relative w-full pt-[56.25%] bg-black rounded-lg overflow-hidden">
      <iframe
        className="absolute inset-0 w-full h-full"
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title={title || 'YouTube video'}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}
