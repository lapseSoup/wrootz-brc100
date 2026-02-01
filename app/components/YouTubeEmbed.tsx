'use client'

interface YouTubeEmbedProps {
  url: string
  title?: string
}

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    // Standard watch URLs: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([^&]+)/,
    // Short URLs: youtu.be/VIDEO_ID
    /youtu\.be\/([^?&]+)/,
    // Embed URLs: youtube.com/embed/VIDEO_ID
    /youtube\.com\/embed\/([^?&]+)/,
    // Mobile URLs: m.youtube.com/watch?v=VIDEO_ID
    /m\.youtube\.com\/watch\?v=([^&]+)/,
    // YouTube Shorts: youtube.com/shorts/VIDEO_ID
    /youtube\.com\/shorts\/([^?&]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
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
