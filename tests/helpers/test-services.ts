import type { User } from '#/prisma/client/edge'
import { getPrismaInstance } from '@/core/prisma'
import { RecordRepository } from '@/repository/record.repository'
import { UserRepository } from '@/repository/user.repository'
import { AuthService } from '@/service/auth.service'
import { RecordService } from '@/service/record.service'

export interface TestServicesResult {
  userRepository: UserRepository
  recordRepository: RecordRepository
  authService: AuthService
  recordService: RecordService
}

/**
 * 创建测试用的 Services 和 Repositories
 * 使用真实 D1/KV bindings
 */
export function createTestServices({
  env,
  requestId = 'test-request-id',
}: {
  env: Bindings
  requestId?: string
}): TestServicesResult {
  const prisma = getPrismaInstance(env.DB)
  const userRepository = new UserRepository(prisma)
  const recordRepository = new RecordRepository(prisma)
  const serviceDeps = {
    env,
    requestId,
  }

  return {
    userRepository,
    recordRepository,
    authService: new AuthService(serviceDeps, userRepository),
    recordService: new RecordService(serviceDeps, recordRepository),
  }
}

/**
 * 测试用户数据模板
 */
export const testUserTemplate: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  nickname: 'Test User',
  avatar: 'https://example.com/avatar.png',
  googleId: null,
  discordId: null,
  githubId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

/**
 * Google OAuth 用户数据模板
 */
export const googleUserTemplate = {
  id: 'google-123',
  email: 'google@example.com',
  name: 'Google User',
  picture: 'https://google.com/avatar.png',
}

/**
 * Discord OAuth 用户数据模板
 */
export const discordUserTemplate = {
  id: 'discord-456',
  email: 'discord@example.com',
  global_name: 'Discord User',
  avatar: 'discord-avatar-hash',
}

/**
 * GitHub OAuth 用户数据模板
 */
export const githubUserTemplate = {
  id: 'github-789',
  email: 'github@example.com',
  name: 'GitHub User',
  avatar_url: 'https://github.com/avatar.png',
}
