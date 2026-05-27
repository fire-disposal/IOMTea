import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../core/http/types'
import { getEnforcer } from '../core/casbin/enforcer'

export function requirePermission(obj: string, act: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.var.userRole
    if (!role) return c.json({ error: 'Forbidden', message: '缺少用户角色' }, 403)
    if (role === 'super_admin') return await next()

    const enforcer = await getEnforcer()
    const sub = `role:${role}`
    const allowed = await enforcer.enforce(sub, obj, act)
    if (!allowed) {
      return c.json({ error: 'Forbidden', message: `需要权限: ${obj}:${act}` }, 403)
    }
    await next()
  })
}

export { requirePermission as requirePermissions }
