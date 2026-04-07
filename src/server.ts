import { version } from '#/package.json'
import { z } from '@hono/zod-openapi'
import { env } from 'cloudflare:workers'
import { every } from 'hono/combine'
import { contextStorage } from 'hono/context-storage'

import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { fromZodError } from 'zod-validation-error'
import { getAppInstance } from '@/core'

import { servicesMiddleware } from '@/core/request-services'
import { initLogLevel, isAllowedOrigin, Logger } from '@/utils'

// 根据环境初始化日志级别
initLogLevel(env.ENVIRONMENT)

const log = new Logger()

/**
 * 创建并配置 Hono 应用实例。
 * 包含所有全局中间件、错误处理和 OpenAPI 文档配置。
 */
export function createApp() {
  const app = getAppInstance().basePath('api')

  app.use(
    '*',
    every(
      secureHeaders(),
      requestId(),
      contextStorage(),
      servicesMiddleware(),
      async (ctx, next) => {
        const start = performance.now()
        await next()
        const ms = Math.round(performance.now() - start)
        log.info(`[${ctx.req.method}] ${ctx.req.path} - ${ctx.res.status} (${ms}ms)`)
      },
      cors({
        origin: (origin) => {
          if (isAllowedOrigin(origin)) {
            return origin
          }
        },
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        exposeHeaders: ['authorization'],
        allowHeaders: ['authorization', 'content-type'],
        credentials: true,
        maxAge: 86400,
      }),
    ),
  )

  app.get('/test/ping', (ctx) => {
    return ctx.json({ ok: true })
  })

  app.onError((error, ctx) => {
    if (error instanceof z.ZodError) {
      log.warn('Zod validation error', {
        source: 'zod_error_handler',
        errors: error.issues.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
        path: ctx.req.path,
        method: ctx.req.method,
      })
      return ctx.json(
        {
          error: fromZodError(error).toString(),
          source: 'zod_error_handler',
        },
        422,
      )
    }

    if (error instanceof HTTPException) {
      log.warn('HTTP exception', {
        source: 'status_error_handler',
        status: error.status,
        message: error.message,
        path: ctx.req.path,
        method: ctx.req.method,
      })
      return ctx.json(
        {
          error: error.message,
          source: 'status_error_handler',
        },
        error.status,
      )
    }

    // 未捕获的异常 - ERROR 级别
    log.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      path: ctx.req.path,
      method: ctx.req.method,
    })

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

  return app
}
