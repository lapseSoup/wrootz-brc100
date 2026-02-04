/**
 * File validation utilities using magic number detection
 * This provides actual content validation, not just MIME type checking
 */

// Magic number signatures for allowed image types
const IMAGE_SIGNATURES: { type: string; signature: number[]; offset?: number }[] = [
  // JPEG: starts with FF D8 FF
  { type: 'image/jpeg', signature: [0xFF, 0xD8, 0xFF] },
  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  { type: 'image/png', signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  // GIF87a: starts with 47 49 46 38 37 61
  { type: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
  // GIF89a: starts with 47 49 46 38 39 61
  { type: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
  // WebP: starts with 52 49 46 46 ... 57 45 42 50 (RIFF...WEBP)
  { type: 'image/webp', signature: [0x52, 0x49, 0x46, 0x46] },
]

// Additional WebP validation (need to check bytes 8-11 for "WEBP")
const WEBP_SECONDARY_SIGNATURE = [0x57, 0x45, 0x42, 0x50] // WEBP
const WEBP_SECONDARY_OFFSET = 8

export interface FileValidationResult {
  valid: boolean
  detectedType: string | null
  error?: string
}

/**
 * Validates file content by checking magic numbers
 * @param buffer - The file buffer to validate
 * @param claimedType - The MIME type claimed by the client
 * @returns Validation result with detected type
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function validateImageFile(buffer: Buffer, _claimedType: string): FileValidationResult {
  if (buffer.length < 12) {
    return {
      valid: false,
      detectedType: null,
      error: 'File too small to be a valid image',
    }
  }

  for (const sig of IMAGE_SIGNATURES) {
    const offset = sig.offset || 0
    let matches = true

    for (let i = 0; i < sig.signature.length; i++) {
      if (buffer[offset + i] !== sig.signature[i]) {
        matches = false
        break
      }
    }

    if (matches) {
      // Special handling for WebP - need to check secondary signature
      if (sig.type === 'image/webp') {
        let webpMatches = true
        for (let i = 0; i < WEBP_SECONDARY_SIGNATURE.length; i++) {
          if (buffer[WEBP_SECONDARY_OFFSET + i] !== WEBP_SECONDARY_SIGNATURE[i]) {
            webpMatches = false
            break
          }
        }
        if (!webpMatches) {
          continue // Not actually a WebP file
        }
      }

      return {
        valid: true,
        detectedType: sig.type,
      }
    }
  }

  return {
    valid: false,
    detectedType: null,
    error: 'File content does not match any allowed image format',
  }
}

/**
 * Get the correct file extension for a detected image type
 */
export function getExtensionForType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  return extensions[mimeType] || 'bin'
}

/**
 * List of allowed MIME types for images
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/**
 * Check if a MIME type is in the allowed list
 */
export function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType)
}
