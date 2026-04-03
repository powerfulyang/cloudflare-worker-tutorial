import { createRoute, z } from '@hono/zod-openapi'
import { getAppInstance } from '@/core'
import { JsonRequest } from '@/zodSchemas/JsonRequest'
import { JsonResponse } from '@/zodSchemas/JsonResponse'

export const recordRoute = getAppInstance()

const RecordParamsSchema = z.object({
  id: z.string().uuid(),
})

const RecordBodySchema = z.object({
  data: z.any(),
})

const RecordResponseSchema = z.object({
  id: z.string().uuid(),
  data: z.any(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const getRecordRoute = createRoute({
  path: '/{id}',
  method: 'get',
  description: 'Get a public record by UUID',
  request: {
    params: RecordParamsSchema,
  },
  responses: JsonResponse(RecordResponseSchema),
})

const postRecordRoute = createRoute({
  path: '/{id}',
  method: 'post',
  description: 'Create or update a public record by UUID',
  request: {
    params: RecordParamsSchema,
    body: JsonRequest(RecordBodySchema),
  },
  responses: JsonResponse(RecordResponseSchema),
})

recordRoute.openapi(getRecordRoute, async (ctx) => {
  const { id } = RecordParamsSchema.parse(ctx.req.param())
  const { recordService } = ctx.get('services')
  return ctx.json(await recordService.findById(id))
})

recordRoute.openapi(postRecordRoute, async (ctx) => {
  const { id } = RecordParamsSchema.parse(ctx.req.param())
  const { data } = RecordBodySchema.parse(await ctx.req.json())
  const { recordService } = ctx.get('services')
  return ctx.json(await recordService.upsert(id, data))
})
