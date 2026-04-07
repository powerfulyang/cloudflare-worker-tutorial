// tests/logger.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger, getLogLevel, initLogLevel, Logger, LogLevel, runWithRequestId, setLogLevel } from '@/utils/logger'

describe('logger', () => {
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

  describe('asyncLocalStorage', () => {
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
    it('dEBUG 级别应使用 console.log', () => {
      runWithRequestId('test', () => {
        const logger = new Logger()
        logger.debug('Debug message')
      })

      expect(consoleSpy.log).toHaveBeenCalled()
      expect(consoleSpy.info).not.toHaveBeenCalled()
    })

    it('iNFO 级别应使用 console.info', () => {
      runWithRequestId('test', () => {
        const logger = new Logger()
        logger.info('Info message')
      })

      expect(consoleSpy.info).toHaveBeenCalled()
    })

    it('wARN 级别应使用 console.warn', () => {
      runWithRequestId('test', () => {
        const logger = new Logger()
        logger.warn('Warn message')
      })

      expect(consoleSpy.warn).toHaveBeenCalled()
    })

    it('eRROR 级别应使用 console.error', () => {
      runWithRequestId('test', () => {
        const logger = new Logger()
        logger.error('Error message')
      })

      expect(consoleSpy.error).toHaveBeenCalled()
    })

    it('iNFO 级别时应过滤 DEBUG 日志', () => {
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

  describe('namespace', () => {
    it('应输出 namespace', () => {
      runWithRequestId('test-123', () => {
        const logger = new Logger('AuthService')
        logger.info('User logged in')
      })

      const output = consoleSpy.info.mock.calls[0][0]
      expect(output).toContain('[AuthService]')
      expect(output).toMatch(/INFO \[test-123\] \[AuthService\] User logged in$/)
    })

    it('无 namespace 时不输出 namespace 部分', () => {
      runWithRequestId('test-123', () => {
        const logger = new Logger()
        logger.info('Test message')
      })

      const output = consoleSpy.info.mock.calls[0][0]
      expect(output).not.toMatch(/\[\w+\] \[\w+\]/) // 不应该有两个连续的 [xxx] [yyy]
      expect(output).toMatch(/INFO \[test-123\] Test message$/)
    })

    it('createLogger 应支持 namespace 参数', () => {
      runWithRequestId('test', () => {
        const logger = createLogger('MyService')
        logger.info('Created with namespace')
      })

      const output = consoleSpy.info.mock.calls[0][0]
      expect(output).toContain('[MyService]')
    })
  })
})

describe('中间件集成', () => {
  let originalLevel: LogLevel

  beforeEach(() => {
    originalLevel = getLogLevel()
  })

  afterEach(() => {
    setLogLevel(originalLevel)
  })

  it('initLogLevel 应根据环境设置正确级别', () => {
    initLogLevel('local')
    expect(getLogLevel()).toBe(LogLevel.DEBUG)

    initLogLevel('production')
    expect(getLogLevel()).toBe(LogLevel.INFO)

    initLogLevel(undefined)
    expect(getLogLevel()).toBe(LogLevel.INFO)
  })
})
