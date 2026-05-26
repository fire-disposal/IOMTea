import { getEnforcer } from '../casbin/enforcer'
import { logger } from '../lib/logger'

export async function seedPermissions(): Promise<void> {
  const e = await getEnforcer()

  const existing = await e.getPolicy()
  if (existing.length > 0) {
    logger.info('Casbin 策略已存在，跳过种子')
    return
  }

  const policies: [string, string, string][] = [
    ['role:super_admin', '*', '*'],
    ['role:admin', '*', '*'],
    ['role:user', '/patients/*', 'read'],
    ['role:user', '/dashboard/*', 'read'],
    ['role:user', '/alerts/*', 'read'],
    ['role:user', '/data/*', 'read'],
    ['role:user', '/plans/*', 'read'],
    ['role:user', '/credits/*', 'read'],
    ['role:user', '/forms/*', 'read'],
    ['role:admin', '/forms/*', 'write'],
    ['role:admin', '/forms/*', 'read'],
  ]

  for (const p of policies) {
    await e.addPolicy(...p)
  }

  await e.addGroupingPolicy('role:admin', 'role:user')

  logger.info(`Casbin 种子完成: ${policies.length} 策略 + 1 角色继承`)
}
