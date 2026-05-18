import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../../env'
import * as schema from './schema'

const client = postgres(env.DATABASE_URL, { max: 20 })
export const db = drizzle(client, { schema })
export type DbClient = typeof db

// Re-export all schema modules for external use
export * from './schema'
export * from './schema/enums'
export * from './schema/auth-ext'
export * from './schema/medication'
export * from './schema/pin'

