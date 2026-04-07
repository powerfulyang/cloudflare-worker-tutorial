import type { ServiceDependencies } from '@/core/base.service'
import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { testUserTemplate } from '@/../tests/helpers/test-services'
import { BaseService } from '@/core/base.service'

class TestBaseService extends BaseService {
  get testEnv() {
    return this.env
  }

  get testRequestId() {
    return this.requestId
  }

  get testUser() {
    return this.user
  }
}

describe('baseService', () => {
  it('should provide env getter', async () => {
    const deps: ServiceDependencies = {
      env,
      requestId: 'test-request-id',
    }

    const service = new TestBaseService(deps)
    expect(service.testEnv).toBe(env)
  })

  it('should provide requestId getter', async () => {
    const deps: ServiceDependencies = {
      env,
      requestId: 'specific-request-id',
    }

    const service = new TestBaseService(deps)
    expect(service.testRequestId).toBe('specific-request-id')
  })

  it('should handle undefined requestId', async () => {
    const deps: ServiceDependencies = {
      env,
      requestId: undefined,
    }

    const service = new TestBaseService(deps)
    expect(service.testRequestId).toBeUndefined()
  })

  it('should provide user getter', async () => {
    const deps: ServiceDependencies = {
      env,
      requestId: 'test-request-id',
      user: testUserTemplate,
    }

    const service = new TestBaseService(deps)
    expect(service.testUser).toBe(testUserTemplate)
  })

  it('should handle undefined user', async () => {
    const deps: ServiceDependencies = {
      env,
      requestId: 'test-request-id',
      user: undefined,
    }

    const service = new TestBaseService(deps)
    expect(service.testUser).toBeUndefined()
  })
})
