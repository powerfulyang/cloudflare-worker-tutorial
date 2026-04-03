import type { User } from '#/prisma/client'
import type { RequestIdVariables } from 'hono/request-id'
import type { RequestServices } from '@/core/request-services'
import { OpenAPIHono } from '@hono/zod-openapi'

export interface AppEnv {
  Bindings: Bindings
  Variables: {
    services: RequestServices
    user: User
  } & RequestIdVariables
}

export function getAppInstance() {
  return new OpenAPIHono<AppEnv>()
}
