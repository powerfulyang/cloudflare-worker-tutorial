import { z } from '@hono/zod-openapi'
import { event } from '~drizzle/schema/event'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

export const EventExtraFieldsSchema = z.array(
  z.object(
    {
      name: z.string(),
      displayName: z.string(),
      type: z
        .enum(
          ['text', 'number', 'time', 'radio', 'checkbox', 'picker'],
        ),
      enums: z
        .array(z.string())
        .optional(),
      userInput: z
        .boolean()
        .optional()
        .default(true),
      required: z
        .boolean()
        .optional()
        .default(true),
      defaultValue: z
        .string()
        .optional(),
      cascade: z
        .object({
          fieldName: z.string(),
          fieldValue: z.string(),
        })
        .optional(),
    },
  ),
)
  .optional()
  .default([])
  .openapi('EventExtraFields')

export const Event = createSelectSchema(event)
  .extend({
    extraFields: EventExtraFieldsSchema,
  })
  .openapi('Event')

export const EventPost = createInsertSchema(event)
  .extend({
    extraFields: EventExtraFieldsSchema,
  })
  .pick({
    name: true,
    displayName: true,
    icon: true,
    extraFields: true,
  })
  .openapi('EventPost')

export const EventPatch = Event
  .pick({
    id: true,
    name: true,
    displayName: true,
    icon: true,
    extraFields: true,
  })
  .partial({
    name: true,
    displayName: true,
    icon: true,
    extraFields: true,
  })
  .openapi('EventPatch')