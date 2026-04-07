import { env } from 'cloudflare:workers'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it } from 'vitest'
import { createTestServices } from '@/../tests/helpers/test-services'

describe('recordService', () => {
  it('should throw 404 when record not found', async () => {
    const { recordService } = createTestServices({ env })
    await expect(recordService.findById('non-existent-id')).rejects.toThrow(HTTPException)
    try {
      await recordService.findById('non-existent-id')
    }
    catch (error) {
      expect((error as HTTPException).status).toBe(404)
    }
  })

  it('should create and return formatted record', async () => {
    const { recordService } = createTestServices({ env })
    const testData = { message: 'hello', count: 123 }
    const result = await recordService.upsert('test-record-service-1', testData)
    expect(result.id).toBe('test-record-service-1')
    expect(result.data).toEqual(testData)
    expect(typeof result.createdAt).toBe('string')
    expect(typeof result.updatedAt).toBe('string')
  })

  it('should update existing record', async () => {
    const { recordService } = createTestServices({ env })
    const initialData = { status: 'initial' }
    await recordService.upsert('test-record-service-2', initialData)
    const updatedData = { status: 'updated', extra: 'field' }
    const result = await recordService.upsert('test-record-service-2', updatedData)
    expect(result.data).toEqual(updatedData)
  })

  it('should find and return formatted record', async () => {
    const { recordService } = createTestServices({ env })
    const testData = { key: 'value', nested: { deep: true } }
    await recordService.upsert('test-record-service-3', testData)
    const result = await recordService.findById('test-record-service-3')
    expect(result.data).toEqual(testData)
    expect(result.data.nested.deep).toBe(true)
  })
})
