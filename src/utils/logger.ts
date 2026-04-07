import type { RequestIdVariables } from 'hono/request-id'
import { getContext } from 'hono/context-storage'

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
 * 获取当前 requestId
 */
function getCurrentRequestId(): string {
  try {
    const ctx = getContext<{ Variables: RequestIdVariables }>()
    return (ctx && ctx.get('requestId')) || 'no-request-id'
  }
  catch {
    return 'no-request-id'
  }
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
  constructor(private readonly namespace?: string) {}

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

    // 第一行: [timestamp] LEVEL [requestId] [namespace] message
    const namespacePart = this.namespace ? ` [${this.namespace}]` : ''
    const header = `[${timestamp}] ${levelName} [${requestId}]${namespacePart} ${message}`
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
export function createLogger(namespace?: string): Logger {
  return new Logger(namespace)
}

/**
 * 根据环境初始化日志级别
 */
export function initLogLevel(environment?: string): void {
  if (environment === 'local') {
    console.log('Local environment detected, setting log level to DEBUG')
    setLogLevel(LogLevel.DEBUG)
  }
  else {
    setLogLevel(LogLevel.INFO)
  }
}
