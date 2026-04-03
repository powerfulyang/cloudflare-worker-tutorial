import { createRoute } from '@hono/zod-openapi'
import { getAppInstance } from '@/core'
import { JsonResponse } from '@/zodSchemas/JsonResponse'
import { UserResult } from '@/zodSchemas/User'

const GetCurrentUser = getAppInstance()

const route = createRoute({
  path: '/current',
  method: 'get',
  description: 'Get current user',
  responses: JsonResponse(UserResult),
})

GetCurrentUser.openapi(route, async (ctx) => {
  const user = ctx.get('user')

  return ctx.json(user)
})

export default GetCurrentUser
