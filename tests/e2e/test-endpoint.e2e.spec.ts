import { env } from 'cloudflare:workers'
import { expect } from 'vitest'
import { app } from '@/index'

describe('records endpoint', () => {
  it('creates and reads a record by uuid path', async () => {
    const id = crypto.randomUUID()
    const data = { message: 'hello', count: 1 }

    const postRes = await app.request(`/api/records/${id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ data }),
    }, env)

    expect(postRes.status).toBe(200)
    const postBody = await postRes.json<{
      id: string
      data: { message: string, count: number }
      createdAt: string
      updatedAt: string
    }>()
    expect(postBody.id).toBe(id)
    expect(postBody.data).toEqual(data)

    const getRes = await app.request(`/api/records/${id}`, undefined, env)

    expect(getRes.status).toBe(200)
    const getBody = await getRes.json<typeof postBody>()
    expect(getBody.id).toBe(id)
    expect(getBody.data).toEqual(data)
  })
})
