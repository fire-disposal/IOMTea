import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../../env'
import { createChildLogger } from '../lib/logger'
import * as schema from './schema.js'

const logger = createChildLogger('db')

const dbUrlRedacted = env.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
logger.info({ url: dbUrlRedacted }, '初始化数据库连接池 (max: 20)')

const client = postgres(env.DATABASE_URL, { max: 20 })

client
  .unsafe('SELECT 1')
  .then(() => logger.info('✓ 数据库连接池就绪'))
  .catch((err) => {
    logger.error({ err }, '✗ 数据库连接池初始化失败')
  })

export const db = drizzle(client, { schema })
export type DbClient = typeof db

export * from './schema.js'
export * from './schema/enums'
export * from './schema/medication'
export * from './schema/pin'
export * from './schema/plan'
export * from './schema/tag'
export * from './schema/twin'
export * from './schema/ema'
export * from './schema/user-patient'
