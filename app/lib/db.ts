import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Always use cached Prisma client to prevent connection pool exhaustion
// This is important in BOTH development and production
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

// Cache the instance globally (fixed: now caches in all environments)
globalForPrisma.prisma = prisma

export default prisma
