import type { AppEnv } from '@/core'
import { getContext } from 'hono/context-storage'
import { getPrismaInstance } from '@/core/prisma'

export class BaseService {
  protected readonly prisma
  protected readonly jwtSecret
  protected readonly env
  protected readonly ctx

  constructor() {
    this.ctx = getContext<AppEnv>()
    this.env = this.ctx.env
    this.prisma = getPrismaInstance()
    this.jwtSecret = this.env.JWT_SECRET
  }
}
