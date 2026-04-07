import { env } from 'cloudflare:workers'
// src/repository/__tests__/user.repository.spec.ts
import { describe, expect, it } from 'vitest'
import { getPrismaInstance } from '@/core/prisma'
import { UserRepository } from '@/repository/user.repository'

describe('userRepository', () => {
  it('should return null when user not found by email', async () => {
    const prisma = getPrismaInstance(env.DB)
    const repo = new UserRepository(prisma)

    const result = await repo.findByEmail('non-existent@example.com')
    expect(result).toBeNull()
  })

  it('should create a new user', async () => {
    const prisma = getPrismaInstance(env.DB)
    const repo = new UserRepository(prisma)

    const result = await repo.create({
      email: 'create-test@example.com',
      nickname: 'Create Test User',
    })

    expect(result.email).toBe('create-test@example.com')
    expect(result.nickname).toBe('Create Test User')
    expect(result.id).toBeDefined()
  })

  it('should find user by email', async () => {
    const prisma = getPrismaInstance(env.DB)
    const repo = new UserRepository(prisma)

    // 先创建
    await repo.create({
      email: 'find-email@example.com',
      nickname: 'Find Email User',
    })

    // 再查找
    const result = await repo.findByEmail('find-email@example.com')

    expect(result).not.toBeNull()
    expect(result?.email).toBe('find-email@example.com')
  })

  it('should find user by provider id', async () => {
    const prisma = getPrismaInstance(env.DB)
    const repo = new UserRepository(prisma)

    // 先创建带 googleId 的用户
    await repo.create({
      email: 'find-provider@example.com',
      nickname: 'Find Provider User',
      googleId: 'google-test-123',
    })

    // 再查找
    const result = await repo.findByProviderId('googleId', 'google-test-123')

    expect(result).not.toBeNull()
    expect(result?.googleId).toBe('google-test-123')
  })

  it('should update user by id', async () => {
    const prisma = getPrismaInstance(env.DB)
    const repo = new UserRepository(prisma)

    // 先创建
    const created = await repo.create({
      email: 'update-test@example.com',
      nickname: 'Before Update',
    })

    // 再更新
    const result = await repo.updateById(created.id, {
      nickname: 'After Update',
      discordId: 'discord-test-456',
    })

    expect(result.nickname).toBe('After Update')
    expect(result.discordId).toBe('discord-test-456')
  })
})
