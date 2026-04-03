import { z } from '@hono/zod-openapi'

export const UploadResult = z.object({
  id: z.number().int().positive(),
  url: z.string().url().optional(),
})
  .openapi('UploadResult')
