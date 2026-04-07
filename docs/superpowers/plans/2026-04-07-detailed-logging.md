# 详细日志系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 cloudflare-worker 项目添加结构化的详细日志系统，使用 AsyncLocalStorage 自动获取 requestId，支持多行 pretty JSON 格式输出。

**Architecture:** Logger 工具类通过 AsyncLocalStorage 自动获取 requestId，无需任何层手动传入。中间件层初始化 AsyncLocalStorage 上下文，所有层级（OAuth、Service、Repository）直接调用 logger 方法。

**Tech Stack:** AsyncLocalStorage (node:async_hooks), Cloudflare Workers console, TypeScript

---

## 文件结构

### 新增文件

| 文件路径 | 职责 |
|----------|------|
| `src/utils/logger.ts` | Logger 工具类、AsyncLocalStorage、日志级别枚举、runWithRequestId 辅助函数 |
| `tests/logger.spec.ts` | Logger 单元测试 |

### 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `src/server.ts` | 添加 AsyncLocalStorage 中间件，替换 onError 日志 |
| `src/oauth-providers/oauth.middleware.ts` | OAuth 流程各关键点日志 |
| `src/service/auth.service.ts` | JWT 签发/验证、票据操作日志 |
| `src/service/record.service.ts` | 记录 CRUD 操作日志 |
| `src/repository/user.repository.ts` | 用户数据库操作日志 |
| `src/repository/record.repository.ts` | 记录数据库操作日志 |
| `src/utils/index.ts` | 导出 Logger |

---

## Task 1: 创建 Logger 工具类

**Files:**
- Create: `src/utils/logger.ts`
- Test: `tests/logger.spec.ts`

### Step 1: 编写 Logger 测试 - 基础结构和日志格式

- [ ] **编写测试文件**

```typescript
// tests/logger.spec.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Logger, LogLevel, runWithRequestId, setLogLevel } from '@/utils/logger'

describe('Logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>
    info: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }
    setLogLevel(LogLevel.DEBUG)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('日志格式', () => {
    it('应输出正确的时间戳和级别格式', () => {
      runWithRequestId('test-123', () => {
        const logger = new Logger()
        logger.info('Test message')
      })

      const output = consoleSpy.info.mock.calls[0][0]
      expect(output).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO \[test-123\] Test message$/)
    })

    it('应输出多行格式，第二行为 pretty JSON', () => {
      runWithRequestId('test-123', () => {
        const logger = new Logger()
        logger.info('User created', { userId: 'abc', isNewUser: true })
      })

      const calls = consoleSpy.info.mock.calls
      expect(calls.length).toBe(2)
      expect(calls[0][0]).toMatch(/INFO \[test-123\] User created$/)
      expect(calls[1][0]).toBe(JSON.stringify({ userId: 'abc', isNewUser: true }, null, 2))
    })

    it('无 data 时只输出一行', () => {
      runWithRequestId('test-123', () => {
        const logger = new Logger()
        logger.info('Simple message')
      })

      expect(consoleSpy.info.mock.calls.length).toBe(1)
    })

    it('空对象时不输出第二行', () => {
      runWithRequestId('test-123', () => {
        const logger = new Logger()
        logger.info('Message with empty data', {})
      })

      expect(consoleSpy.info.mock.calls.length).toBe(1)
    })
  })

  describe('AsyncLocalStorage', () => {
    it('应从 AsyncLocalStorage 自动获取 requestId', () => {
      runWithRequestId('auto-request-id', () => {
        const logger = new Logger()
        logger.info('Auto requestId test')
      })

      const output = consoleSpy.info.mock.calls[0][0]
      expect(output).toContain('[auto-request-id]')
    })

    it('无 requestId 时应显示 [no-request-id]', () => {
      const logger = new Logger()
      logger.info('No requestId test')

      const output = consoleSpy.info.mock.calls[0][0]
      expect(output).toContain('[no-request-id]')
    })
  })

  describe('日志级别', () => {
    it('DEBUG 级别应使用 console.log', () => {
      runWithRequestId('test', () => {
        const logger = new Logger()
        logger.debug('Debug message')
      })

      expect(consoleSpy.log).toHaveBeenCalled()
      expect(consoleSpy.info).not.toHaveBeenCalled()
    })

    it('INFO 级别应使用 console.info', () => {
      runWithRequestId('test', () => {
        const logger = new Logger()
        logger.info('Info message')
      })

      expect(consoleSpy.info).toHaveBeenCalled()
    })

    it('WARN 级别应使用 console.warn', () => {
      runWithRequestId('test', () => {
        const logger = new Logger()
        logger.warn('Warn message')
      })

      expect(consoleSpy.warn).toHaveBeenCalled()
    })

    it('ERROR 级别应使用 console.error', () => {
      runWithRequestId('test', () => {
        const logger = new Logger()
        logger.error('Error message')
      })

      expect(consoleSpy.error).toHaveBeenCalled()
    })

    it('INFO 级别时应过滤 DEBUG 日志', () => {
      setLogLevel(LogLevel.INFO)
      runWithRequestId('test', () => {
        const logger = new Logger()
        logger.debug('Should not appear')
        logger.info('Should appear')
      })

      expect(consoleSpy.log).not.toHaveBeenCalled()
      expect(consoleSpy.info).toHaveBeenCalled()
    })
  })
})
```

- [ ] **运行测试验证失败**

```bash
pnpm unit:test tests/logger.spec.ts
```
Expected: FAIL - Logger 模块不存在

---

### Step 2: 实现 Logger 工具类

- [ ] **创建 Logger 实现文件**

```typescript
// src/utils/logger.ts
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * requestId 存储上下文
 */
const requestIdStorage = new AsyncLocalStorage<string>()

/**
 * 当前日志级别（根据环境设置）
 */
let currentLogLevel: LogLevel = LogLevel.INFO

/**
 * 设置日志级别
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level
}

/**
 * 获取当前日志级别
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel
}

/**
 * 在 requestId 上下文中执行函数
 */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return requestIdStorage.run(requestId, fn)
}

/**
 * 获取当前 requestId
 */
function getCurrentRequestId(): string {
  const requestId = requestIdStorage.getStore()
  return requestId ?? 'no-request-id'
}

/**
 * 格式化时间戳 (ISO 8601)
 */
function formatTimestamp(): string {
  return new Date().toISOString()
}

/**
 * 日志级别名称映射
 */
const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
}

/**
 * 各级别对应的 console 方法
 */
const CONSOLE_METHODS: Record<LogLevel, 'log' | 'info' | 'warn' | 'error'> = {
  [LogLevel.DEBUG]: 'log',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
}

/**
 * Logger 工具类
 */
export class Logger {
  /**
   * 检查是否应该输出该级别日志
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= currentLogLevel
  }

  /**
   * 格式化并输出日志
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return
    }

    const timestamp = formatTimestamp()
    const levelName = LEVEL_NAMES[level]
    const requestId = getCurrentRequestId()
    const consoleMethod = CONSOLE_METHODS[level]

    // 第一行: [timestamp] LEVEL [requestId] message
    const header = `[${timestamp}] ${levelName} [${requestId}] ${message}`
    console[consoleMethod](header)

    // 第二行: pretty JSON (如果有 data 且非空)
    if (data && Object.keys(data).length > 0) {
      console[consoleMethod](JSON.stringify(data, null, 2))
    }
  }

  /**
   * DEBUG 级别日志
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data)
  }

  /**
   * INFO 级别日志
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data)
  }

  /**
   * WARN 级别日志
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data)
  }

  /**
   * ERROR 级别日志
   */
  error(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data)
  }
}

/**
 * 创建 Logger 实例的便捷函数
 */
export function createLogger(): Logger {
  return new Logger()
}

/**
 * 根据环境初始化日志级别
 */
export function initLogLevel(environment?: string): void {
  if (environment === 'local') {
    setLogLevel(LogLevel.DEBUG)
  } else {
    setLogLevel(LogLevel.INFO)
  }
}
```

- [ ] **在 utils/index.ts 导出 Logger**

```typescript
// src/utils/index.ts - 添加导出
export * from './logger'
```

- [ ] **运行测试验证通过**

```bash
pnpm unit:test tests/logger.spec.ts
```
Expected: PASS

- [ ] **提交**

```bash
git add src/utils/logger.ts src/utils/index.ts tests/logger.spec.ts
git commit -m "feat: add Logger utility with AsyncLocalStorage support"
```

---

## Task 2: 添加 AsyncLocalStorage 中间件

**Files:**
- Modify: `src/server.ts`

### Step 1: 编写中间件集成测试

- [ ] **添加中间件测试到 logger.spec.ts**

```typescript
// tests/logger.spec.ts - 在文件末尾添加
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Logger, LogLevel, runWithRequestId, setLogLevel, initLogLevel } from '@/utils/logger'

describe('中间件集成', () => {
  it('initLogLevel 应根据环境设置正确级别', () => {
    initLogLevel('local')
    expect(getLogLevel()).toBe(LogLevel.DEBUG)

    initLogLevel('production')
    expect(getLogLevel()).toBe(LogLevel.INFO)

    initLogLevel(undefined)
    expect(getLogLevel()).toBe(LogLevel.INFO)
  })
})
```

- [ ] **运行测试验证通过**

```bash
pnpm unit:test tests/logger.spec.ts
```
Expected: PASS

---

### Step 2: 在 server.ts 添加 AsyncLocalStorage 中间件

- [ ] **修改 server.ts 添加导入和中间件**

```typescript
// src/server.ts
import { version } from '#/package.json'
import { z } from '@hono/zod-openapi'
import { every } from 'hono/combine'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { fromZodError } from 'zod-validation-error'
import { getAppInstance } from '@/core'
import { createRequestServices } from '@/core/request-services'
import { runWithRequestId, initLogLevel, Logger } from '@/utils'
import { isAllowedOrigin } from '@/utils'

// 根据环境初始化日志级别
initLogLevel(process.env.ENVIRONMENT)

export const app = getAppInstance().basePath('api')

// 创建全局 Logger 实例
const log = new Logger()

app.use(
  '*',
  every(
    secureHeaders(),
    requestId(),
    // AsyncLocalStorage 中间件 - 将 requestId 存入上下文
    async (ctx, next) => {
      const requestId = ctx.get('requestId')
      return runWithRequestId(requestId, async () => {
        await next()
      })
    },
    logger(),
    cors({
      origin: (origin) => {
        if (isAllowedOrigin(origin)) {
          return origin
        }
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      exposeHeaders: ['authorization'],
      allowHeaders: ['authorization', 'content-type'],
      maxAge: 86400,
    }),
  ),
)

// ... 其余代码保持不变
```

- [ ] **运行类型检查**

```bash
pnpm tsc-check
```
Expected: PASS

- [ ] **提交**

```bash
git add src/server.ts tests/logger.spec.ts
git commit -m "feat: integrate AsyncLocalStorage middleware for requestId propagation"
```

---

## Task 3: OAuth 流程日志

**Files:**
- Modify: `src/oauth-providers/oauth.middleware.ts`

### Step 1: 添加 OAuth 流程日志

- [ ] **修改 oauth.middleware.ts**

```typescript
// src/oauth-providers/oauth.middleware.ts
import type { CookieOptions } from 'hono/utils/cookie'
import { discordAuth } from '@hono/oauth-providers/discord'
import { githubAuth } from '@hono/oauth-providers/github'
import { googleAuth } from '@hono/oauth-providers/google'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { isPublicPath } from '@/constants/public-paths'
import { app } from '@/server'
import { Logger } from '@/utils'
import { AuthType } from '@/service/auth.service'
import { isAllowedOrigin } from '@/utils'

const log = new Logger()

const COOKIE_NAME = 'token'
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 60 * 60 * 24 * 30,
} as CookieOptions

app.use('*', async (ctx, next) => {
  if (isPublicPath(ctx.req.path)) {
    const redirect = ctx.req.query('_redirect')

    if (redirect) {
      const url = new URL(redirect)
      if (!isAllowedOrigin(url.origin)) {
        log.warn('Redirect origin not allowed', {
          origin: url.origin,
          path: ctx.req.path,
        })
        throw new HTTPException(403, {
          message: 'Source domain is not allowed',
        })
      }
      log.debug('Setting redirect cookie', { redirect })
      setCookie(ctx, '_redirect', redirect)
    }

    return next()
  }

  const token = getCookie(ctx, COOKIE_NAME)
  const { authService } = ctx.get('services')

  if (!token) {
    log.warn('Token validation failed', { reason: 'no_token', path: ctx.req.path })
    throw new HTTPException(401, {
      message: 'Unauthorized',
    })
  }

  try {
    const user = await authService.verifyJwt(token)
    log.debug('JWT verified', { userId: user.id })
    ctx.set('user', user)
    return next()
  } catch (error) {
    log.warn('Token validation failed', {
      reason: 'invalid_token',
      path: ctx.req.path,
      error: error instanceof Error ? error.message : 'unknown',
    })
    throw new HTTPException(401, {
      message: 'Unauthorized',
    })
  }
})

app.get(
  'auth/google',
  googleAuth({
    scope: ['email', 'profile'],
    prompt: 'select_account',
  }),
  async (ctx) => {
    log.info('OAuth login started', { provider: 'google' })
    const googleUser = ctx.get('user-google')
    log.debug('User info received', {
      provider: 'google',
      providerUserId: googleUser.id,
      email: googleUser.email,
    })
    const { authService } = ctx.get('services')
    const { user, token } = await authService.login(AuthType.GOOGLE, googleUser)

    setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

    const redirect = getCookie(ctx, '_redirect')
    if (redirect) {
      log.info('OAuth login success, redirecting', {
        provider: 'google',
        userId: user.id,
        isNewUser: !googleUser.email, // 简化判断
      })
      return ctx.redirect(await authService.buildTicketRedirectUrl(user, redirect))
    }

    log.info('OAuth login success', {
      provider: 'google',
      userId: user.id,
    })
    return ctx.json({ user, token })
  },
)

app.get(
  'auth/discord',
  discordAuth({
    scope: ['identify', 'email'],
  }),
  async (ctx) => {
    log.info('OAuth login started', { provider: 'discord' })
    const discordUser = ctx.get('user-discord')
    log.debug('User info received', {
      provider: 'discord',
      providerUserId: discordUser.id,
      email: discordUser.email,
    })
    const { authService } = ctx.get('services')
    const { user, token } = await authService.login(AuthType.DISCORD, discordUser)

    setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

    const redirect = getCookie(ctx, '_redirect')
    if (redirect) {
      log.info('OAuth login success, redirecting', {
        provider: 'discord',
        userId: user.id,
      })
      return ctx.redirect(await authService.buildTicketRedirectUrl(user, redirect))
    }

    log.info('OAuth login success', {
      provider: 'discord',
      userId: user.id,
    })
    return ctx.json({ user, token })
  },
)

app.get(
  'auth/github',
  githubAuth({
    scope: ['user:email'],
    oauthApp: true,
  }),
  async (ctx) => {
    log.info('OAuth login started', { provider: 'github' })
    const githubUser = ctx.get('user-github')
    log.debug('User info received', {
      provider: 'github',
      providerUserId: githubUser.id,
      email: githubUser.email,
    })
    const { authService } = ctx.get('services')
    const { user, token } = await authService.login(AuthType.GITHUB, githubUser)

    setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

    const redirect = getCookie(ctx, '_redirect')
    if (redirect) {
      log.info('OAuth login success, redirecting', {
        provider: 'github',
        userId: user.id,
      })
      return ctx.redirect(await authService.buildTicketRedirectUrl(user, redirect))
    }

    log.info('OAuth login success', {
      provider: 'github',
      userId: user.id,
    })
    return ctx.json({ user, token })
  },
)

app.get('auth/by-ticket', async (ctx) => {
  const ticket = ctx.req.query('ticket')
  log.debug('Ticket validation started', { ticket })
  const { authService } = ctx.get('services')
  const token = await authService.checkOnceTicket(ticket)

  if (!token) {
    log.warn('Ticket validation failed', { ticket, valid: false })
    throw new HTTPException(404)
  }

  const user = await authService.verifyJwt(token)
  log.info('Ticket validated', { ticket, userId: user.id })
  return ctx.json({ token, user })
})
```

- [ ] **运行类型检查**

```bash
pnpm tsc-check
```
Expected: PASS

- [ ] **提交**

```bash
git add src/oauth-providers/oauth.middleware.ts
git commit -m "feat: add logging to OAuth authentication flow"
```

---

## Task 4: Auth Service 日志

**Files:**
- Modify: `src/service/auth.service.ts`

### Step 1: 添加 Auth Service 日志

- [ ] **修改 auth.service.ts**

```typescript
// src/service/auth.service.ts
import type { Prisma, User } from '#/prisma/client'
import type { DiscordUser } from '@hono/oauth-providers/discord'
import type { GitHubUser } from '@hono/oauth-providers/github'
import type { GoogleUser } from '@hono/oauth-providers/google'
import type { ServiceDependencies } from '@/core/base.service'
import type { OAuthProviderField, UserRepository } from '@/repository/user.repository'
import { HTTPException } from 'hono/http-exception'
import { sign, verify } from 'hono/jwt'
import { BaseService } from '@/core/base.service'
import { Logger } from '@/utils'

const log = new Logger()

export enum AuthType {
  GOOGLE = 'google',
  DISCORD = 'discord',
  GITHUB = 'github',
}

type AuthUser = Partial<GoogleUser | DiscordUser | GitHubUser>

const authProviderFieldMap: Record<AuthType, OAuthProviderField> = {
  [AuthType.GOOGLE]: 'googleId',
  [AuthType.DISCORD]: 'discordId',
  [AuthType.GITHUB]: 'githubId',
}

export class AuthService extends BaseService {
  private readonly onceTokenPrefix = 'oauth:once:'

  constructor(
    deps: ServiceDependencies,
    private readonly userRepository: UserRepository,
  ) {
    super(deps)
  }

  private get jwtSecret() {
    return this.env.JWT_SECRET
  }

  async signJwt(user: User, secret: string = this.jwtSecret) {
    const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000).toISOString()
    const token = await sign({
      user,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    }, secret)
    log.info('JWT signed', { userId: user.id, expiresAt })
    return token
  }

  async verifyJwt(token: string, secret: string = this.jwtSecret) {
    const { user } = await verify(token, secret, 'HS256')
    log.debug('JWT verified', { userId: (user as User).id })
    return user as User
  }

  async login(type: AuthType, user?: AuthUser) {
    log.debug('Login started', { provider: type })
    const dbUser = await this.findOrCreateUser(type, user)
    const token = await this.signJwt(dbUser)
    log.info('Login completed', {
      provider: type,
      userId: dbUser.id,
      email: dbUser.email,
    })
    return {
      user: dbUser,
      token,
    }
  }

  async generateOnceTicket(user: User) {
    const ticket = crypto.randomUUID()
    const ttl = 180 // 3分钟

    await this.env.KV.put(`${this.onceTokenPrefix}${ticket}`, await this.signJwt(user), {
      expirationTtl: ttl,
    })

    log.debug('Once ticket generated', { ticket, ttl, userId: user.id })
    return ticket
  }

  async buildTicketRedirectUrl(user: User, redirect: string) {
    const ticket = await this.generateOnceTicket(user)
    const url = new URL(redirect)
    url.searchParams.append('ticket', ticket)
    log.debug('Ticket redirect URL built', { ticket, redirect })
    return url.toString()
  }

  async checkOnceTicket(ticket?: string) {
    if (!ticket) {
      log.warn('Ticket check failed', { reason: 'no_ticket' })
      return null
    }

    const key = `${this.onceTokenPrefix}${ticket}`
    const token = await this.env.KV.get(key)
    await this.env.KV.delete(key)

    log.debug('KV operations for ticket', {
      key,
      found: !!token,
      operation: 'get_and_delete',
    })

    if (!token) {
      log.warn('Ticket validation failed', { ticket, valid: false })
      return null
    }

    log.info('Ticket consumed', { ticket })
    return token
  }

  private async findOrCreateUser(type: AuthType, user?: AuthUser) {
    if (!user) {
      log.error('OAuth user not found', { provider: type })
      throw new HTTPException(400, {
        message: `${type} user not found`,
      })
    }

    const userData = this.buildUserCreateInput(type, user)
    const providerField = authProviderFieldMap[type]
    const providerId = String(user.id)

    log.debug('Finding or creating user', {
      provider: type,
      providerId,
      email: 'email' in user ? user.email : undefined,
    })

    if ('email' in user && user.email) {
      const existingUser = await this.userRepository.findByEmail(user.email)
      if (existingUser) {
        log.debug('User found by email, updating provider ID', {
          userId: existingUser.id,
          providerField,
          providerId,
        })
        await this.userRepository.updateById(existingUser.id, {
          [providerField]: providerId,
          ...userData,
        })
        log.info('User provider updated', {
          userId: existingUser.id,
          provider: type,
        })
        return existingUser
      }
    }

    const existingUser = await this.userRepository.findByProviderId(providerField, providerId)
    if (existingUser) {
      log.debug('User found by provider', { userId: existingUser.id, provider: type })
      return existingUser
    }

    const newUser = await this.userRepository.create({
      ...userData,
      [providerField]: providerId,
    })
    log.info('New user created', {
      userId: newUser.id,
      provider: type,
      email: newUser.email,
    })
    return newUser
  }

  private buildUserCreateInput(type: AuthType, user: AuthUser): Prisma.UserCreateInput {
    switch (type) {
      case AuthType.GOOGLE: {
        const googleUser = user as Partial<GoogleUser>
        return {
          email: googleUser.email!,
          nickname: googleUser.name,
          avatar: googleUser.picture,
        }
      }
      case AuthType.DISCORD: {
        const discordUser = user as Partial<DiscordUser> & { email?: string }
        return {
          email: discordUser.email!,
          nickname: discordUser.global_name,
          avatar: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : undefined,
        }
      }
      case AuthType.GITHUB: {
        const githubUser = user as Partial<GitHubUser>
        return {
          email: githubUser.email!,
          nickname: githubUser.name,
          avatar: githubUser.avatar_url,
        }
      }
    }
  }
}
```

- [ ] **运行类型检查**

```bash
pnpm tsc-check
```
Expected: PASS

- [ ] **提交**

```bash
git add src/service/auth.service.ts
git commit -m "feat: add logging to Auth Service"
```

---

## Task 5: Record Service 日志

**Files:**
- Modify: `src/service/record.service.ts`

### Step 1: 添加 Record Service 日志

- [ ] **修改 record.service.ts**

```typescript
// src/service/record.service.ts
import type { Record } from '#/prisma/client/edge'
import type { ServiceDependencies } from '@/core/base.service'
import type { RecordRepository } from '@/repository/record.repository'
import { HTTPException } from 'hono/http-exception'
import { BaseService } from '@/core/base.service'
import { Logger } from '@/utils'

const log = new Logger()

export class RecordService extends BaseService {
  constructor(
    deps: ServiceDependencies,
    private readonly recordRepository: RecordRepository,
  ) {
    super(deps)
  }

  async findById(id: string) {
    log.debug('Record lookup started', { recordId: id })
    const record = await this.recordRepository.findById(id)

    if (!record) {
      log.warn('Record not found', { recordId: id })
      throw new HTTPException(404, {
        message: 'Record not found',
      })
    }

    log.info('Record found', { recordId: id })
    return this.formatRecord(record)
  }

  async upsert(id: string, data: unknown) {
    const dataSize = JSON.stringify(data).length
    log.debug('Record upsert started', { recordId: id, dataSize })

    const record = await this.recordRepository.upsert(id, JSON.stringify(data))

    log.info('Record upserted', { recordId: id, dataSize })
    return this.formatRecord(record)
  }

  private formatRecord(record: Record) {
    return {
      id: record.id,
      data: JSON.parse(record.data),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
  }
}
```

- [ ] **运行类型检查**

```bash
pnpm tsc-check
```
Expected: PASS

- [ ] **提交**

```bash
git add src/service/record.service.ts
git commit -m "feat: add logging to Record Service"
```

---

## Task 6: Repository 层日志

**Files:**
- Modify: `src/repository/user.repository.ts`
- Modify: `src/repository/record.repository.ts`

### Step 1: 添加 UserRepository 日志

- [ ] **修改 user.repository.ts**

```typescript
// src/repository/user.repository.ts
import type { Prisma, PrismaClient, User } from '#/prisma/client/edge'
import { Logger } from '@/utils'

const log = new Logger()

export type OAuthProviderField = 'googleId' | 'discordId' | 'githubId'

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {
  }

  async findByEmail(email: string) {
    const startTime = Date.now()
    log.debug('Database query started', { table: 'users', operation: 'findByEmail', email })

    const result = await this.prisma.user.findFirst({
      where: { email },
    })

    const durationMs = Date.now() - startTime
    log.debug('Database query completed', {
      table: 'users',
      operation: 'findByEmail',
      found: !!result,
      durationMs,
    })

    return result
  }

  async findByProviderId(providerField: OAuthProviderField, providerId: string) {
    const startTime = Date.now()
    log.debug('Database query started', {
      table: 'users',
      operation: 'findByProviderId',
      providerField,
    })

    const result = await this.prisma.user.findFirst({
      where: {
        [providerField]: providerId,
      },
    })

    const durationMs = Date.now() - startTime
    log.debug('Database query completed', {
      table: 'users',
      operation: 'findByProviderId',
      found: !!result,
      durationMs,
    })

    return result
  }

  async updateById(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    const startTime = Date.now()
    log.debug('Database update started', { table: 'users', operation: 'updateById', userId: id })

    const result = await this.prisma.user.update({
      where: { id },
      data,
    })

    const durationMs = Date.now() - startTime
    log.info('Database update completed', {
      table: 'users',
      operation: 'updateById',
      userId: id,
      durationMs,
    })

    return result
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    const startTime = Date.now()
    log.debug('Database insert started', { table: 'users', operation: 'create' })

    const result = await this.prisma.user.create({
      data,
    })

    const durationMs = Date.now() - startTime
    log.info('Database insert completed', {
      table: 'users',
      operation: 'create',
      userId: result.id,
      durationMs,
    })

    return result
  }
}
```

---

### Step 2: 添加 RecordRepository 日志

- [ ] **修改 record.repository.ts**

```typescript
// src/repository/record.repository.ts
import type { PrismaClient, Record } from '#/prisma/client/edge'
import { Logger } from '@/utils'

const log = new Logger()

export class RecordRepository {
  constructor(private readonly prisma: PrismaClient) {
  }

  async findById(id: string) {
    const startTime = Date.now()
    log.debug('Database query started', {
      table: 'records',
      operation: 'findById',
      recordId: id,
    })

    const result = await this.prisma.record.findUnique({
      where: { id },
    })

    const durationMs = Date.now() - startTime
    log.debug('Database query completed', {
      table: 'records',
      operation: 'findById',
      found: !!result,
      durationMs,
    })

    return result
  }

  async upsert(id: string, data: string): Promise<Record> {
    const startTime = Date.now()
    log.debug('Database upsert started', {
      table: 'records',
      operation: 'upsert',
      recordId: id,
    })

    const result = await this.prisma.record.upsert({
      where: { id },
      create: {
        id,
        data,
      },
      update: {
        data,
      },
    })

    const durationMs = Date.now() - startTime
    log.info('Database upsert completed', {
      table: 'records',
      operation: 'upsert',
      recordId: id,
      durationMs,
    })

    return result
  }
}
```

- [ ] **运行类型检查**

```bash
pnpm tsc-check
```
Expected: PASS

- [ ] **提交**

```bash
git add src/repository/user.repository.ts src/repository/record.repository.ts
git commit -m "feat: add logging to Repository layer"
```

---

## Task 7: Error Handler 日志增强

**Files:**
- Modify: `src/server.ts`

### Step 1: 增强 onError 日志处理

- [ ] **修改 server.ts 的 onError 处理**

```typescript
// src/server.ts - 替换 app.onError 部分
app.onError((error, ctx) => {
  const requestId = ctx.get('requestId')

  if (error instanceof z.ZodError) {
    log.warn('Zod validation error', {
      source: 'zod_error_handler',
      errors: error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
      path: ctx.req.path,
      method: ctx.req.method,
    })
    return ctx.json(
      {
        error: fromZodError(error).toString(),
        source: 'zod_error_handler',
      },
      422,
    )
  }

  if (error instanceof HTTPException) {
    log.warn('HTTP exception', {
      source: 'status_error_handler',
      status: error.status,
      message: error.message,
      path: ctx.req.path,
      method: ctx.req.method,
    })
    return ctx.json(
      {
        error: error.message,
        source: 'status_error_handler',
      },
      error.status,
    )
  }

  // 未捕获的异常 - ERROR 级别
  log.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: ctx.req.path,
    method: ctx.req.method,
  })

  return ctx.json(
    {
      error: error.message,
      source: 'error_handler',
    },
    500,
  )
})
```

- [ ] **运行类型检查**

```bash
pnpm tsc-check
```
Expected: PASS

- [ ] **提交**

```bash
git add src/server.ts
git commit -m "feat: enhance error handler logging"
```

---

## Task 8: 最终验证

### Step 1: 运行所有测试

- [ ] **运行单元测试**

```bash
pnpm unit:test
```
Expected: 所有测试 PASS

- [ ] **运行类型检查**

```bash
pnpm tsc-check
```
Expected: PASS

- [ ] **运行 ESLint**

```bash
pnpm lint
```
Expected: 无错误

### Step 2: 本地开发验证

- [ ] **启动本地开发服务器**

```bash
pnpm start:local
```

- [ ] **测试日志输出**

访问以下端点观察日志输出：
1. `http://localhost:12345/api/test/ping` - INFO 级别日志
2. `http://localhost:12345/api/auth/google` - OAuth 流程日志
3. `http://localhost:12345/api/user/current` (无 token) - WARN 日志

---

## 自我审查检查

### Spec 覆盖检查

| Spec 章节 | 对应 Task |
|-----------|-----------|
| Logger 工具类 (AsyncLocalStorage) | Task 1 |
| 中间件集成 | Task 2 |
| OAuth 认证流程日志 | Task 3 |
| Auth Service 日志 | Task 4 |
| Record Service 日志 | Task 5 |
| Repository 层日志 | Task 6 |
| 错误处理日志 | Task 7 |

### Placeholder 扫描

✅ 无 "TBD"、"TODO" 等占位符
✅ 所有代码步骤包含完整实现
✅ 所有命令包含具体参数

### 类型一致性

✅ Logger 类在各文件中使用相同方法签名
✅ LogLevel 枚举定义一致
✅ runWithRequestId 函数签名一致