/**
 * IOMTea 集中式日志模块
 *
 * 所有服务端日志统一经由此实例输出。
 * 子模块通过 `logger.child({ name: '...' })` 创建命名空间。
 */
import pino from 'pino'

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{name} {msg}',
    },
  },
})

export function createChildLogger(name: string) {
  return logger.child({ name })
}
