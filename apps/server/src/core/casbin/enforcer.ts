import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Enforcer, newEnforcer } from 'casbin'
import PostgresAdapter from 'casbin-pg-adapter'
import { env } from '../../env'
import { logger } from '../lib/logger'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let _enforcer: Enforcer | null = null
let _initPromise: Promise<Enforcer> | null = null

export async function getEnforcer(): Promise<Enforcer> {
  if (_enforcer) return _enforcer
  if (!_initPromise) {
    _initPromise = (async () => {
      const adapter = await PostgresAdapter.newAdapter({
        connectionString: env.DATABASE_URL,
        migrate: true,
      })
      const modelPath = path.resolve(__dirname, 'model.conf')
      _enforcer = await newEnforcer(modelPath, adapter)
      await _enforcer.loadPolicy()
      logger.info('Casbin enforcer 已初始化')
      return _enforcer
    })()
  }
  return _initPromise
}
