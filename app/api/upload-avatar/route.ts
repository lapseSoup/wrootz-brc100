import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { validateImageFile, getExtensionForType, isAllowedImageType } from '@/app/lib/file-validation'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('avatar') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // First check MIME type (quick filter)
    if (!isAllowedImageType(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate file content using magic numbers
    const validation = validateImageFile(buffer, file.type)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid image file' },
        { status: 400 }
      )
    }

    // Create avatars directory if it doesn't exist
    const avatarsDir = path.join(process.cwd(), 'public', 'avatars')
    if (!existsSync(avatarsDir)) {
      await mkdir(avatarsDir, { recursive: true })
    }

    // Generate unique filename using detected type (not claimed extension)
    const ext = getExtensionForType(validation.detectedType!)
    const filename = `${session.userId}-${Date.now()}.${ext}`
    const filepath = path.join(avatarsDir, filename)

    // Save the file
    await writeFile(filepath, buffer)

    // Return the public URL
    const avatarUrl = `/avatars/${filename}`

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    )
  }
}
