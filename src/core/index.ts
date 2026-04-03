import type { User } from '#/prisma/client'
import type { RequestIdVariables } from 'hono/request-id'
import type { AuthService } from '@/service/auth.service'
import { OpenAPIHono } from '@hono/zod-openapi'
import { getContext } from 'hono/context-storage'

export function getCtx() {
  return getContext<AppEnv>()
}

export function getD1() {
  return getCtx().env.DB
}

export interface AppEnv {
  Bindings: Bindings
  Variables: {
    authService: AuthService
    user: User
  } & RequestIdVariables
}

export function getAppInstance() {
  return new OpenAPIHono<AppEnv>()
}
