import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import { describe, expect, it } from 'vitest'
import { getServices, servicesMiddleware } from '@/core/request-services'
import { AuthService } from '@/service/auth.service'
import { RecordService } from '@/service/record.service'

interface TestEnv {
  Bindings: Bindings
  Variables: {
    services: { authService: AuthService, recordService: RecordService }
    requestId: string
  }
}

describe('servicesMiddleware', () => {
  it('should set services on context', async () => {
    const app = new Hono<TestEnv>()
    app.use('*', requestId())
    app.use('*', servicesMiddleware())
    app.get('/test', (ctx) => {
      const services = getServices(ctx as any)
      return ctx.json({
        hasAuth: !!services.authService,
        hasRecord: !!services.recordService,
      })
    })

    const res = await app.request('/test', undefined, env)
    const body = (await res.json()) as { hasAuth: boolean; hasRecord: boolean }
    expect(body.hasAuth).toBe(true)
    expect(body.hasRecord).toBe(true)
  })

  it('should create AuthService instance', async () => {
    const app = new Hono<TestEnv>()
    app.use('*', requestId())
    app.use('*', servicesMiddleware())
    app.get('/test', (ctx) => {
      const services = getServices(ctx as any)
      return ctx.json({
        isAuthService: services.authService instanceof AuthService,
      })
    })

    const res = await app.request('/test', undefined, env)
    const body = (await res.json()) as { isAuthService: boolean }
    expect(body.isAuthService).toBe(true)
  })

  it('should create RecordService instance', async () => {
    const app = new Hono<TestEnv>()
    app.use('*', requestId())
    app.use('*', servicesMiddleware())
    app.get('/test', (ctx) => {
      const services = getServices(ctx as any)
      return ctx.json({
        isRecordService: services.recordService instanceof RecordService,
      })
    })

    const res = await app.request('/test', undefined, env)
    const body = (await res.json()) as { isRecordService: boolean }
    expect(body.isRecordService).toBe(true)
  })
})
