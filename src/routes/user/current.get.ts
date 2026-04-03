import { createRoute } from '@hono/zod-openapi'
import { getAppInstance } from '@/core'
import { JsonResponse } from '@/zodSchemas/JsonResponse'
import { UserResult } from '@/zodSchemas/User'

export const getCurrentUserRoute = getAppInstance()

const route = createRoute({
  path: '/current',
  method: 'get',
  description: 'Get current user',
  responses: JsonResponse(UserResult),
})

getCurrentUserRoute.openapi(route, async (ctx) => {
  const user = ctx.get('user')

  return ctx.json(user)
})
