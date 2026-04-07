import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv } from '@/core'
import type { AuthService } from '@/service/auth.service'
import type { RecordService } from '@/service/record.service'
import { getPrismaInstance } from '@/core/prisma'
import { RecordRepository } from '@/repository/record.repository'
import { UserRepository } from '@/repository/user.repository'
import { AuthService as AuthServiceClass } from '@/service/auth.service'
import { RecordService as RecordServiceClass } from '@/service/record.service'

export interface RequestServices {
  authService: AuthService
  recordService: RecordService
}

/**
 * 创建请求级别的服务实例
 */
function createRequestServices(env: Bindings, requestId?: string): RequestServices {
  const prisma = getPrismaInstance(env.DB)
  const userRepository = new UserRepository(prisma)
  const recordRepository = new RecordRepository(prisma)
  const serviceDeps = { env, requestId }

  return {
    authService: new AuthServiceClass(serviceDeps, userRepository),
    recordService: new RecordServiceClass(serviceDeps, recordRepository),
  }
}

/**
 * Middleware: 在每个请求开始时创建 services 并挂载到 ctx 上。
 * 所有 handler 通过 ctx.get('services') 获取。
 */
export function servicesMiddleware(): MiddlewareHandler<AppEnv> {
  return async (ctx, next) => {
    const services = createRequestServices(ctx.env, ctx.get('requestId'))
    ctx.set('services', services)
    await next()
  }
}

/**
 * 从 Hono Context 中获取 services 的类型安全辅助函数。
 * 仅在已经有 ctx 引用的 handler / middleware 中使用。
 */
export function getServices(ctx: Context<AppEnv>): RequestServices {
  return ctx.get('services')
}
