import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import prisma from '@/app/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ count: 0 })
  }

  const count = await prisma.notification.count({
    where: {
      userId: session.userId,
      read: false
    }
  })

  return NextResponse.json({ count }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  })
}
