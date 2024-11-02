import { version } from '#/package.json'
import { getAppInstance } from '@/core'
import { AuthService } from '@/service/auth.service'
import { BabyService } from '@/service/baby.service'
import { z } from '@hono/zod-openapi'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from '@prisma/client'
import { every } from 'hono/combine'
import { contextStorage } from 'hono/context-storage'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { fromZodError } from 'zod-validation-error'

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
        if (origin.endsWith('.littleeleven.com')) {
          return origin
        }
        return 'https://littleeleven.com'
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      exposeHeaders: ['authorization'],
      allowHeaders: ['authorization', 'content-type'],
      maxAge: 86400,
    }),
  ),
)

// second
// 增加 prisma 的中间件
app.use('*', async (ctx, next) => {
  const adapter = new PrismaD1(ctx.env.DB)
  const prisma = new PrismaClient({ adapter })
  ctx.set('prisma', prisma)
  await next()
})

// service middleware
app.use('*', async (ctx, next) => {
  ctx.set('babyService', new BabyService())
  ctx.set('authService', new AuthService())
  await next()
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
