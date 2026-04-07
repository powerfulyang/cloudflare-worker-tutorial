# 单元测试设计方案

> 创建时间: 2026-04-07

## 概述

为 `src/core`, `src/service`, `src/repository` 三个核心模块添加单元/集成测试，采用真实 D1/KV 环境进行测试。

## 测试策略

- **测试风格**: 真实 D1/KV 集成测试
- **文件组织**: 模块镜像结构（`__tests__/` 目录放在源码同级）
- **测试框架**: Vitest + `@cloudflare/vitest-pool-workers`

## 文件结构

```
src/
├── core/
│   ├── __tests__/
│   │   ├── base.service.spec.ts
│   │   ├── prisma.spec.ts
│   │   └── request-services.spec.ts
│   ├── base.service.ts
│   ├── prisma.ts
│   └── request-services.ts
│   └── index.ts
├── service/
│   ├── __tests__/
│   │   ├── auth.service.spec.ts
│   │   └── record.service.spec.ts
│   ├── auth.service.ts
│   └── record.service.ts
├── repository/
│   ├── __tests__/
│   │   ├── user.repository.spec.ts
│   │   └── record.repository.spec.ts
│   ├── user.repository.ts
│   └── record.repository.ts

tests/
├── helpers/
│   └── test-services.ts          # 共享测试辅助工具
├── hash.spec.ts                  # 已有
├── e2e/
│   └── test-endpoint.e2e.spec.ts # 已有
```

## 测试用例清单

### 1. core/base.service.spec.ts

| 测试项 | 描述 |
|--------|------|
| 构造函数依赖注入 | 验证 deps 正确传递并可通过 getter 访问 |
| env getter | 验证返回正确的 env 对象 |
| requestId getter | 验证返回正确的 requestId（含 undefined 场景） |
| user getter | 验证返回正确的 user 对象（含 undefined 场景） |

### 2. core/prisma.spec.ts

| 测试项 | 描述 |
|--------|------|
| Prisma 客户端创建 | 验证 `getPrismaInstance` 返回有效的 PrismaClient |
| D1 adapter 集成 | 验证使用 D1 adapter 正确初始化 |

### 3. core/request-services.spec.ts

| 测试项 | 描述 |
|--------|------|
| 服务工厂创建 | 验证返回包含 authService 和 recordService 的对象 |
| 依赖链完整 | 验证 Repository → Service 链正确组装 |

### 4. service/auth.service.spec.ts (重点)

| 测试项 | 描述 |
|--------|------|
| JWT 签名 | 验证 `signJwt` 生成有效 JWT，包含 user 和过期时间 |
| JWT 验证 | 验证 `verifyJwt` 正确解析 JWT 并返回 user |
| OAuth 登录 - Google | 验证 Google 用户登录流程（新建/更新用户） |
| OAuth 登录 - Discord | 验证 Discord 用户登录流程 |
| OAuth 登录 - GitHub | 验证 GitHub 用户登录流程 |
| 票据生成 | 验证 `generateOnceTicket` 正确写入 KV 并返回 ticket |
| 票据重定向 URL 构建 | 验证 `buildTicketRedirectUrl` 正确拼接 ticket 参数 |
| 票据验证消费 | 验证 `checkOnceTicket` 正确读取并删除 KV 票据（一次性） |
| 用户不存在异常 | 验证无用户数据时抛出 HTTPException 400 |

### 5. service/record.service.spec.ts

| 测试项 | 描述 |
|--------|------|
| 记录查找成功 | 验证 `findById` 返回格式化后的记录 |
| 记录查找失败 | 验证记录不存在时抛出 HTTPException 404 |
| 记录创建 upsert | 验证新记录正确创建并返回格式化数据 |
| 记录更新 upsert | 验证已有记录正确更新 |
| JSON 格式化 | 验证 `formatRecord` 正确解析 data 字段 |

### 6. repository/user.repository.spec.ts

| 测试项 | 描述 |
|--------|------|
| 按邮箱查找 | 验证 `findByEmail` 返回匹配用户或 null |
| 按 Provider ID 查找 | 验证 `findByProviderId` 查询 googleId/discordId/githubId |
| 用户创建 | 验证 `create` 正确插入用户数据 |
| 用户更新 | 验证 `updateById` 正确更新用户字段 |

### 7. repository/record.repository.spec.ts

| 测试项 | 描述 |
|--------|------|
| 记录查找成功 | 验证 `findById` 返回匹配记录 |
| 记录查找不存在 | 验证 `findById` 返回 null |
| 记录 upsert 创建 | 验证新记录正确创建 |
| 记录 upsert 更新 | 验证已有记录正确更新 data 字段 |

## 配置调整

修改 `vitest.config.ts`:

```typescript
test: {
  globals: true,
  setupFiles: ['./.vitest/apply-migrations.ts'],
  include: ['tests/**/*.spec.ts', 'src/**/__tests__/**/*.spec.ts'],
  exclude: ['tests/e2e'],
}
```

## 测试辅助工具

创建 `tests/helpers/test-services.ts`:

- 提供统一的测试 Services/Repositories 构建函数
- 使用真实 D1/KV bindings
- 提供测试用户数据模板

## 成功标准

- 所有新增测试文件通过 `pnpm unit:test`
- 测试覆盖核心业务逻辑路径
- 测试可重复运行且独立（isolatedStorage 已配置）