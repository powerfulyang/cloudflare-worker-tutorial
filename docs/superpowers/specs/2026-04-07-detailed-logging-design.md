# 详细日志系统设计

> 为 cloudflare-worker 项目添加结构化的详细日志系统

---

## 设计概述

### 目标

为 Cloudflare Workers API 后端服务添加详细日志系统，同时满足：
- **故障排查**：追踪认证失败、数据库错误、API 异常等问题
- **运营监控**：监控用户行为、API 调用频率、认证成功率等

### 核心特性

| 特性 | 方案 |
|------|------|
| requestId 获取 | AsyncLocalStorage 自动获取，无需手动传入 |
| namespace 支持 | Logger 构造函数可选参数，区分不同模块日志来源 |
| 日志级别 | DEBUG / INFO / WARN / ERROR 四级 |
| 日志格式 | 人类可读文本格式 |
| 输出目标 | console 输出（集成 Cloudflare observability） |
| 环境控制 | local=DEBUG，production=INFO |

---

## 架构设计

### 数据流

```
请求进入
    │
    ▼
┌─────────────────────────────────────────┐
│  中间件层                                │
│  - requestId 中间件生成唯一 ID           │
│  - AsyncLocalStorage.run(requestId)     │
│  - 所有后续代码在此上下文中执行          │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Logger 工具类                          │
│  - 自动从 AsyncLocalStorage 获取 ID     │
│  - logger.info('message', data)         │
│  - 无需任何层手动传入 requestId          │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  各层级使用                              │
│  - OAuth 中间件: 登录流程日志            │
│  - Service 层: 业务操作日志              │
│  - Repository 层: 数据库操作日志         │
│  - Error Handler: 异常日志               │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Console 输出                           │
│  - 自动集成 Cloudflare Logs             │
│  - observability 配置已启用             │
└─────────────────────────────────────────┘
```

---

## 核心组件

### 1. Logger 工具类 (`src/utils/logger.ts`)

```typescript
// 核心结构
import { AsyncLocalStorage } from 'node:async_hooks'

// requestId 存储
const requestIdStorage = new AsyncLocalStorage<string>()

// 日志级别枚举
enum LogLevel { DEBUG, INFO, WARN, ERROR }

// Logger 类
class Logger {
  constructor(namespace?: string)  // 可选 namespace，区分日志来源

  private getRequestId(): string | undefined {
    return requestIdStorage.getStore()
  }

  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void

  private formatOutput(level: LogLevel, message: string, data?: object): string
}

// 辅助函数
function runWithRequestId<T>(requestId: string, fn: () => T): T
```

### 2. 中间件集成 (`src/server.ts`)

```typescript
// 在现有中间件链中添加
app.use('*', async (ctx, next) => {
  const requestId = ctx.get('requestId')
  return runWithRequestId(requestId, async () => {
    await next()
  })
})
```

---

## 日志覆盖点

### OAuth 认证流程 (`src/oauth-providers/oauth.middleware.ts`)

| 操作 | 级别 | 日志内容 |
|------|------|----------|
| 登录开始 | INFO | `provider`, `redirect` |
| 用户信息获取 | DEBUG | `provider`, `providerUserId`, `email` |
| 登录成功 | INFO | `provider`, `userId`, `isNewUser` |
| 登录失败 | ERROR | `provider`, `error` |
| Token 验证失败 | WARN | `reason` (no_token/invalid) |
| 票据验证 | DEBUG | `ticket`, `valid` |

### Auth Service (`src/service/auth.service.ts`)

| 操作 | 级别 | 日志内容 |
|------|------|----------|
| JWT 签发 | INFO | `userId`, `expiresAt` |
| JWT 验证 | DEBUG | `userId` |
| 票据生成 | DEBUG | `ticket`, `ttl` |
| 票据消费 | INFO | `ticket`, `userId` |

### Record Service (`src/service/record.service.ts`)

| 操作 | 级别 | 日志内容 |
|------|------|----------|
| 记录查询 | INFO | `recordId`, `found` |
| 记录创建 | INFO | `recordId`, ` dataSize` |
| 记录更新 | INFO | `recordId`, `dataSize` |
| 记录不存在 | WARN | `recordId` |

### Repository 层

| 操作 | 级别 | 日志内容 |
|------|------|----------|
| 数据库查询 | DEBUG | `table`, `operation`, `durationMs` |
| 数据库写入 | INFO | `table`, `operation`, `recordId` |
| 数据库错误 | ERROR | `table`, `operation`, `error` |

### KV 操作

| 操作 | 级别 | 日志内容 |
|------|------|----------|
| KV put | DEBUG | `key`, `ttl` |
| KV get | DEBUG | `key`, `found` |
| KV delete | DEBUG | `key` |

### 错误处理 (`src/server.ts` - onError)

| 错误类型 | 级别 | 日志内容 |
|----------|------|----------|
| Zod 验证错误 | WARN | `errors`, `source` |
| HTTP 异常 | WARN | `status`, `message` |
| 未捕获异常 | ERROR | `error`, `stack`, `path`, `method` |

---

## 日志格式规范

### 格式模板

```
[timestamp] LEVEL [requestId] [namespace] message
{
  "key1": "value1",
  "key2": "value2"
}
```

日志分两行输出：
- **第一行**：基础信息（时间戳、级别、requestId、可选 namespace、消息）
- **第二行**：pretty JSON 格式的 data 对象（缩进2空格）

如果没有 namespace 则省略 `[namespace]` 部分。如果没有 data 对象，则只输出第一行。

### 示例输出

```
[2026-04-07T14:30:00.123Z] INFO [abc-123] [OAuth] Login started
{
  "provider": "google",
  "redirect": "https://example.com"
}

[2026-04-07T14:30:01.456Z] DEBUG [abc-123] [OAuth] User info received
{
  "provider": "google",
  "providerUserId": "12345",
  "email": "test@example.com"
}

[2026-04-07T14:30:02.789Z] INFO [abc-123] [AuthService] User created
{
  "userId": "xyz-789",
  "email": "test@example.com",
  "isNewUser": true
}

[2026-04-07T14:30:03.012Z] DEBUG [abc-123] [KV] Put operation
{
  "key": "oauth:once:ticket-abc",
  "ttl": 180
}

[2026-04-07T14:30:04.345Z] INFO [abc-123] [AuthService] JWT signed

[2026-04-07T14:30:05.678Z] WARN [abc-123] [OAuth] Token validation failed
{
  "reason": "no_token"
}

[2026-04-07T14:30:06.901Z] ERROR [abc-123] [UserRepository] Database query failed
{
  "table": "users",
  "operation": "findByEmail",
  "error": "ConnectionTimeout"
}
```

### data 对象处理规则

- 使用 `JSON.stringify(data, null, 2)` 格式化
- 如果 data 为 undefined/null 或空对象，则不输出第二行
- 嵌套对象正常展示
- 敏感信息：脱敏处理（如 email 部分隐藏）

---

## 日志级别控制

### 环境配置

```typescript
const LOG_LEVEL = ENVIRONMENT === 'local' ? LogLevel.DEBUG : LogLevel.INFO
```

| 环境 | 默认级别 | 说明 |
|------|----------|------|
| local | DEBUG | 开发环境，输出所有日志 |
| production | INFO | 生产环境，过滤 DEBUG 日志 |

### 级别过滤逻辑

```typescript
private shouldLog(level: LogLevel): boolean {
  return level >= LOG_LEVEL
}
```

---

## 实现文件清单

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `src/utils/logger.ts` | Logger 工具类、AsyncLocalStorage、日志级别 |

### 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `src/server.ts` | 添加 AsyncLocalStorage 中间件 |
| `src/oauth-providers/oauth.middleware.ts` | OAuth 流程日志 |
| `src/service/auth.service.ts` | Auth 服务日志 |
| `src/service/record.service.ts` | Record 服务日志 |
| `src/repository/user.repository.ts` | 用户仓库日志 |
| `src/repository/record.repository.ts` | 记录仓库日志 |

---

## 测试策略

### 单元测试 (`tests/logger.spec.ts`)

| 测试点 | 说明 |
|--------|------|
| 日志格式 | 输出格式符合规范 |
| 级别过滤 | DEBUG 日志在 INFO 级别不输出 |
| AsyncLocalStorage | requestId 正确传递 |
| data 格式化 | 对象正确序列化 |

### 测试要点

- 使用 Mock console 捕获输出
- 验证 requestId 从 AsyncLocalStorage 获取
- 测试各级别输出控制

---

## 注意事项

### Cloudflare Workers 兼容性

- 已启用 `nodejs_compat` flag，支持 `AsyncLocalStorage`
- console 输出自动集成 Cloudflare Logs
- observability 配置已启用，支持日志收集

### 性能考量

- 日志操作尽量简短，避免影响响应时间
- DEBUG 日志仅在开发环境启用
- Repository 层日志使用 DEBUG 级别，避免过多日志

### 安全考量

- JWT 相关日志不输出 secret
- 用户敏感信息适当脱敏
- 错误堆栈仅在 DEBUG 级别输出完整信息