import { env } from 'cloudflare:workers'
import { expect } from 'vitest'
import app from '@/index'

describe('test-endpoint', () => {
	it('ping test endpoint', async () => {
		const res = await app.request('/api/test/ping', undefined, env)
		const body = await res.json<{ ok: boolean }>()

		expect(res.status).toBe(200)
		expect(body.ok).toBe(true)
	})
})
