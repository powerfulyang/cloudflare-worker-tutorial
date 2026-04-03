import { version } from '#/package.json'
import { z } from '@hono/zod-openapi'
import { every } from 'hono/combine'
import { contextStorage } from 'hono/context-storage'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { fromZodError } from 'zod-validation-error'
import { getAppInstance } from '@/core'
import { isAllowedOrigin } from '@/utils'

const app = getAppInstance().basePath('api')

app.use(contextStorage())

// first
app.use(
  '*',
  every(
    secureHeaders(),
    requestId(),
    logger(),
    cors({
      origin: (origin) => {
        if (isAllowedOrigin(origin)) {
          return origin
        }
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      exposeHeaders: ['authorization'],
      allowHeaders: ['authorization', 'content-type'],
      maxAge: 86400,
    }),
  ),
)

// second

// service middleware
app.use('*', async (ctx, next) => {
  if (ctx.req.path.startsWith('/api/test/')) {
    await next()
    return
  }

  const { AuthService } = await import('@/service/auth.service')
  ctx.set('authService', new AuthService())
  await next()
})

app.get('/test/ping', (ctx) => {
  return ctx.json({ ok: true })
})

// Error handler
app.onError((error, ctx) => {
  console.error(error)
  if (error instanceof z.ZodError) {
    return ctx.json(
      {
        error: fromZodError(error).toString(),
        source: 'zod_error_handler',
      },
      422,
    )
  }
  if (error instanceof HTTPException) {
    return ctx.json(
      {
        error: error.message,
        source: 'status_error_handler',
      },
      error.status,
    )
  }
  return ctx.json(
    {
      error: error.message,
      source: 'error_handler',
    },
    500,
  )
})

app.doc31('doc', {
  openapi: '3.1.0',
  info: {
    version,
    title: 'Eleven API',
  },
})

export default app
