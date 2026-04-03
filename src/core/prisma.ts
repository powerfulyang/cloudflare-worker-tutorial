import { PrismaClient } from '#/prisma/client/edge'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getD1 } from '@/core'

export function getPrismaInstance() {
  const d1 = getD1()
  const adapter = new PrismaD1(d1)
  return new PrismaClient({ adapter: adapter as any })
}
