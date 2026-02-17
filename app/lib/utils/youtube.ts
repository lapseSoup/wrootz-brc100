/**
 * Utility for extracting YouTube video IDs from various URL formats.
 */

const YOUTUBE_PATTERNS = [
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

/**
 * Extract a YouTube video ID from a URL.
 * Returns null if the URL is not a recognised YouTube URL.
 */
export function getYouTubeVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern)
    if (match && match[1]) return match[1]
  }
  return null
}
