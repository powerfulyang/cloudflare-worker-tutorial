import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { getPrismaInstance } from '@/core/prisma'

describe('getPrismaInstance', () => {
  it('should return a valid PrismaClient instance', async () => {
    const prisma = getPrismaInstance(env.DB)
    expect(prisma).toBeDefined()
    expect(prisma.record).toBeDefined()
    expect(prisma.user).toBeDefined()
  })

  it('should use D1 adapter correctly', async () => {
    const prisma = getPrismaInstance(env.DB)
    const count = await prisma.record.count()
    expect(typeof count).toBe('number')
  })
})
