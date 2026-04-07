import { env } from 'cloudflare:workers'
// src/repository/__tests__/record.repository.spec.ts
import { describe, expect, it } from 'vitest'
import { getPrismaInstance } from '@/core/prisma'
import { RecordRepository } from '@/repository/record.repository'

describe('recordRepository', () => {
  it('should return null when record not found', async () => {
    const prisma = getPrismaInstance(env.DB)
    const repo = new RecordRepository(prisma)

    const result = await repo.findById('non-existent-id')
    expect(result).toBeNull()
  })

  it('should create a new record via upsert', async () => {
    const prisma = getPrismaInstance(env.DB)
    const repo = new RecordRepository(prisma)

    const testData = JSON.stringify({ key: 'value', number: 42 })
    const result = await repo.upsert('test-record-1', testData)

    expect(result.id).toBe('test-record-1')
    expect(result.data).toBe(testData)
    expect(result.createdAt).toBeDefined()
    expect(result.updatedAt).toBeDefined()
  })

  it('should update existing record via upsert', async () => {
    const prisma = getPrismaInstance(env.DB)
    const repo = new RecordRepository(prisma)

    // 先创建
    const initialData = JSON.stringify({ status: 'initial' })
    await repo.upsert('test-record-2', initialData)

    // 再更新
    const updatedData = JSON.stringify({ status: 'updated' })
    const result = await repo.upsert('test-record-2', updatedData)

    expect(result.id).toBe('test-record-2')
    expect(result.data).toBe(updatedData)
  })

  it('should find existing record by id', async () => {
    const prisma = getPrismaInstance(env.DB)
    const repo = new RecordRepository(prisma)

    // 先创建
    const testData = JSON.stringify({ found: true })
    await repo.upsert('test-record-3', testData)

    // 再查找
    const result = await repo.findById('test-record-3')

    expect(result).not.toBeNull()
    expect(result?.id).toBe('test-record-3')
    expect(result?.data).toBe(testData)
  })
})
