# 单元测试实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 src/core, src/service, src/repository 模块添加完整的单元/集成测试覆盖

**Architecture:** 采用模块镜像结构（__tests__/ 目录），使用真实 D1/KV 环境进行集成测试，遵循 Repository → Service → Core 的依赖层级进行测试编写

**Tech Stack:** Vitest + @cloudflare/vitest-pool-workers + Prisma + D1 + KV

---

## Task 1: 配置调整

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: 修改 vitest.config.ts 添加 include 配置**

```typescript
import { join } from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => {
  // Read all migrations in the `migrations` directory
  const migrationsPath = join(__dirname, 'migrations')
  const migrations = await readD1Migrations(migrationsPath)

  return {
    plugins: [
      cloudflareTest({
        isolatedStorage: true, // Use isolated storage for each worker, **important**
        wrangler: {
          configPath: './wrangler.toml',
        },
        miniflare: {
          // Add a test-only binding for migrations, so we can apply them in a
          // setup file
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
      tsconfigPaths(),
    ],
    test: {
      globals: true,
      setupFiles: ['./.vitest/apply-migrations.ts'],
      include: ['tests/**/*.spec.ts', 'src/**/__tests__/**/*.spec.ts'],
      exclude: ['tests/e2e'],
    },
  }
})
```

- [ ] **Step 2: 运行现有测试验证配置正确**

Run: `pnpm unit:test`
Expected: PASS (hash.spec.ts 通过)

---

## Task 2: 创建测试辅助工具

**Files:**
- Create: `tests/helpers/test-services.ts`

- [ ] **Step 1: 创建 __tests__ 目录和 helpers 目录**

Run:
```bash
mkdir -p src/core/__tests__
mkdir -p src/service/__tests__
mkdir -p src/repository/__tests__
mkdir -p tests/helpers
```

- [ ] **Step 2: 创建测试辅助工具文件**

```typescript
// tests/helpers/test-services.ts
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
```

- [ ] **Step 3: 验证辅助工具文件语法正确**

Run: `pnpm tsc-check`
Expected: PASS (无类型错误)

---

## Task 3: Repository 测试 - RecordRepository

**Files:**
- Create: `src/repository/__tests__/record.repository.spec.ts`

- [ ] **Step 1: 创建 RecordRepository 测试文件**

```typescript
// src/repository/__tests__/record.repository.spec.ts
import { describe, expect, it } from 'vitest'
import { getPrismaInstance } from '@/core/prisma'
import { RecordRepository } from '@/repository/record.repository'

describe('RecordRepository', () => {
  it('should return null when record not found', async () => {
    const { env } = await import('#/test-context')
    const prisma = getPrismaInstance(env.DB)
    const repo = new RecordRepository(prisma)

    const result = await repo.findById('non-existent-id')
    expect(result).toBeNull()
  })

  it('should create a new record via upsert', async () => {
    const { env } = await import('#/test-context')
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
    const { env } = await import('#/test-context')
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
    const { env } = await import('#/test-context')
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
```

- [ ] **Step 2: 运行测试验证通过**

Run: `pnpm unit:test src/repository/__tests__/record.repository.spec.ts`
Expected: PASS (4 tests)

---

## Task 4: Repository 测试 - UserRepository

**Files:**
- Create: `src/repository/__tests__/user.repository.spec.ts`

- [ ] **Step 1: 创建 UserRepository 测试文件**

```typescript
// src/repository/__tests__/user.repository.spec.ts
import { describe, expect, it } from 'vitest'
import { getPrismaInstance } from '@/core/prisma'
import { UserRepository } from '@/repository/user.repository'
import { testUserTemplate } from '@/../tests/helpers/test-services'

describe('UserRepository', () => {
  it('should return null when user not found by email', async () => {
    const { env } = await import('#/test-context')
    const prisma = getPrismaInstance(env.DB)
    const repo = new UserRepository(prisma)

    const result = await repo.findByEmail('non-existent@example.com')
    expect(result).toBeNull()
  })

  it('should create a new user', async () => {
    const { env } = await import('#/test-context')
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
    const { env } = await import('#/test-context')
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
    const { env } = await import('#/test-context')
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
    const { env } = await import('#/test-context')
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
```

- [ ] **Step 2: 运行测试验证通过**

Run: `pnpm unit:test src/repository/__tests__/user.repository.spec.ts`
Expected: PASS (5 tests)

---

## Task 5: Core 测试 - BaseService

**Files:**
- Create: `src/core/__tests__/base.service.spec.ts`

- [ ] **Step 1: 创建 BaseService 测试文件**

```typescript
// src/core/__tests__/base.service.spec.ts
import { describe, expect, it } from 'vitest'
import { BaseService, type ServiceDependencies } from '@/core/base.service'
import { testUserTemplate } from '@/../tests/helpers/test-services'

describe('BaseService', () => {
  it('should provide env getter', async () => {
    const { env } = await import('#/test-context')
    const deps: ServiceDependencies = {
      env,
      requestId: 'test-request-id',
    }

    const service = new BaseService(deps)

    expect(service['env']).toBe(env)
  })

  it('should provide requestId getter', async () => {
    const { env } = await import('#/test-context')
    const deps: ServiceDependencies = {
      env,
      requestId: 'specific-request-id',
    }

    const service = new BaseService(deps)

    expect(service['requestId']).toBe('specific-request-id')
  })

  it('should handle undefined requestId', async () => {
    const { env } = await import('#/test-context')
    const deps: ServiceDependencies = {
      env,
      requestId: undefined,
    }

    const service = new BaseService(deps)

    expect(service['requestId']).toBeUndefined()
  })

  it('should provide user getter', async () => {
    const { env } = await import('#/test-context')
    const deps: ServiceDependencies = {
      env,
      requestId: 'test-request-id',
      user: testUserTemplate,
    }

    const service = new BaseService(deps)

    expect(service['user']).toBe(testUserTemplate)
  })

  it('should handle undefined user', async () => {
    const { env } = await import('#/test-context')
    const deps: ServiceDependencies = {
      env,
      requestId: 'test-request-id',
      user: undefined,
    }

    const service = new BaseService(deps)

    expect(service['user']).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试验证通过**

Run: `pnpm unit:test src/core/__tests__/base.service.spec.ts`
Expected: PASS (5 tests)

---

## Task 6: Core 测试 - Prisma

**Files:**
- Create: `src/core/__tests__/prisma.spec.ts`

- [ ] **Step 1: 创建 Prisma 测试文件**

```typescript
// src/core/__tests__/prisma.spec.ts
import { describe, expect, it } from 'vitest'
import { getPrismaInstance } from '@/core/prisma'

describe('getPrismaInstance', () => {
  it('should return a valid PrismaClient instance', async () => {
    const { env } = await import('#/test-context')
    const prisma = getPrismaInstance(env.DB)

    expect(prisma).toBeDefined()
    expect(prisma.record).toBeDefined()
    expect(prisma.user).toBeDefined()
  })

  it('should use D1 adapter correctly', async () => {
    const { env } = await import('#/test-context')
    const prisma = getPrismaInstance(env.DB)

    // 验证可以执行简单查询（证明 D1 adapter 工作）
    const count = await prisma.record.count()
    expect(typeof count).toBe('number')
  })
})
```

- [ ] **Step 2: 运行测试验证通过**

Run: `pnpm unit:test src/core/__tests__/prisma.spec.ts`
Expected: PASS (2 tests)

---

## Task 7: Core 测试 - RequestServices

**Files:**
- Create: `src/core/__tests__/request-services.spec.ts`

- [ ] **Step 1: 创建 RequestServices 测试文件**

```typescript
// src/core/__tests__/request-services.spec.ts
import { describe, expect, it } from 'vitest'
import { createRequestServices } from '@/core/request-services'
import { AuthService } from '@/service/auth.service'
import { RecordService } from '@/service/record.service'

describe('createRequestServices', () => {
  it('should return object with authService and recordService', async () => {
    const { env } = await import('#/test-context')
    const services = createRequestServices({
      env,
      requestId: 'test-request-id',
    })

    expect(services).toHaveProperty('authService')
    expect(services).toHaveProperty('recordService')
  })

  it('should create AuthService instance', async () => {
    const { env } = await import('#/test-context')
    const services = createRequestServices({
      env,
      requestId: 'test-request-id',
    })

    expect(services.authService).toBeInstanceOf(AuthService)
  })

  it('should create RecordService instance', async () => {
    const { env } = await import('#/test-context')
    const services = createRequestServices({
      env,
      requestId: 'test-request-id',
    })

    expect(services.recordService).toBeInstanceOf(RecordService)
  })

  it('should handle optional requestId', async () => {
    const { env } = await import('#/test-context')
    const services = createRequestServices({
      env,
    })

    expect(services).toHaveProperty('authService')
    expect(services).toHaveProperty('recordService')
  })
})
```

- [ ] **Step 2: 运行测试验证通过**

Run: `pnpm unit:test src/core/__tests__/request-services.spec.ts`
Expected: PASS (4 tests)

---

## Task 8: Service 测试 - RecordService

**Files:**
- Create: `src/service/__tests__/record.service.spec.ts`

- [ ] **Step 1: 创建 RecordService 测试文件**

```typescript
// src/service/__tests__/record.service.spec.ts
import { describe, expect, it } from 'vitest'
import { HTTPException } from 'hono/http-exception'
import { createTestServices } from '@/../tests/helpers/test-services'

describe('RecordService', () => {
  it('should throw 404 when record not found', async () => {
    const { env } = await import('#/test-context')
    const { recordService } = createTestServices({ env })

    await expect(recordService.findById('non-existent-id'))
      .rejects.toThrow(HTTPException)

    try {
      await recordService.findById('non-existent-id')
    } catch (error) {
      expect((error as HTTPException).status).toBe(404)
    }
  })

  it('should create and return formatted record', async () => {
    const { env } = await import('#/test-context')
    const { recordService } = createTestServices({ env })

    const testData = { message: 'hello', count: 123 }
    const result = await recordService.upsert('test-record-service-1', testData)

    expect(result.id).toBe('test-record-service-1')
    expect(result.data).toEqual(testData)
    expect(typeof result.createdAt).toBe('string')
    expect(typeof result.updatedAt).toBe('string')
  })

  it('should update existing record', async () => {
    const { env } = await import('#/test-context')
    const { recordService } = createTestServices({ env })

    // 先创建
    const initialData = { status: 'initial' }
    await recordService.upsert('test-record-service-2', initialData)

    // 再更新
    const updatedData = { status: 'updated', extra: 'field' }
    const result = await recordService.upsert('test-record-service-2', updatedData)

    expect(result.data).toEqual(updatedData)
  })

  it('should find and return formatted record', async () => {
    const { env } = await import('#/test-context')
    const { recordService } = createTestServices({ env })

    // 先创建
    const testData = { key: 'value', nested: { deep: true } }
    await recordService.upsert('test-record-service-3', testData)

    // 再查找
    const result = await recordService.findById('test-record-service-3')

    expect(result.data).toEqual(testData)
    // 验证 JSON.parse 正确工作
    expect(result.data.nested.deep).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试验证通过**

Run: `pnpm unit:test src/service/__tests__/record.service.spec.ts`
Expected: PASS (4 tests)

---

## Task 9: Service 测试 - AuthService (JWT)

**Files:**
- Create: `src/service/__tests__/auth.service.spec.ts` (Part 1: JWT tests)

- [ ] **Step 1: 创建 AuthService 测试文件 - JWT 部分**

```typescript
// src/service/__tests__/auth.service.spec.ts
import { describe, expect, it, beforeEach } from 'vitest'
import { HTTPException } from 'hono/http-exception'
import { verify } from 'hono/jwt'
import { createTestServices, testUserTemplate } from '@/../tests/helpers/test-services'
import { AuthType } from '@/service/auth.service'
import { getPrismaInstance } from '@/core/prisma'
import { UserRepository } from '@/repository/user.repository'

describe('AuthService', () => {
  describe('JWT', () => {
    it('should sign JWT with user data', async () => {
      const { env } = await import('#/test-context')
      const { authService } = createTestServices({ env })

      const token = await authService.signJwt(testUserTemplate)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')

      // 验证 JWT 内容
      const decoded = await verify(token, env.JWT_SECRET, 'HS256')
      expect(decoded.user).toBeDefined()
      expect(decoded.user.email).toBe(testUserTemplate.email)
    })

    it('should verify JWT and return user', async () => {
      const { env } = await import('#/test-context')
      const { authService } = createTestServices({ env })

      // 先签名
      const token = await authService.signJwt(testUserTemplate)

      // 再验证
      const user = await authService.verifyJwt(token)

      expect(user).toBeDefined()
      expect(user.email).toBe(testUserTemplate.email)
      expect(user.id).toBe(testUserTemplate.id)
    })

    it('should use custom secret for signing', async () => {
      const { env } = await import('#/test-context')
      const { authService } = createTestServices({ env })

      const customSecret = 'custom-secret-123'
      const token = await authService.signJwt(testUserTemplate, customSecret)

      // 用自定义密钥验证
      const decoded = await verify(token, customSecret, 'HS256')
      expect(decoded.user.email).toBe(testUserTemplate.email)
    })

    it('should use custom secret for verifying', async () => {
      const { env } = await import('#/test-context')
      const { authService } = createTestServices({ env })

      const customSecret = 'custom-secret-456'
      const token = await authService.signJwt(testUserTemplate, customSecret)

      const user = await authService.verifyJwt(token, customSecret)
      expect(user.email).toBe(testUserTemplate.email)
    })
  })

  // OAuth and Ticket tests will be in subsequent tasks
})
```

- [ ] **Step 2: 运行测试验证通过**

Run: `pnpm unit:test src/service/__tests__/auth.service.spec.ts`
Expected: PASS (4 JWT tests)

---

## Task 10: Service 测试 - AuthService (OAuth Login)

**Files:**
- Modify: `src/service/__tests__/auth.service.spec.ts` (Add OAuth tests)

- [ ] **Step 1: 添加 OAuth 登录测试**

```typescript
// 在现有 auth.service.spec.ts 文件中添加

describe('OAuth Login', () => {
  it('should create new user on Google login', async () => {
    const { env } = await import('#/test-context')
    const { authService } = createTestServices({ env })
    const googleUser = {
      id: 'google-new-123',
      email: 'google-new@example.com',
      name: 'Google New User',
      picture: 'https://google.com/new-avatar.png',
    }

    const result = await authService.login(AuthType.GOOGLE, googleUser)

    expect(result.user).toBeDefined()
    expect(result.user.email).toBe(googleUser.email)
    expect(result.user.nickname).toBe(googleUser.name)
    expect(result.user.avatar).toBe(googleUser.picture)
    expect(result.user.googleId).toBe(googleUser.id)
    expect(result.token).toBeDefined()
  })

  it('should find existing user on Google login', async () => {
    const { env } = await import('#/test-context')
    const prisma = getPrismaInstance(env.DB)
    const userRepo = new UserRepository(prisma)
    const { authService } = createTestServices({ env })

    // 先创建一个用户
    await userRepo.create({
      email: 'google-existing@example.com',
      nickname: 'Existing User',
      googleId: 'google-existing-456',
    })

    // 再登录
    const googleUser = {
      id: 'google-existing-456',
      email: 'google-existing@example.com',
      name: 'Updated Name',
      picture: 'https://google.com/new-avatar.png',
    }

    const result = await authService.login(AuthType.GOOGLE, googleUser)

    expect(result.user.email).toBe(googleUser.email)
    expect(result.user.googleId).toBe(googleUser.id)
    expect(result.token).toBeDefined()
  })

  it('should create new user on Discord login', async () => {
    const { env } = await import('#/test-context')
    const { authService } = createTestServices({ env })
    const discordUser = {
      id: 'discord-new-789',
      email: 'discord-new@example.com',
      global_name: 'Discord New User',
      avatar: 'discord-avatar-hash',
    }

    const result = await authService.login(AuthType.DISCORD, discordUser)

    expect(result.user).toBeDefined()
    expect(result.user.email).toBe(discordUser.email)
    expect(result.user.nickname).toBe(discordUser.global_name)
    expect(result.user.discordId).toBe(discordUser.id)
    // 验证 avatar URL 格式正确
    expect(result.user.avatar).toContain('cdn.discordapp.com')
  })

  it('should create new user on GitHub login', async () => {
    const { env } = await import('#/test-context')
    const { authService } = createTestServices({ env })
    const githubUser = {
      id: 'github-new-101',
      email: 'github-new@example.com',
      name: 'GitHub New User',
      avatar_url: 'https://github.com/new-avatar.png',
    }

    const result = await authService.login(AuthType.GITHUB, githubUser)

    expect(result.user).toBeDefined()
    expect(result.user.email).toBe(githubUser.email)
    expect(result.user.nickname).toBe(githubUser.name)
    expect(result.user.avatar).toBe(githubUser.avatar_url)
    expect(result.user.githubId).toBe(githubUser.id)
  })

  it('should throw 400 when user data is missing', async () => {
    const { env } = await import('#/test-context')
    const { authService } = createTestServices({ env })

    await expect(authService.login(AuthType.GOOGLE, undefined))
      .rejects.toThrow(HTTPException)

    try {
      await authService.login(AuthType.GOOGLE, undefined)
    } catch (error) {
      expect((error as HTTPException).status).toBe(400)
    }
  })
})
```

- [ ] **Step 2: 运行测试验证通过**

Run: `pnpm unit:test src/service/__tests__/auth.service.spec.ts`
Expected: PASS (4 JWT + 5 OAuth = 9 tests)

---

## Task 11: Service 测试 - AuthService (Ticket)

**Files:**
- Modify: `src/service/__tests__/auth.service.spec.ts` (Add Ticket tests)

- [ ] **Step 1: 添加票据测试**

```typescript
// 在现有 auth.service.spec.ts 文件中添加

describe('Ticket', () => {
  it('should generate once ticket and store in KV', async () => {
    const { env } = await import('#/test-context')
    const { authService } = createTestServices({ env })

    const ticket = await authService.generateOnceTicket(testUserTemplate)

    expect(ticket).toBeDefined()
    expect(typeof ticket).toBe('string')
    // 验证 UUID 格式
    expect(ticket).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    // 验证 KV 存储
    const storedToken = await env.KV.get(`oauth:once:${ticket}`)
    expect(storedToken).toBeDefined()
  })

  it('should build ticket redirect URL', async () => {
    const { env } = await import('#/test-context')
    const { authService } = createTestServices({ env })

    const redirectUrl = 'https://client.example.com/callback'
    const result = await authService.buildTicketRedirectUrl(testUserTemplate, redirectUrl)

    expect(result).toContain(redirectUrl)
    expect(result).toContain('ticket=')
    // 验证 URL 格式正确
    const url = new URL(result)
    expect(url.searchParams.has('ticket')).toBe(true)
  })

  it('should check and consume once ticket', async () => {
    const { env } = await import('#/test-context')
    const { authService } = createTestServices({ env })

    // 生成票据
    const ticket = await authService.generateOnceTicket(testUserTemplate)

    // 第一次消费
    const token = await authService.checkOnceTicket(ticket)
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')

    // 验证票据已删除（一次性）
    const secondCheck = await authService.checkOnceTicket(ticket)
    expect(secondCheck).toBeNull()
  })

  it('should return null for non-existent ticket', async () => {
    const { env } = await import('#/test-context')
    const { authService } = createTestServices({ env })

    const result = await authService.checkOnceTicket('non-existent-ticket-uuid')

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: 运行完整 AuthService 测试**

Run: `pnpm unit:test src/service/__tests__/auth.service.spec.ts`
Expected: PASS (4 JWT + 5 OAuth + 4 Ticket = 13 tests)

---

## Task 12: 运行完整测试套件

- [ ] **Step 1: 运行所有单元测试**

Run: `pnpm unit:test`
Expected: PASS (所有测试通过)

测试数量统计：
- core/base.service.spec.ts: 5 tests
- core/prisma.spec.ts: 2 tests
- core/request-services.spec.ts: 4 tests
- service/auth.service.spec.ts: 13 tests
- service/record.service.spec.ts: 4 tests
- repository/user.repository.spec.ts: 5 tests
- repository/record.repository.spec.ts: 4 tests
- tests/hash.spec.ts: 1 test (已有)

总计: 38 tests

- [ ] **Step 2: 运行类型检查**

Run: `pnpm tsc-check`
Expected: PASS (无类型错误)

---

## Task 13: 提交代码

- [ ] **Step 1: 查看改动状态**

Run: `git status`
Expected: 显示所有新增和修改的文件

- [ ] **Step 2: 提交所有改动**

Run:
```bash
git add vitest.config.ts tests/helpers/test-services.ts src/core/__tests__ src/service/__tests__ src/repository/__tests__ docs/superpowers
git commit -m "feat: add unit tests for core, service, and repository modules

- Add vitest config to include src/**/__tests__/**/*.spec.ts
- Create test helper utilities for D1/KV integration testing
- Add RecordRepository tests (4 cases)
- Add UserRepository tests (5 cases)
- Add BaseService tests (5 cases)
- Add Prisma tests (2 cases)
- Add RequestServices tests (4 cases)
- Add RecordService tests (4 cases)
- Add AuthService tests: JWT (4), OAuth (5), Ticket (4)
- Add design spec and implementation plan docs
"
```

Expected: Commit successful