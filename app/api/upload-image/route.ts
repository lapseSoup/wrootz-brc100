import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { validateImageFile, getExtensionForType, isAllowedImageType } from '@/app/lib/file-validation'

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type (quick filter)
    if (!isAllowedImageType(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
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

    // Generate unique filename using detected type (not user-provided extension)
    const ext = getExtensionForType(validation.detectedType!)
    const timestamp = Date.now()
    const randomId = crypto.randomBytes(8).toString('hex')
    const filename = `${timestamp}-${randomId}.${ext}`

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Write file
    const filePath = path.join(uploadsDir, filename)
    await writeFile(filePath, buffer)

    // Return the public URL
    const imageUrl = `/uploads/${filename}`

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
